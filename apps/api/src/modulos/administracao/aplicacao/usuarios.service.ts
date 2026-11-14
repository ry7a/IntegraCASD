import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { criarHashDaSenha } from '../../../compartilhado/autenticacao/senha.js';
import { registrarNaTrilha, type OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import { TAMANHO_MAXIMO_TECNICO, lerTexto, mensagemDoTexto } from '../../../compartilhado/leitura-de-entrada.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { IdentidadeDoUsuario } from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import type { EntradaAlterarUsuario, EntradaCriarUsuario, UsuarioResumo } from './usuarios.types.js';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<UsuarioResumo[]> {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, ultimoAcessoEm: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async criar(entrada: EntradaCriarUsuario, autor: IdentidadeDoUsuario): Promise<UsuarioResumo> {
    const dados = validarCriacao(entrada);
    if (await this.prisma.usuario.findUnique({ where: { email: dados.email } })) {
      throw new ConflictException('Ja existe um usuario com este e-mail.');
    }
    const { senhaInicial, ...dadosDoUsuario } = dados;
    const senhaHash = await criarHashDaSenha(senhaInicial);

    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.usuario.create({
        data: { ...dadosDoUsuario, senhaHash },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, ultimoAcessoEm: true },
      });
      await registrarNaTrilha(tx, {
        usuarioId: autor.id,
        operacao: 'INCLUSAO',
        entidade: 'USUARIO',
        registroId: criado.id,
        detalhe: `Usuário incluído com perfil ${criado.perfil}.`,
      });
      return criado;
    });
  }

  async alterar(id: string, entrada: EntradaAlterarUsuario, autor: IdentidadeDoUsuario): Promise<UsuarioResumo> {
    if (!entrada || typeof entrada !== 'object') throw new BadRequestException('Informe os dados a alterar.');
    const atual = await this.prisma.usuario.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Usuario nao encontrado.');

    const dados = validarAlteracao(entrada);
    if (dados.ativo === false && id === autor.id) {
      throw new BadRequestException('Voce nao pode inativar o proprio acesso.');
    }
    if (dados.email && dados.email !== atual.email) {
      const existente = await this.prisma.usuario.findUnique({ where: { email: dados.email } });
      if (existente) throw new ConflictException('Ja existe um usuario com este e-mail.');
    }

    const deixaDeSerDiretor =
      atual.ativo &&
      atual.perfil === PerfilUsuario.DIRETORIA &&
      (dados.ativo === false || dados.perfil === PerfilUsuario.ADMINISTRATIVO);
    if (deixaDeSerDiretor) {
      const diretoresAtivos = await this.prisma.usuario.count({
        where: { ativo: true, perfil: PerfilUsuario.DIRETORIA },
      });
      if (diretoresAtivos <= 1) {
        throw new BadRequestException('Mantenha ao menos um usuario de diretoria ativo.');
      }
    }

    // O pedido pode trazer campos iguais aos atuais (reenvio, outro cliente da API). Por isso o que conta é
    // o que mudou em relação ao cadastro atual, e não o que veio no pedido.
    const camposAlterados = camposQueMudaram(dados, atual);
    if (camposAlterados.length === 0) {
      return {
        id: atual.id,
        nome: atual.nome,
        email: atual.email,
        perfil: atual.perfil,
        ativo: atual.ativo,
        ultimoAcessoEm: atual.ultimoAcessoEm,
      };
    }

    const senhaHash = dados.novaSenha ? await criarHashDaSenha(dados.novaSenha) : undefined;
    // Reenviar `ativo: false` de quem já está inativo não é uma inativação: só conta a passagem.
    const passaAInativo = dados.ativo === false && atual.ativo;
    const reativa = dados.ativo === true && !atual.ativo;
    // Trocar o perfil derruba as sessões abertas, como inativar ou trocar a senha: a pessoa entra
    // de novo e a tela passa a mostrar o que o perfil novo permite.
    const trocaDePerfil = dados.perfil !== undefined && dados.perfil !== atual.perfil;
    const revogarSessoes = passaAInativo || senhaHash !== undefined || trocaDePerfil;

    let operacao: OperacaoAuditada = 'ALTERACAO';
    if (passaAInativo) operacao = 'INATIVACAO';
    if (reativa) operacao = 'REATIVACAO';

    // Grava só o que mudou em relação ao cadastro atual (o Prisma ignora campo `undefined`): o banco recebe
    // exatamente o que a trilha registra. A proteção contra um formulário antigo vem da tela, que só manda
    // os campos que a pessoa editou (DialogoUsuario.tsx): campo que não veio não é tocado aqui.
    const mudou = (campo: string) => camposAlterados.includes(campo);
    return this.prisma.$transaction(async (tx) => {
      const alterado = await tx.usuario.update({
        where: { id },
        data: {
          nome: mudou('nome') ? dados.nome : undefined,
          email: mudou('email') ? dados.email : undefined,
          perfil: mudou('perfil') ? dados.perfil : undefined,
          ativo: mudou('ativo') ? dados.ativo : undefined,
          senhaHash,
        },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, ultimoAcessoEm: true },
      });
      if (revogarSessoes) {
        await tx.sessao.updateMany({
          where: { usuarioId: id, revogadaEm: null },
          data: { revogadaEm: new Date() },
        });
      }
      await registrarNaTrilha(tx, {
        usuarioId: autor.id,
        operacao,
        entidade: 'USUARIO',
        registroId: alterado.id,
        detalhe: detalheDaAlteracao(camposAlterados, atual.perfil, dados.perfil, revogarSessoes),
      });
      return alterado;
    });
  }
}

function validarCriacao(entrada: EntradaCriarUsuario) {
  if (!entrada || typeof entrada !== 'object') throw new BadRequestException('Informe os dados do usuario.');
  return {
    nome: validarNome(entrada.nome),
    email: validarEmail(entrada.email),
    perfil: validarPerfil(entrada.perfil),
    ativo: entrada.ativo === undefined ? true : validarAtivo(entrada.ativo),
    senhaInicial: validarSenha(entrada.senhaInicial),
  };
}

function validarAlteracao(entrada: EntradaAlterarUsuario) {
  const dados: {
    nome?: string;
    email?: string;
    perfil?: PerfilUsuario;
    ativo?: boolean;
    novaSenha?: string;
  } = {};
  if (entrada.nome !== undefined) dados.nome = validarNome(entrada.nome);
  if (entrada.email !== undefined) dados.email = validarEmail(entrada.email);
  if (entrada.perfil !== undefined) dados.perfil = validarPerfil(entrada.perfil);
  if (entrada.ativo !== undefined) dados.ativo = validarAtivo(entrada.ativo);
  if (entrada.novaSenha !== undefined) dados.novaSenha = validarSenha(entrada.novaSenha);
  if (Object.keys(dados).length === 0) throw new BadRequestException('Informe ao menos um campo para alterar.');
  return dados;
}

// Campos que de fato mudam em relação ao cadastro atual. A senha entra sempre que informada:
// não dá para comparar com a guardada (só existe o hash), e trocar a senha é o que se quer auditar.
function camposQueMudaram(
  dados: ReturnType<typeof validarAlteracao>,
  atual: { nome: string; email: string; perfil: PerfilUsuario; ativo: boolean },
): string[] {
  const campos: string[] = [];
  if (dados.nome !== undefined && dados.nome !== atual.nome) campos.push('nome');
  if (dados.email !== undefined && dados.email !== atual.email) campos.push('email');
  if (dados.perfil !== undefined && dados.perfil !== atual.perfil) campos.push('perfil');
  if (dados.ativo !== undefined && dados.ativo !== atual.ativo) campos.push('ativo');
  if (dados.novaSenha !== undefined) campos.push('senha');
  return campos;
}

// Texto da trilha para a alteração: os campos alterados, nunca os valores de nome e e-mail
// (LGPD: a trilha não pode ser apagada). A troca de perfil entra (de -> para), porque é o que a
// auditoria de acesso procura, e também se as sessões abertas da pessoa foram revogadas.
function detalheDaAlteracao(
  camposAlterados: string[],
  perfilAnterior: PerfilUsuario,
  perfilNovo: PerfilUsuario | undefined,
  sessoesRevogadas: boolean,
): string {
  const perfil =
    perfilNovo === undefined || perfilNovo === perfilAnterior ? '' : `; perfil ${perfilAnterior} -> ${perfilNovo}`;
  const sessoes = sessoesRevogadas ? '; sessões abertas revogadas' : '';
  return `Usuário alterado: ${camposAlterados.join(', ')}${perfil}${sessoes}.`;
}

// Nome e e-mail pela regra comum de texto: o caractere nulo (o PostgreSQL recusa) virava erro 500 na
// consulta do e-mail repetido ou na gravação. Sem limite de negócio: só o teto técnico. O que não é
// texto vira nulo, e cada campo pede o valor com a própria mensagem.
function lerTextoDoUsuario(valor: unknown, campo: string): string | null {
  const lido = lerTexto(valor, TAMANHO_MAXIMO_TECNICO);
  if (lido.valido) return lido.valor;
  if (lido.motivo === 'formato') return null;
  throw new BadRequestException(mensagemDoTexto(lido.motivo, campo, TAMANHO_MAXIMO_TECNICO));
}

function validarNome(valor: unknown): string {
  const nome = lerTextoDoUsuario(valor, 'o nome');
  if (nome === null || nome.length < 2) throw new BadRequestException('Informe o nome do usuario.');
  return nome;
}

function validarEmail(valor: unknown): string {
  const email = lerTextoDoUsuario(valor, 'o e-mail')?.toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Informe um e-mail valido.');
  return email;
}

function validarPerfil(valor: unknown): PerfilUsuario {
  if (valor !== PerfilUsuario.ADMINISTRATIVO && valor !== PerfilUsuario.DIRETORIA) {
    throw new BadRequestException('O perfil deve ser ADMINISTRATIVO ou DIRETORIA.');
  }
  return valor;
}

function validarAtivo(valor: unknown): boolean {
  if (typeof valor !== 'boolean') throw new BadRequestException('A situacao do usuario deve ser ativa ou inativa.');
  return valor;
}

function validarSenha(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length < 12) {
    throw new BadRequestException('A senha deve ter ao menos 12 caracteres.');
  }
  return valor;
}

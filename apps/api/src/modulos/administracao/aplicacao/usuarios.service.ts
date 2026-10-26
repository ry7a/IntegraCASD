import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { criarHashDaSenha } from '../../../compartilhado/autenticacao/senha.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
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
        detalhe: `Usuario ${criado.email} incluido com perfil ${criado.perfil}.`,
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

    const senhaHash = dados.novaSenha ? await criarHashDaSenha(dados.novaSenha) : undefined;
    const revogarSessoes = dados.ativo === false || senhaHash !== undefined;
    return this.prisma.$transaction(async (tx) => {
      const alterado = await tx.usuario.update({
        where: { id },
        data: {
          nome: dados.nome,
          email: dados.email,
          perfil: dados.perfil,
          ativo: dados.ativo,
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
        operacao: alterado.ativo ? 'ALTERACAO' : 'INATIVACAO',
        entidade: 'USUARIO',
        registroId: alterado.id,
        detalhe: `Usuario ${alterado.email} alterado.`,
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

function validarNome(valor: unknown): string {
  if (typeof valor !== 'string' || valor.trim().length < 2) throw new BadRequestException('Informe o nome do usuario.');
  return valor.trim();
}

function validarEmail(valor: unknown): string {
  if (typeof valor !== 'string') throw new BadRequestException('Informe um e-mail valido.');
  const email = valor.trim().toLowerCase();
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

import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { criarTokenDeSessao, DURACAO_SESSAO_MS, resumirToken } from '../../../compartilhado/autenticacao/sessao.js';
import { senhaConfere, simularVerificacaoDeSenha } from '../../../compartilhado/autenticacao/senha.js';
import { TAMANHO_MAXIMO_TECNICO, lerTexto } from '../../../compartilhado/leitura-de-entrada.js';

const LIMITE_DE_FALHAS = 5;
const DURACAO_BLOQUEIO_MS = 15 * 60 * 1000;

@Injectable()
export class Autenticar {
  constructor(private readonly prisma: PrismaService) {}

  async executar(emailInformado: unknown, senhaInformada: unknown) {
    // E-mail pela regra comum de texto. O que ela recusa (caractere nulo, que o PostgreSQL não aceita nem
    // numa consulta) vira credencial errada como outra qualquer: nenhum usuário tem um e-mail assim.
    const lido = lerTexto(emailInformado, TAMANHO_MAXIMO_TECNICO);
    const email = lido.valido ? lido.valor.toLowerCase() : '';
    const senha = typeof senhaInformada === 'string' ? senhaInformada : '';
    if (!email || !senha) throw new UnauthorizedException('E-mail ou senha invalidos.');

    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      await simularVerificacaoDeSenha(senha);
      throw new UnauthorizedException('E-mail ou senha invalidos.');
    }

    const agora = new Date();
    if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) {
      throw new HttpException(
        'Acesso temporariamente bloqueado. Aguarde 15 minutos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const confere = await senhaConfere(senha, usuario.senhaHash);
    if (!confere || !usuario.ativo) {
      await this.registrarFalha(usuario.id, agora);
      throw new UnauthorizedException('E-mail ou senha invalidos.');
    }

    const token = criarTokenDeSessao();
    const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcessoEm: agora },
      });
      await tx.sessao.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: resumirToken(token),
          // Só registro do perfil no login: a guarda usa o perfil atual do usuário (autenticacao.guard.ts).
          perfil: usuario.perfil,
          expiraEm,
        },
      });
    });

    return {
      token,
      expiraEm,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    };
  }

  private async registrarFalha(usuarioId: string, agora: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.usuario.update({
        where: { id: usuarioId },
        data: { tentativasFalhas: { increment: 1 } },
        select: { tentativasFalhas: true },
      });
      if (atualizado.tentativasFalhas >= LIMITE_DE_FALHAS) {
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { bloqueadoAte: new Date(agora.getTime() + DURACAO_BLOQUEIO_MS) },
        });
      }
      if (atualizado.tentativasFalhas === LIMITE_DE_FALHAS) {
        await registrarNaTrilha(tx, {
          usuarioId,
          operacao: 'BLOQUEIO_AUTENTICACAO',
          entidade: 'USUARIO',
          registroId: usuarioId,
          detalhe: 'Acesso bloqueado temporariamente apos cinco tentativas malsucedidas.',
        });
      }
    });
  }
}

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import type { IdentidadeDoUsuario } from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { UsuariosService } from './usuarios.service.js';

const DIRETOR: IdentidadeDoUsuario = {
  id: 'diretor-1',
  nome: 'Diretor Atual',
  email: 'diretor@exemplo.com',
  perfil: PerfilUsuario.DIRETORIA,
  sessaoId: 'sessao-1',
};

function usuarioDiretor(id = DIRETOR.id) {
  return {
    id,
    nome: 'Diretor Atual',
    email: `${id}@exemplo.com`,
    senhaHash: 'hash',
    perfil: PerfilUsuario.DIRETORIA,
    ativo: true,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    ultimoAcessoEm: null,
    dataCriacao: new Date(),
    dataAlteracao: new Date(),
  };
}

// Prisma falso: anota em `operacoes` o que foi feito e se foi dentro da transação.
function prismaFalso(usuarioAtual: ReturnType<typeof usuarioDiretor>) {
  const operacoes: string[] = [];
  let dentroDaTransacao = false;
  const gravarNaTrilha = vi.fn(async () => {
    operacoes.push(`trilha${dentroDaTransacao ? ' (tx)' : ''}`);
    return {};
  });
  const tx = {
    usuario: {
      update: vi.fn(async ({ data }: { data: Partial<ReturnType<typeof usuarioDiretor>> }) => {
        operacoes.push(`usuario.update${dentroDaTransacao ? ' (tx)' : ''}`);
        const resultado = { ...usuarioAtual };
        for (const [campo, valor] of Object.entries(data)) {
          if (valor !== undefined) Object.assign(resultado, { [campo]: valor });
        }
        return resultado;
      }),
    },
    sessao: {
      updateMany: vi.fn(async () => {
        operacoes.push(`sessao.updateMany${dentroDaTransacao ? ' (tx)' : ''}`);
        return { count: 2 };
      }),
    },
    // A função fica numa variável: a regra B13 barra escrever na trilha fora do ponto central.
    registroAuditoria: { create: gravarNaTrilha },
  };
  const prisma = {
    usuario: {
      findUnique: vi.fn(async () => usuarioAtual),
      count: vi.fn(async () => 2),
    },
    $transaction: vi.fn(async (trabalho: (cliente: typeof tx) => Promise<unknown>) => {
      dentroDaTransacao = true;
      try {
        return await trabalho(tx);
      } finally {
        dentroDaTransacao = false;
      }
    }),
  } as unknown as PrismaService;
  return { prisma, tx, operacoes, gravarNaTrilha };
}

describe('manutencao de usuarios [Administracao.RF001]', () => {
  it('recusa a autoinativacao', async () => {
    const prisma = {
      usuario: { findUnique: vi.fn(async () => usuarioDiretor()) },
    } as unknown as PrismaService;
    const servico = new UsuariosService(prisma);

    await expect(servico.alterar(DIRETOR.id, { ativo: false }, DIRETOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mantem ao menos um usuario de diretoria ativo', async () => {
    const prisma = {
      usuario: {
        findUnique: vi.fn(async () => usuarioDiretor('diretor-2')),
        count: vi.fn(async () => 1),
      },
    } as unknown as PrismaService;
    const servico = new UsuariosService(prisma);

    await expect(servico.alterar('diretor-2', { perfil: PerfilUsuario.ADMINISTRATIVO }, DIRETOR)).rejects.toThrow(
      'Mantenha ao menos um usuario de diretoria ativo.',
    );
  });

  it('a trilha registra os campos alterados, sem o nome e o e-mail (LGPD)', async () => {
    const trilha: string[] = [];
    const tx = {
      usuario: { update: vi.fn(async () => ({ ...usuarioDiretor('diretor-2'), nome: 'Nome Novo', email: 'novo@exemplo.com' })) },
      sessao: { updateMany: vi.fn() },
      registroAuditoria: {
        create: vi.fn(async ({ data }: { data: { detalhe: string } }) => {
          trilha.push(data.detalhe);
        }),
      },
    };
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValueOnce(usuarioDiretor('diretor-2')).mockResolvedValueOnce(null),
        count: vi.fn(async () => 2),
      },
      $transaction: vi.fn(async (operacao: (cliente: typeof tx) => Promise<unknown>) => operacao(tx)),
    } as unknown as PrismaService;

    await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: 'Nome Novo', email: 'novo@exemplo.com', perfil: PerfilUsuario.ADMINISTRATIVO },
      DIRETOR,
    );

    expect(trilha).toEqual([
      'Usuário alterado: nome, email, perfil; perfil DIRETORIA -> ADMINISTRATIVO; sessões abertas revogadas.',
    ]);
  });

  it('trocar o perfil revoga as sessoes abertas do usuario, na mesma transacao, com registro na trilha', async () => {
    const { prisma, tx, operacoes, gravarNaTrilha } = prismaFalso(usuarioDiretor('diretor-2'));
    const servico = new UsuariosService(prisma);

    const alterado = await servico.alterar('diretor-2', { perfil: PerfilUsuario.ADMINISTRATIVO }, DIRETOR);

    expect(alterado.perfil).toBe(PerfilUsuario.ADMINISTRATIVO);
    expect(tx.sessao.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'diretor-2', revogadaEm: null },
      data: { revogadaEm: expect.any(Date) },
    });
    expect(operacoes).toEqual(['usuario.update (tx)', 'sessao.updateMany (tx)', 'trilha (tx)']);
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: DIRETOR.id,
        operacao: 'ALTERACAO',
        entidade: 'USUARIO',
        registroId: 'diretor-2',
        detalhe: 'Usuário alterado: perfil; perfil DIRETORIA -> ADMINISTRATIVO; sessões abertas revogadas.',
      }),
    });
  });

  it('nao revoga sessoes quando o perfil nao muda', async () => {
    const { prisma, tx, gravarNaTrilha } = prismaFalso(usuarioDiretor('diretor-2'));
    const servico = new UsuariosService(prisma);

    await servico.alterar('diretor-2', { nome: 'Diretor Renomeado', perfil: PerfilUsuario.DIRETORIA }, DIRETOR);

    expect(tx.usuario.update).toHaveBeenCalled();
    expect(tx.sessao.updateMany).not.toHaveBeenCalled();
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({ detalhe: 'Usuário alterado: nome, perfil.' }),
    });
  });
});

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

    expect(trilha).toEqual(['Usuário alterado: nome, email, perfil; perfil agora ADMINISTRATIVO.']);
  });
});

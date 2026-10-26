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
});

import { ForbiddenException } from '@nestjs/common';
import { PerfilUsuario } from '../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PerfilGuard } from './perfil.guard.js';

function contextoCom(perfil: PerfilUsuario): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ usuarioAutenticado: { perfil } }),
    }),
  } as unknown as ExecutionContext;
}

describe('perfis concentricos [Segurança.NF001]', () => {
  it('permite diretoria e recusa administrativo numa rota restrita', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => [PerfilUsuario.DIRETORIA]),
    } as unknown as Reflector;
    const guard = new PerfilGuard(reflector);

    expect(guard.canActivate(contextoCom(PerfilUsuario.DIRETORIA))).toBe(true);
    expect(() => guard.canActivate(contextoCom(PerfilUsuario.ADMINISTRATIVO))).toThrow(ForbiddenException);
  });
});

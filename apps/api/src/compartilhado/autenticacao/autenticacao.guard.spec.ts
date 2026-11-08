import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PerfilUsuario } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AutenticacaoGuard } from './autenticacao.guard.js';
import { NOME_COOKIE_SESSAO } from './sessao.js';
import type { RequisicaoAutenticada } from './usuario-autenticado.js';

// Dados fictícios. A rota nunca é pública aqui: o reflector sempre responde "não".
const reflector = { getAllAndOverride: vi.fn(() => false) } as unknown as Reflector;

function sessaoFicticia(perfilDaSessao: PerfilUsuario, perfilDoUsuario: PerfilUsuario, ativo = true) {
  return {
    id: 'sessao-1',
    usuarioId: 'usuario-1',
    tokenHash: 'resumo',
    perfil: perfilDaSessao,
    expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    revogadaEm: null,
    dataCriacao: new Date(),
    usuario: { id: 'usuario-1', nome: 'Pessoa Ficticia', email: 'pessoa@exemplo.com', perfil: perfilDoUsuario, ativo },
  };
}

function montar(sessao: ReturnType<typeof sessaoFicticia> | null) {
  const prisma = { sessao: { findUnique: vi.fn(async () => sessao) } } as unknown as PrismaService;
  const requisicao = { headers: { cookie: `${NOME_COOKIE_SESSAO}=token-ficticio` } } as unknown as RequisicaoAutenticada;
  const contexto = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext;
  return { guarda: new AutenticacaoGuard(reflector, prisma), contexto, requisicao };
}

describe('AutenticacaoGuard', () => {
  // Corrida: o login lê o usuário (DIRETORIA) e confere a senha; enquanto isso, a diretoria o rebaixa,
  // e a sessão nasce com o perfil antigo. A guarda deve valer o perfil atual do usuário.
  it('usa o perfil atual do usuario, nao o copiado na sessao no login', async () => {
    const { guarda, contexto, requisicao } = montar(
      sessaoFicticia(PerfilUsuario.DIRETORIA, PerfilUsuario.ADMINISTRATIVO),
    );

    await expect(guarda.canActivate(contexto)).resolves.toBe(true);

    expect(requisicao.usuarioAutenticado?.perfil).toBe(PerfilUsuario.ADMINISTRATIVO);
  });

  it('recusa sessao de usuario inativo', async () => {
    const { guarda, contexto } = montar(sessaoFicticia(PerfilUsuario.DIRETORIA, PerfilUsuario.DIRETORIA, false));

    await expect(guarda.canActivate(contexto)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa sessao inexistente', async () => {
    const { guarda, contexto } = montar(null);

    await expect(guarda.canActivate(contexto)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

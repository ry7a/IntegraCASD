import { HttpException, UnauthorizedException } from '@nestjs/common';
import { PerfilUsuario } from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { Autenticar } from './autenticar.js';

describe('bloqueio de autenticacao [Segurança.NF007]', () => {
  it('bloqueia por 15 minutos depois de cinco senhas incorretas e audita a ocorrencia', async () => {
    const usuario = {
      id: 'usuario-1',
      nome: 'Usuario de Teste',
      email: 'teste@exemplo.com',
      senhaHash: 'hash-invalido',
      perfil: PerfilUsuario.ADMINISTRATIVO,
      ativo: true,
      tentativasFalhas: 0,
      bloqueadoAte: null as Date | null,
      ultimoAcessoEm: null,
      dataCriacao: new Date(),
      dataAlteracao: new Date(),
    };
    const auditoriaCriar = vi.fn();
    const usuarioAtualizar = vi.fn(async ({ data }: { data: { tentativasFalhas?: { increment: number }; bloqueadoAte?: Date } }) => {
      if (data.tentativasFalhas) usuario.tentativasFalhas += data.tentativasFalhas.increment;
      if (data.bloqueadoAte) usuario.bloqueadoAte = data.bloqueadoAte;
      return { ...usuario };
    });
    const transacao = {
      usuario: { update: usuarioAtualizar },
      registroAuditoria: { create: auditoriaCriar },
    };
    const prisma = {
      usuario: { findUnique: vi.fn(async () => usuario) },
      $transaction: vi.fn(async (acao: (tx: typeof transacao) => Promise<unknown>) => acao(transacao)),
    } as unknown as PrismaService;
    const autenticar = new Autenticar(prisma);

    for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
      await expect(autenticar.executar(usuario.email, 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(usuario.tentativasFalhas).toBe(5);
    expect(usuario.bloqueadoAte).toBeInstanceOf(Date);
    expect(auditoriaCriar).toHaveBeenCalledTimes(1);
    await expect(autenticar.executar(usuario.email, 'errada')).rejects.toBeInstanceOf(HttpException);
  });
});

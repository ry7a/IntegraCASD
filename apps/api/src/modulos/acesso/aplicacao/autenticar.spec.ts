import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { PerfilUsuario } from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { Autenticar } from './autenticar.js';

// Usuário fictício e um Prisma falso que aplica no objeto o que o caso de uso gravaria no banco.
function montarCenario() {
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
  const buscarUsuario = vi.fn(async () => usuario);
  const prisma = {
    usuario: { findUnique: buscarUsuario },
    $transaction: vi.fn(async (acao: (tx: typeof transacao) => Promise<unknown>) => acao(transacao)),
  } as unknown as PrismaService;
  return { usuario, auditoriaCriar, buscarUsuario, autenticar: new Autenticar(prisma) };
}

describe('bloqueio de autenticacao [Segurança.NF007] CT-NF-06', () => {
  // Valor-limite (Plano de Testes, CT-NF-06): quatro falhas ainda não bloqueiam; a quinta bloqueia.
  it('quatro senhas incorretas nao bloqueiam: a quinta tentativa ainda confere a senha', async () => {
    const { usuario, auditoriaCriar, autenticar } = montarCenario();

    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      await expect(autenticar.executar(usuario.email, 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(usuario.tentativasFalhas).toBe(4);
    expect(usuario.bloqueadoAte).toBeNull();
    expect(auditoriaCriar).not.toHaveBeenCalled();
    // A quinta ainda é avaliada (401 de senha errada), e não recusada de cara pelo bloqueio (429).
    await expect(autenticar.executar(usuario.email, 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloqueia por 15 minutos depois de cinco senhas incorretas e audita a ocorrencia', async () => {
    const { usuario, auditoriaCriar, autenticar } = montarCenario();

    for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
      await expect(autenticar.executar(usuario.email, 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(usuario.tentativasFalhas).toBe(5);
    expect(usuario.bloqueadoAte).toBeInstanceOf(Date);
    const minutosDeBloqueio = (usuario.bloqueadoAte!.getTime() - Date.now()) / 60_000;
    expect(minutosDeBloqueio).toBeGreaterThan(14);
    expect(minutosDeBloqueio).toBeLessThanOrEqual(15);
    expect(auditoriaCriar).toHaveBeenCalledTimes(1);
    const bloqueado = autenticar.executar(usuario.email, 'errada');
    await expect(bloqueado).rejects.toBeInstanceOf(HttpException);
    await expect(bloqueado).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });
});

describe('e-mail com caractere nulo no login', () => {
  // O PostgreSQL recusa o \u0000 até numa consulta (erro 22021): antes, o login respondia 500. Agora é uma
  // credencial errada como outra qualquer (401), sem consultar o banco.
  it('responde "e-mail ou senha inválidos" (401), sem procurar o usuário no banco', async () => {
    const { usuario, buscarUsuario, autenticar } = montarCenario();

    const entrando = autenticar.executar(`${usuario.email}\u0000`, 'qualquer-senha');

    await expect(entrando).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(entrando).rejects.toThrow('E-mail ou senha invalidos.');
    expect(buscarUsuario).not.toHaveBeenCalled();
    expect(usuario.tentativasFalhas).toBe(0);
  });
});

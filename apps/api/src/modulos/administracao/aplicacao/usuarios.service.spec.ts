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
// A busca por id devolve `usuarioAtual`; a busca por e-mail (conferência de duplicidade) não acha ninguém.
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
  const buscarUsuario = vi.fn(async ({ where }: { where: { id?: string } }) =>
    where.id === usuarioAtual.id ? usuarioAtual : null,
  );
  const prisma = {
    usuario: {
      findUnique: buscarUsuario,
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
  return { prisma, tx, operacoes, gravarNaTrilha, buscarUsuario };
}

describe('manutencao de usuarios [Administração.RF001]', () => {
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

  // A tela manda sempre o formulário inteiro: a trilha deve listar só o que mudou de fato.
  it('com o formulario inteiro, a trilha lista so o e-mail quando so ele mudou, sem revogar sessoes', async () => {
    const atual = usuarioDiretor('diretor-2');
    const { prisma, tx, gravarNaTrilha } = prismaFalso(atual);

    await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: atual.nome, email: 'novo@exemplo.com', perfil: atual.perfil, ativo: true },
      DIRETOR,
    );

    expect(tx.sessao.updateMany).not.toHaveBeenCalled();
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({ operacao: 'ALTERACAO', detalhe: 'Usuário alterado: email.' }),
    });
  });

  it('reenviar ativo:false de um usuario ja inativo nao revoga sessoes nem vira INATIVACAO', async () => {
    const atual = { ...usuarioDiretor('diretor-2'), ativo: false };
    const { prisma, tx, gravarNaTrilha } = prismaFalso(atual);

    await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: 'Nome Novo', email: atual.email, perfil: atual.perfil, ativo: false },
      DIRETOR,
    );

    expect(tx.sessao.updateMany).not.toHaveBeenCalled();
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({ operacao: 'ALTERACAO', detalhe: 'Usuário alterado: nome.' }),
    });
  });

  it('passar de ativo para inativo revoga as sessoes e registra INATIVACAO', async () => {
    const atual = usuarioDiretor('diretor-2');
    const { prisma, tx, gravarNaTrilha } = prismaFalso(atual);

    await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: atual.nome, email: atual.email, perfil: atual.perfil, ativo: false },
      DIRETOR,
    );

    expect(tx.sessao.updateMany).toHaveBeenCalled();
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operacao: 'INATIVACAO',
        detalhe: 'Usuário alterado: ativo; sessões abertas revogadas.',
      }),
    });
  });

  it('formulario sem nenhuma mudanca nao grava nada', async () => {
    const atual = usuarioDiretor('diretor-2');
    const { prisma, tx, gravarNaTrilha } = prismaFalso(atual);

    const resultado = await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: atual.nome, email: atual.email, perfil: atual.perfil, ativo: true },
      DIRETOR,
    );

    expect(resultado.id).toBe('diretor-2');
    expect(tx.usuario.update).not.toHaveBeenCalled();
    expect(gravarNaTrilha).not.toHaveBeenCalled();
  });

  it('a trilha nunca leva o nome nem o e-mail, antigos ou novos (LGPD)', async () => {
    const atual = usuarioDiretor('diretor-2');
    const { prisma, gravarNaTrilha } = prismaFalso(atual);

    await new UsuariosService(prisma).alterar(
      'diretor-2',
      { nome: 'Nome Novo', email: 'novo@exemplo.com', perfil: PerfilUsuario.ADMINISTRATIVO, ativo: true },
      DIRETOR,
    );

    const detalhes = gravarNaTrilha.mock.calls.map((chamada) => JSON.stringify(chamada));
    expect(detalhes).toHaveLength(1);
    for (const dadoPessoal of [atual.nome, atual.email, 'Nome Novo', 'novo@exemplo.com']) {
      expect(detalhes[0]).not.toContain(dadoPessoal);
    }
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({
        detalhe: 'Usuário alterado: nome, email, perfil; perfil DIRETORIA -> ADMINISTRATIVO; sessões abertas revogadas.',
      }),
    });
  });

  it('trocar o perfil revoga as sessoes abertas do usuario, na mesma transacao, com registro na trilha', async () => {
    const atual = usuarioDiretor('diretor-2');
    const { prisma, tx, operacoes, gravarNaTrilha } = prismaFalso(atual);
    const servico = new UsuariosService(prisma);

    const alterado = await servico.alterar(
      'diretor-2',
      { nome: atual.nome, email: atual.email, perfil: PerfilUsuario.ADMINISTRATIVO, ativo: true },
      DIRETOR,
    );

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
      data: expect.objectContaining({ detalhe: 'Usuário alterado: nome.' }),
    });
  });

  it('grava so os campos que mudaram em relacao ao cadastro atual (o banco recebe o mesmo que a trilha)', async () => {
    // O pedido traz o formulário inteiro, mas só o nome difere do cadastro: só ele pode ir para o banco.
    const { prisma, tx } = prismaFalso(usuarioDiretor('diretor-2'));
    const servico = new UsuariosService(prisma);

    await servico.alterar(
      'diretor-2',
      { nome: 'Diretor Renomeado', email: 'diretor-2@exemplo.com', perfil: PerfilUsuario.DIRETORIA, ativo: true },
      DIRETOR,
    );

    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nome: 'Diretor Renomeado', email: undefined, perfil: undefined, ativo: undefined, senhaHash: undefined },
      }),
    );
  });

  it('campo que nao veio no pedido nao e tocado: salvar so o nome nao reativa quem outra pessoa inativou', async () => {
    // Cenário: alguém inativou o usuário depois que a tela abriu; a tela manda só o que foi editado (o nome).
    const inativo = { ...usuarioDiretor('diretor-2'), ativo: false };
    const { prisma, tx, gravarNaTrilha } = prismaFalso(inativo);
    const servico = new UsuariosService(prisma);

    await servico.alterar('diretor-2', { nome: 'Diretor Renomeado' }, DIRETOR);

    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nome: 'Diretor Renomeado', email: undefined, perfil: undefined, ativo: undefined, senhaHash: undefined },
      }),
    );
    expect(tx.sessao.updateMany).not.toHaveBeenCalled();
    expect(gravarNaTrilha).toHaveBeenCalledWith({
      data: expect.objectContaining({ operacao: 'ALTERACAO', detalhe: 'Usuário alterado: nome.' }),
    });
  });

  // O PostgreSQL recusa o \u0000: antes, a consulta do e-mail repetido (ou a gravação) dava erro 500.
  it.each([
    ['nome', { nome: 'Usuario\u0000 Ficticio' }, /nulo\) no nome/],
    ['e-mail', { email: 'usuario\u0000@exemplo.com' }, /nulo\) no e-mail/],
  ])('caractere nulo no %s: recusa com 400 citando o campo, sem consultar nem gravar', async (_campo, campos, mensagem) => {
    const { prisma, tx, buscarUsuario } = prismaFalso(usuarioDiretor('diretor-2'));
    const servico = new UsuariosService(prisma);
    const novo = { nome: 'Usuario Ficticio', email: 'usuario@exemplo.com', perfil: PerfilUsuario.ADMINISTRATIVO, senhaInicial: 'senha-ficticia-12', ...campos };

    const criando = servico.criar(novo, DIRETOR);
    await expect(criando).rejects.toBeInstanceOf(BadRequestException);
    await expect(criando).rejects.toThrow(mensagem);
    await expect(servico.alterar('diretor-2', campos, DIRETOR)).rejects.toThrow(mensagem);
    // A única consulta foi a do usuário alterado, pelo id: nenhuma pelo e-mail com o caractere nulo.
    expect(buscarUsuario).toHaveBeenCalledTimes(1);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });
});

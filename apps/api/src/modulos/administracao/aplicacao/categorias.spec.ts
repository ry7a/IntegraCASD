import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { CategoriaComUso, CategoriasRepositorio } from '../infra/categorias.repositorio.js';
import { AlterarCategoria } from './alterar-categoria.js';
import { CriarCategoria } from './criar-categoria.js';
import { ExcluirCategoria } from './excluir-categoria.js';

const AUTOR = 'usuario-1';

const zeladoria: CategoriaComUso = {
  id: 'cat-1',
  nome: 'Zeladoria',
  tipo: 'SAIDA',
  ativo: true,
  quantidadeMovimentacoes: 4,
};

// Dublê do repositório: guarda as chamadas de escrita para o teste conferir.
function criarRepositorioFalso(opcoes: {
  existente?: CategoriaComUso | null;
  nomeEmUso?: boolean;
  uso?: { entradas: number; saidas: number };
}) {
  const chamadas = { criar: [] as unknown[], alterar: [] as unknown[], excluir: [] as unknown[] };
  const repositorio = {
    buscarPorId: async () => opcoes.existente ?? null,
    existeAtivaComNome: async () => opcoes.nomeEmUso ?? false,
    contarUsoPorTipo: async () => opcoes.uso ?? { entradas: 0, saidas: 0 },
    criar: async (dados: { nome: string; tipo: string }) => {
      chamadas.criar.push(dados);
      return { ...zeladoria, ...dados };
    },
    alterar: async (id: string, dados: object, operacao: string) => {
      chamadas.alterar.push({ id, dados, operacao });
      return { ...zeladoria, ...dados };
    },
    excluir: async (categoria: { id: string }) => {
      chamadas.excluir.push(categoria.id);
    },
  } as unknown as CategoriasRepositorio;
  return { repositorio, chamadas };
}

describe('CriarCategoria [Administração.RF002] CT-ADM-02', () => {
  it('grava o nome normalizado e o tipo', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({});
    await new CriarCategoria(repositorio).executar({ nome: '  Material  de limpeza ', tipo: 'SAIDA' }, AUTOR);
    expect(chamadas.criar).toEqual([{ nome: 'Material de limpeza', tipo: 'SAIDA' }]);
  });

  it('recusa nome igual ao de outra categoria ativa (fluxo E1) com 409', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ nomeEmUso: true });
    await expect(
      new CriarCategoria(repositorio).executar({ nome: 'Zeladoria', tipo: 'SAIDA' }, AUTOR),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(chamadas.criar).toEqual([]);
  });

  it('recusa dados inválidos com 400', async () => {
    const { repositorio } = criarRepositorioFalso({});
    await expect(
      new CriarCategoria(repositorio).executar({ nome: 'Zeladoria', tipo: 'QUALQUER' }, AUTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // O PostgreSQL recusa o \u0000: antes, a consulta do nome repetido já dava erro 500.
  it('recusa com 400 o nome com caractere nulo, citando o nome da categoria, sem gravar', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({});
    const criando = new CriarCategoria(repositorio).executar({ nome: 'Limpe\u0000za', tipo: 'SAIDA' }, AUTOR);
    await expect(criando).rejects.toBeInstanceOf(BadRequestException);
    await expect(criando).rejects.toThrow(/nulo\) no nome da categoria/);
    expect(chamadas.criar).toEqual([]);
  });
});

describe('AlterarCategoria [Administração.RF002]', () => {
  it('inativar categoria em uso é permitido e fica registrado como INATIVACAO (fluxo A1)', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: zeladoria });
    await new AlterarCategoria(repositorio).executar('cat-1', { ativo: false }, AUTOR);
    expect(chamadas.alterar).toEqual([{ id: 'cat-1', dados: { ativo: false }, operacao: 'INATIVACAO' }]);
  });

  it('reativar confere se outra categoria ativa já usa o nome', async () => {
    const inativa = { ...zeladoria, ativo: false };
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: inativa, nomeEmUso: true });
    await expect(
      new AlterarCategoria(repositorio).executar('cat-1', { ativo: true }, AUTOR),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(chamadas.alterar).toEqual([]);
  });

  it('não troca para "só entradas" uma categoria que já classifica saídas', async () => {
    const { repositorio } = criarRepositorioFalso({ existente: zeladoria, uso: { entradas: 0, saidas: 4 } });
    await expect(
      new AlterarCategoria(repositorio).executar('cat-1', { tipo: 'ENTRADA' }, AUTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manter o mesmo nome não acusa duplicidade', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: zeladoria, nomeEmUso: true });
    await new AlterarCategoria(repositorio).executar('cat-1', { nome: 'Zeladoria', tipo: 'AMBOS' }, AUTOR);
    expect(chamadas.alterar).toHaveLength(1);
  });

  it('categoria inexistente responde 404; corpo sem campos responde 400', async () => {
    const vazio = criarRepositorioFalso({ existente: null });
    await expect(new AlterarCategoria(vazio.repositorio).executar('x', { ativo: false }, AUTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const { repositorio } = criarRepositorioFalso({ existente: zeladoria });
    await expect(new AlterarCategoria(repositorio).executar('cat-1', {}, AUTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ExcluirCategoria', () => {
  it('exclui categoria que nunca foi usada', async () => {
    const semUso = { ...zeladoria, quantidadeMovimentacoes: 0 };
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: semUso });
    await new ExcluirCategoria(repositorio).executar('cat-1', AUTOR);
    expect(chamadas.excluir).toEqual(['cat-1']);
  });

  it('recusa com 409 a exclusão de categoria em uso', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: zeladoria });
    await expect(new ExcluirCategoria(repositorio).executar('cat-1', AUTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(chamadas.excluir).toEqual([]);
  });

  it('categoria inexistente responde 404', async () => {
    const { repositorio } = criarRepositorioFalso({ existente: null });
    await expect(new ExcluirCategoria(repositorio).executar('x', AUTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
});

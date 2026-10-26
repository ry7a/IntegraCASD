import { ConflictException, NotFoundException } from '@nestjs/common';
import type { FuncionarioRegistrado, FuncionariosRepositorio } from '../infra/funcionarios.repositorio.js';
import { AlterarFuncionario } from './alterar-funcionario.js';
import { CriarFuncionario } from './criar-funcionario.js';
import { ListarFuncionarios } from './listar-funcionarios.js';

// Dados fictícios (LGPD). O CPF só respeita os dígitos verificadores.
const HOJE = '2026-10-26';
const AUTOR = 'usuario-1';

const rosa: FuncionarioRegistrado = {
  id: 'f1',
  nome: 'Rosa Ficticia',
  cpf: '39053344705',
  cargo: 'Auxiliar de limpeza',
  salarioReferenciaCentavos: 245000,
  dataAdmissao: '2025-03-01',
  dataDesligamento: null,
};

function criarRepositorioFalso(opcoes: { lista?: FuncionarioRegistrado[]; existente?: FuncionarioRegistrado | null; cpfComOutro?: boolean }) {
  const chamadas = { criar: [] as Array<{ ativo: boolean }>, alterar: [] as Array<{ ativo: boolean; operacao: string }> };
  const repositorio = {
    listar: async () => opcoes.lista ?? [],
    buscarPorId: async () => opcoes.existente ?? null,
    outroAtivoComCpf: async () => (opcoes.cpfComOutro ? { id: 'f9', nome: 'Outra Pessoa' } : null),
    criar: async (dados: object, ativo: boolean) => {
      chamadas.criar.push({ ativo });
      return { ...rosa, ...dados };
    },
    alterar: async (_id: string, dados: object, ativo: boolean, operacao: string) => {
      chamadas.alterar.push({ ativo, operacao });
      return { ...(opcoes.existente ?? rosa), ...dados };
    },
  } as unknown as FuncionariosRepositorio;
  return { repositorio, chamadas };
}

const entrada = {
  nome: 'Rosa Ficticia',
  cpf: '39053344705',
  cargo: 'Auxiliar de limpeza',
  salarioReferenciaCentavos: 245000,
  dataAdmissao: '2025-03-01',
};

describe('funcionários [Cadastros.RF002]', () => {
  it('lista por situação calculada pela data de desligamento (fluxo A1)', async () => {
    const avisoPrevio = { ...rosa, id: 'f2', dataDesligamento: '2026-11-15' };
    const desligada = { ...rosa, id: 'f3', dataDesligamento: '2026-10-01' };
    const { repositorio } = criarRepositorioFalso({ lista: [rosa, avisoPrevio, desligada] });
    const ativos = await new ListarFuncionarios(repositorio).executar('ativos', HOJE);
    expect(ativos.map((f) => f.id)).toEqual(['f1', 'f2']);
    const inativos = await new ListarFuncionarios(repositorio).executar('inativos', HOJE);
    expect(inativos.map((f) => f.id)).toEqual(['f3']);
  });

  it('CPF de outro funcionário ativo não cria cadastro novo (fluxo E1)', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ cpfComOutro: true });
    await expect(new CriarFuncionario(repositorio).executar(entrada, AUTOR, HOJE)).rejects.toBeInstanceOf(ConflictException);
    expect(chamadas.criar).toEqual([]);
  });

  it('desligamento com data que já chegou inativa na hora e fica registrado como INATIVACAO', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: rosa });
    const resultado = await new AlterarFuncionario(repositorio).executar('f1', { dataDesligamento: HOJE }, AUTOR, HOJE);
    expect(chamadas.alterar).toEqual([{ ativo: false, operacao: 'INATIVACAO' }]);
    expect(resultado.ativo).toBe(false);
  });

  it('desligamento futuro mantém ativo até a data', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: rosa });
    await new AlterarFuncionario(repositorio).executar('f1', { dataDesligamento: '2026-11-30' }, AUTOR, HOJE);
    expect(chamadas.alterar).toEqual([{ ativo: true, operacao: 'ALTERACAO' }]);
  });

  it('readmitir (limpar o desligamento) confere se o CPF está com outro funcionário ativo', async () => {
    const desligada = { ...rosa, dataDesligamento: '2026-01-31' };
    const { repositorio } = criarRepositorioFalso({ existente: desligada, cpfComOutro: true });
    await expect(
      new AlterarFuncionario(repositorio).executar('f1', { dataDesligamento: null }, AUTOR, HOJE),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('funcionário inexistente responde 404', async () => {
    const { repositorio } = criarRepositorioFalso({ existente: null });
    await expect(new AlterarFuncionario(repositorio).executar('x', { cargo: 'Zelador' }, AUTOR, HOJE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import type { ListarAlunosCobraveis } from '../../cadastros/index.js';
import type { ParametrosRepositorio } from '../infra/parametros.repositorio.js';
import { AlterarParametrosDeCobranca } from './alterar-parametros-de-cobranca.js';
import { ConsultarParametrosDeCobranca } from './consultar-parametros-de-cobranca.js';

const validos = {
  valorMensalidadeCentavos: 8500,
  diaVencimento: 10,
  diaGeracao: 1,
  multaPercentual: 2,
  jurosMensalPercentual: 1,
  contaRecebimentoId: null,
  categoriaMensalidadeId: null,
  categoriaAvulsaId: null,
};

function repositorioFalso(vigentes: object | null) {
  const gravados: unknown[] = [];
  const repositorio = {
    buscarVigentes: async () => vigentes,
    encontrarDestino: async () => ({ conta: null, categoriaMensalidade: null, categoriaAvulsa: null }),
    gravar: async (parametros: unknown) => void gravados.push(parametros),
  } as unknown as ParametrosRepositorio;
  return { repositorio, gravados };
}

const doisAlunos = { executar: async () => [{}, {}] } as unknown as ListarAlunosCobraveis;

describe('parâmetros de cobrança [Administração.RF003]', () => {
  it('antes do primeiro cadastro, não há vigentes nem conferência', async () => {
    const { repositorio } = repositorioFalso(null);
    expect(await new ConsultarParametrosDeCobranca(repositorio, doisAlunos).executar('2026-10-26')).toEqual({
      vigentes: null,
      conferencia: null,
    });
  });

  it('a conferência usa os alunos cobráveis e a próxima geração', async () => {
    const { repositorio } = repositorioFalso({ ...validos, alteradoEm: new Date(), alteradoPor: 'Diretora' });
    const { conferencia } = await new ConsultarParametrosDeCobranca(repositorio, doisAlunos).executar('2026-10-26');
    expect(conferencia).toEqual({
      proximaGeracao: '2026-11-01',
      proximoVencimento: '2026-11-10',
      alunosCobrados: 2,
      totalPrevistoCentavos: 17000,
    });
  });

  it('grava parâmetros válidos e recusa geração depois do vencimento com 400 (fluxo E1)', async () => {
    const { repositorio, gravados } = repositorioFalso(null);
    await new AlterarParametrosDeCobranca(repositorio).executar(validos, 'usuario-1');
    expect(gravados).toEqual([validos]);
    await expect(
      new AlterarParametrosDeCobranca(repositorio).executar({ ...validos, diaGeracao: 20 }, 'usuario-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

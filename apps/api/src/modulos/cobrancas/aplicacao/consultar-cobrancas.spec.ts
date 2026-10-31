import { BadRequestException } from '@nestjs/common';
import type { CobrancaRegistrada, CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { ConsultarCobrancas } from './consultar-cobrancas.js';

const HOJE = '2026-10-26';

const cobranca: CobrancaRegistrada = {
  id: 'cob-1',
  idAsaas: 'pay_1',
  alunoId: 'a1',
  alunoNome: 'Ana Ficticia',
  origem: 'MENSALIDADE',
  referencia: '2026-10',
  descricao: 'Mensalidade de outubro',
  valorCentavos: 8500,
  vencimento: '2026-10-10',
  multaPercentual: 2,
  jurosMensalPercentual: 1,
  situacao: 'ABERTA',
  urlBoleto: null,
  urlFatura: null,
  pagaEm: null,
  justificativaManual: null,
  sincronizadaEm: null,
  canceladaEm: null,
  motivoCancelamento: null,
  renegociacaoDeId: null,
  renegociadaPorId: null,
};

describe('ConsultarCobrancas [Cobranças.RF008]', () => {
  it('aberta com vencimento passado sai como VENCIDA, com os dias de atraso', async () => {
    const filtrosRecebidos: unknown[] = [];
    const repositorio = {
      listar: async (filtros: unknown) => {
        filtrosRecebidos.push(filtros);
        return { itens: [cobranca], total: 1 };
      },
    } as unknown as CobrancasRepositorio;

    const resultado = await new ConsultarCobrancas(repositorio).executar({}, HOJE);

    expect(resultado.itens[0]).toMatchObject({ situacao: 'VENCIDA', diasDeAtraso: 16 });
    expect(filtrosRecebidos[0]).toMatchObject({ situacoes: ['ABERTA', 'VENCIDA'], pagina: 1 });
  });

  it('vencida há muito tempo pede sincronização, mas a herdada da planilha não (ADR-0005)', async () => {
    const antiga = { ...cobranca, vencimento: '2026-09-01' };
    const herdada = { ...antiga, id: 'cob-2', idAsaas: null, origem: 'HERDADA' as const };
    const repositorio = { listar: async () => ({ itens: [antiga, herdada], total: 2 }) } as unknown as CobrancasRepositorio;

    const { itens } = await new ConsultarCobrancas(repositorio).executar({}, HOJE);

    expect(itens[0]).toMatchObject({ situacao: 'VENCIDA', semSincronizarHaDias: 55 });
    expect(itens[1]).toMatchObject({ situacao: 'VENCIDA', diasDeAtraso: 55, semSincronizarHaDias: null });
  });

  it('filtro inválido responde 400 com o que fazer', async () => {
    const repositorio = { listar: async () => ({ itens: [], total: 0 }) } as unknown as CobrancasRepositorio;
    await expect(new ConsultarCobrancas(repositorio).executar({ situacoes: 'QUITADA' }, HOJE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

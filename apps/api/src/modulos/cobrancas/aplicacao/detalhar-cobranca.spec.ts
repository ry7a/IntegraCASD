import { NotFoundException } from '@nestjs/common';
import type { CobrancaRegistrada, CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { DetalharCobranca } from './detalhar-cobranca.js';

// Tudo fictício (LGPD).
const HOJE = '2026-10-26';
const cobranca: CobrancaRegistrada = {
  id: 'cob-1',
  idAsaas: 'pay_1',
  alunoId: 'a1',
  alunoNome: 'Ana Ficticia',
  origem: 'MENSALIDADE',
  referencia: '2026-09',
  descricao: 'Mensalidade de setembro/2026',
  valorCentavos: 12000,
  vencimento: '2026-10-05',
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

function montar(registro: CobrancaRegistrada | null) {
  const repositorio = {
    buscarPorId: async () => registro,
    historico: async () => [],
  } as unknown as CobrancasRepositorio;
  return new DetalharCobranca(repositorio);
}

describe('DetalharCobranca [Cobranças.RF008]', () => {
  it('cobrança do Asaas nunca sincronizada: pede sincronização', async () => {
    const detalhe = await montar(cobranca).executar('cob-1', HOJE);
    expect(detalhe).toMatchObject({ existeNoAsaas: true, sincronizacaoAntiga: true, podeCancelar: true });
  });

  it('herdada da planilha: sem Asaas e sem aviso de sincronização, mas cancela e recebe pagamento (ADR-0005)', async () => {
    const detalhe = await montar({ ...cobranca, idAsaas: null, origem: 'HERDADA' }).executar('cob-1', HOJE);
    expect(detalhe).toMatchObject({
      existeNoAsaas: false,
      sincronizacaoAntiga: false,
      podeCancelar: true,
      podeRegistrarPagamentoManual: true,
    });
  });

  it('inexistente: 404', async () => {
    await expect(montar(null).executar('x', HOJE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

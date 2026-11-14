import {
  avisoDaSituacaoNoAsaas,
  encargosDentroDosLimites,
  lerPeriodo,
  lerReferenciaDeMensalidade,
  periodoDaRotinaDiaria,
  semSincronizarHaDias,
  sincronizacaoAntiga,
} from './sincronizacao.js';
import { decidirConciliacao, type CobrancaAConciliar } from './conciliacao.js';

const noAsaas = { idAsaas: 'pay_ficticio_1', valorCentavos: 8500, pagoEm: '2026-10-20', disponivelEm: '2026-10-22', removida: false };
const aberta: CobrancaAConciliar = { situacao: 'ABERTA', valorCentavos: 8500, disponivelEm: null };
const HOJE = '2026-10-26';

describe('sincronização com o Asaas [Cobranças.RF007]', () => {
  it('traduz a situação no Asaas no aviso equivalente do webhook', () => {
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'CONFIRMED' })).toMatchObject({ tipo: 'PAYMENT_CONFIRMED', disponivelEm: null });
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'RECEIVED' })).toMatchObject({
      tipo: 'PAYMENT_RECEIVED',
      valorPagoCentavos: 8500,
      pagoEm: '2026-10-20',
      disponivelEm: '2026-10-22',
    });
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'RECEIVED_IN_CASH' }).tipo).toBe('PAYMENT_RECEIVED');
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'REFUNDED' }).tipo).toBe('PAYMENT_REFUNDED');
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'PENDING', removida: true }).tipo).toBe('PAYMENT_DELETED');
    // Situações sem efeito aqui não viram evento de pagamento.
    expect(avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'OVERDUE' }).tipo).toBe('SITUACAO_OVERDUE');
  });

  // Issue #65: a sincronização chega à mesma decisão que o webhook para o mesmo dado inválido.
  it('valor que no Asaas arredonda para zero centavo vira pendência, como no webhook', () => {
    const recebida = avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'RECEIVED', valorCentavos: 0 });
    expect(decidirConciliacao(recebida, aberta, HOJE)).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
  });

  it('data de pagamento inexistente vira pendência; data sem o formato AAAA-MM-DD vale hoje, como no webhook', () => {
    const inexistente = avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'CONFIRMED', pagoEm: '2026-02-30' });
    expect(decidirConciliacao(inexistente, aberta, HOJE)).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
    const semFormato = avisoDaSituacaoNoAsaas({ ...noAsaas, situacao: 'CONFIRMED', pagoEm: 'ontem à tarde' });
    expect(decidirConciliacao(semFormato, aberta, HOJE)).toMatchObject({ tipo: 'BAIXAR', pagoEm: HOJE });
  });

  it('reconhece a referência externa da mensalidade gerada aqui', () => {
    expect(lerReferenciaDeMensalidade('mensalidade:aaaaaaaa-0000-4000-8000-000000000001:2026-10')).toEqual({
      alunoId: 'aaaaaaaa-0000-4000-8000-000000000001',
      referencia: '2026-10',
    });
    expect(lerReferenciaDeMensalidade('outra-coisa')).toBeNull();
    expect(lerReferenciaDeMensalidade(null)).toBeNull();
  });

  it('mantém multa e juros de cobrança feita no painel dentro dos limites legais', () => {
    expect(encargosDentroDosLimites(2, 1)).toEqual({ multaPercentual: 2, jurosMensalPercentual: 1 });
    expect(encargosDentroDosLimites(10, 5)).toEqual({ multaPercentual: 2, jurosMensalPercentual: 1 });
    expect(encargosDentroDosLimites(-1, 0.4)).toEqual({ multaPercentual: 0, jurosMensalPercentual: 0 });
  });

  it('período: as duas datas, em ordem, até um ano', () => {
    expect(lerPeriodo({ vencimentoDe: '2026-10-01', vencimentoAte: '2026-10-31' })).toEqual({
      vencimentoDe: '2026-10-01',
      vencimentoAte: '2026-10-31',
    });
    expect(() => lerPeriodo({ vencimentoDe: '2026-10-31', vencimentoAte: '2026-10-01' })).toThrow(/antes da final/);
    expect(() => lerPeriodo({ vencimentoDe: '2025-01-01', vencimentoAte: '2026-10-01' })).toThrow(/um ano/);
    expect(() => lerPeriodo({ vencimentoDe: '2026-10-01' })).toThrow(/as duas datas/);
  });

  it('a rotina diária olha 90 dias para trás e 31 para a frente (fluxo A2)', () => {
    expect(periodoDaRotinaDiaria('2026-10-26')).toEqual({ vencimentoDe: '2026-07-28', vencimentoAte: '2026-11-26' });
  });

  it('vencida sem sincronizar há mais de sete dias é sinalizada na lista [Cobranças.RF008]', () => {
    expect(semSincronizarHaDias('VENCIDA', '2026-10-01', '2026-10-18', '2026-10-26')).toBe(8);
    expect(semSincronizarHaDias('VENCIDA', '2026-10-01', '2026-10-19', '2026-10-26')).toBeNull();
    expect(semSincronizarHaDias('VENCIDA', '2026-10-10', null, '2026-10-26')).toBe(16);
    expect(semSincronizarHaDias('ABERTA', '2026-10-01', null, '2026-10-26')).toBeNull();
  });

  it('no detalhe, sincronização que não é de hoje é recomendada antes do pagamento manual', () => {
    expect(sincronizacaoAntiga(null, '2026-10-26')).toBe(true);
    expect(sincronizacaoAntiga('2026-10-25', '2026-10-26')).toBe(true);
    expect(sincronizacaoAntiga('2026-10-26', '2026-10-26')).toBe(false);
  });
});

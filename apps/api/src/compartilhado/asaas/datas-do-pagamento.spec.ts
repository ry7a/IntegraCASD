import { dataDoAsaas, dataDoPagamentoNoAsaas } from './datas-do-pagamento.js';

// Spec #57, história 22: o webhook e a sincronização leem as datas do pagamento pela mesma função.
// Datas fictícias.
describe('datas de um pagamento do Asaas', () => {
  it('lê o AAAA-MM-DD do começo do texto, ainda sem conferir o calendário', () => {
    expect(dataDoAsaas('2026-10-20')).toBe('2026-10-20');
    expect(dataDoAsaas('2026-10-20 13:45:00')).toBe('2026-10-20');
    // Quem decide o que fazer com a data inexistente é a conciliação (vira pendência).
    expect(dataDoAsaas('2026-02-30')).toBe('2026-02-30');
  });

  it('o que não tem forma de data conta como não informado', () => {
    for (const valor of ['ontem', '20/10/2026', '', 20261020, null, undefined]) {
      expect(dataDoAsaas(valor)).toBeNull();
    }
  });

  it('data do pagamento: a primeira com forma de data entre paymentDate, clientPaymentDate e confirmedDate', () => {
    expect(dataDoPagamentoNoAsaas({ paymentDate: '2026-10-20', clientPaymentDate: '2026-10-19' })).toBe('2026-10-20');
    expect(dataDoPagamentoNoAsaas({ paymentDate: null, clientPaymentDate: '2026-10-19', confirmedDate: '2026-10-18' })).toBe('2026-10-19');
    expect(dataDoPagamentoNoAsaas({ confirmedDate: '2026-10-18' })).toBe('2026-10-18');
    expect(dataDoPagamentoNoAsaas({})).toBeNull();
  });

  it('cada campo é conferido antes de passar ao próximo: um paymentDate malformado não esconde um clientPaymentDate válido', () => {
    expect(dataDoPagamentoNoAsaas({ paymentDate: 'ontem', clientPaymentDate: '2026-10-19' })).toBe('2026-10-19');
    expect(dataDoPagamentoNoAsaas({ paymentDate: 'ontem', clientPaymentDate: 42, confirmedDate: '2026-10-18' })).toBe('2026-10-18');
  });

  it('um paymentDate com forma de data, mesmo inexistente, é o que vale (a conciliação o manda para conferência)', () => {
    expect(dataDoPagamentoNoAsaas({ paymentDate: '2026-02-30', clientPaymentDate: '2026-02-27' })).toBe('2026-02-30');
  });
});

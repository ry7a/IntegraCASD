import {
  deveGerarAgora,
  descricaoDaMensalidade,
  motivoDoCadastroIncompleto,
  referenciaDoCiclo,
  vencimentoDaMensalidade,
} from './geracao-recorrente.js';

describe('geração recorrente [Cobranças.RF001]', () => {
  it('o mês de referência começa no dia de geração', () => {
    expect(referenciaDoCiclo('2026-11-01', 1)).toBe('2026-11');
    expect(referenciaDoCiclo('2026-11-04', 5)).toBeNull();
  });

  it('vence no dia de vencimento do mês; se a geração atrasou demais, vence hoje', () => {
    expect(vencimentoDaMensalidade('2026-11', 10, '2026-11-01')).toBe('2026-11-10');
    expect(vencimentoDaMensalidade('2026-11', 10, '2026-11-15')).toBe('2026-11-15');
  });

  it('descreve a mensalidade pelo mês', () => {
    expect(descricaoDaMensalidade('2026-03')).toBe('Mensalidade de março/2026');
  });

  it('gera no dia (ou depois, se perdeu o dia) e só uma vez por mês, salvo interrupção (fluxos A1 e E1)', () => {
    expect(deveGerarAgora('2026-11-01', 1, null)).toBe(true);
    expect(deveGerarAgora('2026-11-03', 1, null)).toBe(true);
    expect(deveGerarAgora('2026-11-03', 1, { interrompida: false })).toBe(false);
    expect(deveGerarAgora('2026-11-03', 1, { interrompida: true })).toBe(true);
    expect(deveGerarAgora('2026-10-30', 31, null)).toBe(false);
  });

  it('cadastro incompleto diz o campo que falta (fluxo A2)', () => {
    expect(motivoDoCadastroIncompleto('')).toMatch(/e-mail/);
    expect(motivoDoCadastroIncompleto('a@exemplo.com')).toMatch(/CPF/);
  });
});

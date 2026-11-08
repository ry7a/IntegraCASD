import {
  deveGerarAgora,
  descricaoDaMensalidade,
  motivoDaReferenciaBloqueada,
  motivoDoCadastroIncompleto,
  referenciaDoCiclo,
  referenciaLiberada,
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

describe('trava do início da geração (GERACAO_A_PARTIR_DE)', () => {
  it('sem trava, toda referência está liberada', () => {
    expect(referenciaLiberada('2027-01', null)).toBe(true);
    expect(referenciaLiberada('2020-05', null)).toBe(true);
  });

  it('bloqueia o mês anterior e libera o próprio mês e os seguintes', () => {
    expect(referenciaLiberada('2027-01', '2027-02')).toBe(false);
    expect(referenciaLiberada('2027-02', '2027-02')).toBe(true);
    expect(referenciaLiberada('2027-03', '2027-02')).toBe(true);
  });

  it('compara certo na virada do ano', () => {
    expect(referenciaLiberada('2026-12', '2027-02')).toBe(false);
    expect(referenciaLiberada('2026-11', '2027-01')).toBe(false);
    expect(referenciaLiberada('2028-01', '2027-12')).toBe(true);
  });

  it('trava em formato inválido bloqueia tudo (melhor não gerar do que cobrar em dobro)', () => {
    for (const invalida of ['2027-2', '2027-13', '2027-00', 'fevereiro/2027', '202702']) {
      expect(referenciaLiberada('2030-01', invalida)).toBe(false);
    }
  });

  it('o motivo diz o mês em que a geração começa, ou que a variável está inválida', () => {
    expect(motivoDaReferenciaBloqueada('2027-02')).toBe('A geração do sistema começa em fevereiro/2027 (GERACAO_A_PARTIR_DE).');
    expect(motivoDaReferenciaBloqueada('2027-13')).toMatch(/GERACAO_A_PARTIR_DE \("2027-13"\) não está no formato AAAA-MM/);
  });
});

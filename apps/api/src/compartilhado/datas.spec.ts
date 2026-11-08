import { deDia, hojeEmSaoPaulo, mesNoFormatoAAAAMM, paraDia } from './datas.js';

describe('datas', () => {
  it('"hoje" é o dia em São Paulo, mesmo quando em UTC já é o dia seguinte', () => {
    // 22h de 26/10 em Brasília = 01h de 27/10 em UTC.
    expect(hojeEmSaoPaulo(new Date('2026-10-27T01:00:00Z'))).toBe('2026-10-26');
  });

  it('converte entre "AAAA-MM-DD" e a coluna de data do banco sem mudar o dia', () => {
    expect(paraDia(deDia('2026-02-28'))).toBe('2026-02-28');
  });

  it('mês "AAAA-MM": quatro dígitos de ano e mês de 01 a 12', () => {
    for (const valido of ['2027-02', '2026-12', '2027-01']) expect(mesNoFormatoAAAAMM(valido)).toBe(true);
    for (const invalido of ['2027-2', '2027-13', '2027-00', '27-02', '2027-02-01', ' 2027-02', '2027/02', '']) {
      expect(mesNoFormatoAAAAMM(invalido)).toBe(false);
    }
  });
});

import { lerCentavos, lerDia, lerInteiroNaoNegativo, lerMes, lerTexto } from './leitura-de-entrada.js';

// Valor-limite e partição de equivalência de cada leitura ([Usabilidade.NF002] fica com cada módulo:
// aqui só se confere o valor lido ou o motivo da recusa).

describe('dia "AAAA-MM-DD"', () => {
  it('aceita um dia que existe no calendário', () => {
    expect(lerDia('2026-02-28')).toEqual({ valido: true, valor: '2026-02-28' });
  });

  it('recusa por formato o que não é texto "AAAA-MM-DD"', () => {
    for (const invalido of ['28/02/2026', '2026-2-28', '2026-02-28T00:00:00Z', ' 2026-02-28', '', 20260228, null, undefined, ['2026-02-28']]) {
      expect(lerDia(invalido), String(invalido)).toEqual({ valido: false, motivo: 'formato' });
    }
  });

  it('29/02 só existe em ano bissexto (2028 é; 2026 não; 2000 é; 2100 não)', () => {
    expect(lerDia('2028-02-29')).toEqual({ valido: true, valor: '2028-02-29' });
    expect(lerDia('2000-02-29')).toEqual({ valido: true, valor: '2000-02-29' });
    expect(lerDia('2026-02-29')).toEqual({ valido: false, motivo: 'inexistente' });
    expect(lerDia('2100-02-29')).toEqual({ valido: false, motivo: 'inexistente' });
  });

  it('recusa como inexistente o dia que não está no calendário: 30/02, 31/04, dia 00, mês 00 e 13', () => {
    for (const inexistente of ['2026-02-30', '2026-04-31', '2026-01-00', '2026-01-32', '2026-00-10', '2026-13-10']) {
      expect(lerDia(inexistente), inexistente).toEqual({ valido: false, motivo: 'inexistente' });
    }
    expect(lerDia('2026-04-30')).toEqual({ valido: true, valor: '2026-04-30' });
    expect(lerDia('2026-12-31')).toEqual({ valido: true, valor: '2026-12-31' });
  });

  it('aceita ano de 1900 a 9999 e recusa como abaixo do mínimo o que vem antes', () => {
    expect(lerDia('1900-01-01')).toEqual({ valido: true, valor: '1900-01-01' });
    expect(lerDia('9999-12-31')).toEqual({ valido: true, valor: '9999-12-31' });
    expect(lerDia('1899-12-31')).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
    expect(lerDia('0000-01-01')).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
  });
});

describe('mês "AAAA-MM"', () => {
  it('aceita o mês de 01 a 12 e recusa por formato o que não é texto "AAAA-MM"', () => {
    expect(lerMes('2026-01')).toEqual({ valido: true, valor: '2026-01' });
    expect(lerMes('2026-12')).toEqual({ valido: true, valor: '2026-12' });
    for (const invalido of ['2026-1', '26-11', '2026/11', '2026-11-01', ' 2026-11', '', 202611, null, undefined]) {
      expect(lerMes(invalido), String(invalido)).toEqual({ valido: false, motivo: 'formato' });
    }
  });

  it('mês 00 e 13 não existem; ano antes de 1900 fica abaixo do mínimo (como "0000-01")', () => {
    expect(lerMes('2026-00')).toEqual({ valido: false, motivo: 'inexistente' });
    expect(lerMes('2026-13')).toEqual({ valido: false, motivo: 'inexistente' });
    expect(lerMes('0000-01')).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
    expect(lerMes('1899-12')).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
    expect(lerMes('1900-01')).toEqual({ valido: true, valor: '1900-01' });
    expect(lerMes('9999-12')).toEqual({ valido: true, valor: '9999-12' });
  });
});

describe('centavos: inteiro de 1 a 2.147.483.647 (o Int do PostgreSQL)', () => {
  it('aceita de 1 centavo até o limite da coluna', () => {
    expect(lerCentavos(1)).toEqual({ valido: true, valor: 1 });
    expect(lerCentavos(8500)).toEqual({ valido: true, valor: 8500 });
    expect(lerCentavos(2_147_483_647)).toEqual({ valido: true, valor: 2_147_483_647 });
  });

  it('recusa zero e negativo como abaixo do mínimo, e o que passa do limite (2^31 e 1e21) como acima do máximo', () => {
    for (const abaixo of [0, -1, -4500]) {
      expect(lerCentavos(abaixo), String(abaixo)).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
    }
    for (const acima of [2_147_483_648, 1e21]) {
      expect(lerCentavos(acima), String(acima)).toEqual({ valido: false, motivo: 'acima-do-maximo' });
    }
  });

  it('recusa por formato fração de centavo, texto (mesmo "4500"), NaN, infinito e outros tipos', () => {
    for (const invalido of [45.5, 0.001, '4500', 'R$ 45,00', '', Number.NaN, Number.POSITIVE_INFINITY, null, undefined, [4500], { $gt: 0 }]) {
      expect(lerCentavos(invalido), JSON.stringify(invalido)).toEqual({ valido: false, motivo: 'formato' });
    }
  });
});

describe('inteiro não negativo: de 0 a 2.147.483.647 (página, matrícula)', () => {
  it('aceita de zero até o limite da coluna', () => {
    expect(lerInteiroNaoNegativo(0)).toEqual({ valido: true, valor: 0 });
    expect(lerInteiroNaoNegativo(2041)).toEqual({ valido: true, valor: 2041 });
    expect(lerInteiroNaoNegativo(2_147_483_647)).toEqual({ valido: true, valor: 2_147_483_647 });
  });

  it('recusa negativo como abaixo do mínimo, e o que passa do limite (2^31, 1e300) como acima do máximo', () => {
    expect(lerInteiroNaoNegativo(-1)).toEqual({ valido: false, motivo: 'abaixo-do-minimo' });
    for (const acima of [2_147_483_648, 1e300]) {
      expect(lerInteiroNaoNegativo(acima), String(acima)).toEqual({ valido: false, motivo: 'acima-do-maximo' });
    }
  });

  it('recusa por formato fração, texto e outros tipos', () => {
    for (const invalido of [12.5, '12', 'doze', '', Number.NaN, null, undefined, [1]]) {
      expect(lerInteiroNaoNegativo(invalido), String(invalido)).toEqual({ valido: false, motivo: 'formato' });
    }
  });
});

describe('texto: aparado, sem caractere nulo, até o tamanho máximo de quem chama', () => {
  it('tira os espaços das pontas e junta os repetidos no meio', () => {
    expect(lerTexto('  Camiseta \t do   CASD \n', 200)).toEqual({ valido: true, valor: 'Camiseta do CASD' });
  });

  it('só espaços vira texto vazio: se o campo é obrigatório, quem chama decide', () => {
    expect(lerTexto('     ', 200)).toEqual({ valido: true, valor: '' });
  });

  it('aceita no tamanho máximo (contado depois de aparar) e recusa um acima como acima do máximo', () => {
    expect(lerTexto(`  ${'a'.repeat(120)}  `, 120)).toEqual({ valido: true, valor: 'a'.repeat(120) });
    expect(lerTexto('a'.repeat(121), 120)).toEqual({ valido: false, motivo: 'acima-do-maximo' });
  });

  it('recusa o caractere nulo, que o PostgreSQL não grava, em qualquer ponto do texto', () => {
    for (const comNulo of ['Aluno\u0000 Ficticio', '\u0000', 'Ficticio\u0000']) {
      expect(lerTexto(comNulo, 200), JSON.stringify(comNulo)).toEqual({ valido: false, motivo: 'caractere-nulo' });
    }
  });

  it('recusa por formato o que não é texto', () => {
    for (const invalido of [12345, null, undefined, ['texto'], { primeiro: 'Aluno' }]) {
      expect(lerTexto(invalido, 200), JSON.stringify(invalido)).toEqual({ valido: false, motivo: 'formato' });
    }
  });
});

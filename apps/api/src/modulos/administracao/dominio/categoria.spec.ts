import {
  RegraDaCategoriaViolada,
  conferirTrocaDeTipo,
  lerSituacao,
  lerTipo,
  normalizarNome,
} from './categoria.js';

describe('normalizarNome', () => {
  it('tira espaços das pontas e espaços repetidos no meio', () => {
    expect(normalizarNome('  Material   de limpeza ')).toBe('Material de limpeza');
  });

  it('recusa nome vazio, curto demais ou que não é texto', () => {
    expect(() => normalizarNome('   ')).toThrow(RegraDaCategoriaViolada);
    expect(() => normalizarNome('A')).toThrow(RegraDaCategoriaViolada);
    expect(() => normalizarNome(undefined)).toThrow(RegraDaCategoriaViolada);
  });

  it('aceita até 60 caracteres e recusa mais que isso', () => {
    expect(normalizarNome('x'.repeat(60))).toHaveLength(60);
    expect(() => normalizarNome('x'.repeat(61))).toThrow(RegraDaCategoriaViolada);
  });
});

describe('lerTipo e lerSituacao', () => {
  it('aceita só ENTRADA, SAIDA ou AMBOS', () => {
    expect(lerTipo('AMBOS')).toBe('AMBOS');
    expect(() => lerTipo('ENTRADAS')).toThrow(RegraDaCategoriaViolada);
  });

  it('a situação precisa ser verdadeiro ou falso', () => {
    expect(lerSituacao(false)).toBe(false);
    expect(() => lerSituacao('false')).toThrow(RegraDaCategoriaViolada);
  });
});

describe('conferirTrocaDeTipo', () => {
  it('não deixa virar "só entradas" uma categoria que já classifica saídas', () => {
    expect(() => conferirTrocaDeTipo('ENTRADA', { entradas: 0, saidas: 3 })).toThrow(/3 saída/);
  });

  it('não deixa virar "só saídas" uma categoria que já classifica entradas', () => {
    expect(() => conferirTrocaDeTipo('SAIDA', { entradas: 1, saidas: 0 })).toThrow(/1 entrada/);
  });

  it('ampliar para AMBOS é sempre permitido', () => {
    expect(() => conferirTrocaDeTipo('AMBOS', { entradas: 5, saidas: 5 })).not.toThrow();
  });

  it('categoria sem uso pode trocar de tipo à vontade', () => {
    expect(() => conferirTrocaDeTipo('ENTRADA', { entradas: 0, saidas: 0 })).not.toThrow();
  });
});

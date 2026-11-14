import { MovimentacaoInvalida, lerFiltros, lerNovaMovimentacao, limitesDoMes, regraDoEstorno } from './movimentacao.js';

const HOJE = '2026-10-26';

// Entradas que vinham de fora do jeito que o CT-FZ-02 mandou e davam 500 ou gravavam outra data (D4 a D6).
describe('leitura do lançamento: data, valor e descrição [Movimentações.RF001] [Usabilidade.NF002]', () => {
  const valida = {
    contaId: '11111111-1111-4111-8111-111111111111',
    tipo: 'SAIDA',
    valorCentavos: 120000,
    data: '2026-10-20',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    forma: 'PIX',
    descricao: 'NF 685, limpeza de outubro',
  };

  it.each(['2025-02-30', '2025-04-31', '2025-13-01', '2025-00-10', '0000-00-00'])('recusa a data %s, que não existe no calendário', (data) => {
    expect(() => lerNovaMovimentacao({ ...valida, data }, HOJE)).toThrow('A data não existe no calendário. Confira o dia e o mês.');
  });

  it('recusa ano antes de 1900, o limite de toda data lida pela regra comum', () => {
    expect(() => lerNovaMovimentacao({ ...valida, data: '1899-12-31' }, HOJE)).toThrow('Confira o ano da data: ele precisa estar entre 1900 e 9999.');
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(lerNovaMovimentacao({ ...valida, data: '2024-02-29' }, HOJE).data).toBe('2024-02-29');
  });

  it.each([2_147_483_648, 1e21])('recusa o valor %d centavos, acima do que a coluna do banco guarda', (valorCentavos) => {
    expect(() => lerNovaMovimentacao({ ...valida, valorCentavos }, HOJE)).toThrow(
      'O valor passa do limite do sistema (R$ 21.474.836,47). Confira se não sobrou zero.',
    );
  });

  it('aceita o maior valor que a coluna do banco guarda (2^31 - 1 centavos)', () => {
    expect(lerNovaMovimentacao({ ...valida, valorCentavos: 2_147_483_647 }, HOJE).valorCentavos).toBe(2_147_483_647);
  });

  it.each([0, -1, 10.5, '120000'])('recusa o valor %s pedindo centavos inteiros maiores que zero', (valorCentavos) => {
    expect(() => lerNovaMovimentacao({ ...valida, valorCentavos }, HOJE)).toThrow(/valor maior que zero, em centavos inteiros/);
  });

  it('recusa descrição com caractere nulo, que o PostgreSQL não grava', () => {
    expect(() => lerNovaMovimentacao({ ...valida, descricao: 'NF 687\u0000 limpeza' }, HOJE)).toThrow(
      'Há um caractere invisível (nulo) na descrição, comum ao colar de outro programa. Apague e digite de novo.',
    );
  });

  it('descrição: 200 caracteres passam; 201, só espaços ou que não é texto são recusados', () => {
    expect(lerNovaMovimentacao({ ...valida, descricao: 'x'.repeat(200) }, HOJE).descricao).toHaveLength(200);
    expect(() => lerNovaMovimentacao({ ...valida, descricao: 'x'.repeat(201) }, HOJE)).toThrow('Use no máximo 200 caracteres na descrição.');
    expect(() => lerNovaMovimentacao({ ...valida, descricao: '    ' }, HOJE)).toThrow(/Descreva a movimentação/);
    expect(() => lerNovaMovimentacao({ ...valida, descricao: 685 }, HOJE)).toThrow(/Descreva a movimentação/);
  });
});

describe('consulta de movimentações [Movimentações.RF003]', () => {
  it('sem filtros, mostra o mês corrente com estornos', () => {
    expect(lerFiltros({}, HOJE)).toEqual({
      mes: '2026-10',
      tipo: null,
      categoriaId: null,
      forma: null,
      contratoId: null,
      projetoId: null,
      ocultarEstornos: false,
    });
  });

  it('lê os filtros que chegam da URL, como texto', () => {
    const categoriaId = '11111111-1111-4111-8111-111111111111';
    expect(lerFiltros({ mes: '2026-09', tipo: 'SAIDA', categoriaId, forma: 'PIX', ocultarEstornos: 'true' }, HOJE)).toMatchObject({
      mes: '2026-09',
      tipo: 'SAIDA',
      categoriaId,
      forma: 'PIX',
      ocultarEstornos: true,
    });
  });

  it('recusa mês, tipo, forma ou id inválidos', () => {
    expect(() => lerFiltros({ mes: '2026-13' }, HOJE)).toThrow(MovimentacaoInvalida);
    expect(() => lerFiltros({ tipo: 'OUTRO' }, HOJE)).toThrow(/ENTRADA ou SAIDA/);
    expect(() => lerFiltros({ forma: 'BOLETO' }, HOJE)).toThrow(/forma de pagamento/);
    expect(() => lerFiltros({ projetoId: 'abc' }, HOJE)).toThrow(/projeto/);
  });

  // D4: "0000-01" passava no formato e estourava no banco (500).
  it.each(['0000-01', '1899-12'])('recusa o mês %s, com ano fora de 1900 a 9999', (mes) => {
    expect(() => lerFiltros({ mes }, HOJE)).toThrow('Confira o ano do mês: ele precisa estar entre 1900 e 9999.');
  });

  it.each(['2026-00', '2026-13'])('recusa o mês %s, que não existe', (mes) => {
    expect(() => lerFiltros({ mes }, HOJE)).toThrow('O mês vai de 01 a 12. Informe o mês no formato AAAA-MM.');
  });

  it.each(['2026-1', '10/2026', ['2026-09', '2026-10']])('recusa o mês %s, fora do formato AAAA-MM', (mes) => {
    expect(() => lerFiltros({ mes }, HOJE)).toThrow('Informe o mês no formato AAAA-MM.');
  });

  it('aceita os meses dos extremos: janeiro de 1900 e dezembro de 9999', () => {
    expect(lerFiltros({ mes: '1900-01' }, HOJE).mes).toBe('1900-01');
    expect(lerFiltros({ mes: '9999-12' }, HOJE).mes).toBe('9999-12');
  });

  it('o mês vai do dia 1 ao último dia, inclusive fevereiro de ano bissexto', () => {
    expect(limitesDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(limitesDoMes('2028-02')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
  });
});

describe('quem pode ser estornado [Movimentações.RF002]', () => {
  it('só lançamento manual ainda não estornado', () => {
    expect(regraDoEstorno('MANUAL', false)).toEqual({ podeEstornar: true, motivoSemEstorno: null });
    expect(regraDoEstorno('MANUAL', true)).toMatchObject({ podeEstornar: false, motivoSemEstorno: expect.stringMatching(/já foi estornada/) });
    expect(regraDoEstorno('ESTORNO', false).podeEstornar).toBe(false);
  });

  it('movimentação de cobrança é tratada pela cobrança (fluxo E1)', () => {
    for (const origem of ['CONCILIACAO_AUTOMATICA', 'REGISTRO_MANUAL_DE_COBRANCA'] as const) {
      expect(regraDoEstorno(origem, false)).toMatchObject({ podeEstornar: false, motivoSemEstorno: expect.stringMatching(/trate pela cobrança/) });
    }
  });
});

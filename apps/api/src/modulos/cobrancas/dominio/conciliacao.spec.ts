import { decidirConciliacao, lerAvisoDePagamento, reaisParaCentavos, type CobrancaAConciliar } from './conciliacao.js';

const HOJE = '2026-10-26';

// Corpo no formato do webhook do Asaas, com dados fictícios.
function aviso(tipo: string, pagamento: Record<string, unknown> = {}) {
  return lerAvisoDePagamento(tipo, {
    id: 'evt_ficticio_1',
    event: tipo,
    payment: { id: 'pay_ficticio_1', value: 85.5, paymentDate: '2026-10-20', ...pagamento },
  });
}

function cobranca(situacao: CobrancaAConciliar['situacao'], disponivelEm: string | null = null): CobrancaAConciliar {
  return { situacao, valorCentavos: 8500, disponivelEm };
}

describe('leitura do aviso do Asaas', () => {
  it('converte reais em centavos sem erro de arredondamento', () => {
    expect(reaisParaCentavos(85.5)).toBe(8550);
    expect(reaisParaCentavos(0.29)).toBe(29);
    expect(reaisParaCentavos(1234.57)).toBe(123457);
  });

  it('lê id, valor pago, data do pagamento e data de crédito', () => {
    expect(aviso('PAYMENT_RECEIVED', { creditDate: '2026-10-22' })).toEqual({
      tipo: 'PAYMENT_RECEIVED',
      idCobrancaAsaas: 'pay_ficticio_1',
      valorPagoCentavos: 8550,
      pagoEm: '2026-10-20',
      disponivelEm: '2026-10-22',
    });
  });

  // Spec #57, história 22: o mesmo caso do teste do cliente HTTP (cliente-asaas.http.spec.ts), que alimenta
  // a sincronização. Os dois caminhos chegam à mesma data.
  it('o paymentDate malformado não esconde o clientPaymentDate válido, como na sincronização', () => {
    expect(aviso('PAYMENT_RECEIVED', { paymentDate: 'ontem', clientPaymentDate: '2026-10-09', creditDate: 'amanhã' })).toMatchObject({
      pagoEm: '2026-10-09',
      disponivelEm: null,
    });
  });

  it('evento sem cobrança não aponta para cobrança nenhuma', () => {
    expect(lerAvisoDePagamento('ACCOUNT_STATUS_UPDATED', { id: 'evt_x', event: 'ACCOUNT_STATUS_UPDATED' }).idCobrancaAsaas).toBeNull();
  });
});

describe('conciliação [Cobranças.RF005]', () => {
  it('pagamento confirmado baixa a cobrança aberta com o valor efetivamente pago', () => {
    expect(decidirConciliacao(aviso('PAYMENT_CONFIRMED'), cobranca('ABERTA'), HOJE)).toEqual({
      tipo: 'BAIXAR',
      valorPagoCentavos: 8550,
      pagoEm: '2026-10-20',
      disponivelEm: null,
    });
  });

  it('pagamento recebido baixa e já informa quando o valor fica disponível (fluxo A1)', () => {
    expect(decidirConciliacao(aviso('PAYMENT_RECEIVED', { creditDate: '2026-10-22' }), cobranca('ABERTA'), HOJE)).toMatchObject({
      tipo: 'BAIXAR',
      disponivelEm: '2026-10-22',
    });
  });

  it('recebido depois do confirmado só marca a disponibilidade, sem segunda entrada (fluxo A1)', () => {
    expect(decidirConciliacao(aviso('PAYMENT_RECEIVED', { creditDate: '2026-10-22' }), cobranca('PAGA'), HOJE)).toEqual({
      tipo: 'MARCAR_DISPONIVEL',
      disponivelEm: '2026-10-22',
    });
    expect(decidirConciliacao(aviso('PAYMENT_RECEIVED'), cobranca('PAGA', '2026-10-21'), HOJE)).toEqual({ tipo: 'NADA' });
    expect(decidirConciliacao(aviso('PAYMENT_CONFIRMED'), cobranca('PAGA'), HOJE)).toEqual({ tipo: 'NADA' });
  });

  it('sem valor no aviso, usa o valor da cobrança; sem data, usa hoje', () => {
    const semDados = lerAvisoDePagamento('PAYMENT_CONFIRMED', { payment: { id: 'pay_ficticio_1' } });
    expect(decidirConciliacao(semDados, cobranca('ABERTA'), HOJE)).toMatchObject({ valorPagoCentavos: 8500, pagoEm: HOJE });
  });

  it('estorno de cobrança paga leva a "Estornada"; repetido não faz nada', () => {
    expect(decidirConciliacao(aviso('PAYMENT_REFUNDED'), cobranca('PAGA'), HOJE)).toEqual({ tipo: 'ESTORNAR' });
    expect(decidirConciliacao(aviso('PAYMENT_REFUNDED'), cobranca('ESTORNADA'), HOJE)).toEqual({ tipo: 'NADA' });
  });

  it('cobrança removida no painel do Asaas é cancelada aqui', () => {
    expect(decidirConciliacao(aviso('PAYMENT_DELETED'), cobranca('ABERTA'), HOJE)).toEqual({ tipo: 'CANCELAR' });
    expect(decidirConciliacao(aviso('PAYMENT_DELETED'), cobranca('CANCELADA'), HOJE)).toEqual({ tipo: 'NADA' });
  });

  it('vencimento, criação e atualização não mudam nada ("Vencida" é calculada)', () => {
    for (const tipo of ['PAYMENT_OVERDUE', 'PAYMENT_CREATED', 'PAYMENT_UPDATED']) {
      expect(decidirConciliacao(aviso(tipo), cobranca('ABERTA'), HOJE)).toEqual({ tipo: 'NADA' });
    }
  });

  it('pagamento de cobrança que não existe aqui vira pendência, sem descartar o aviso (fluxo E1)', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED'), null, HOJE);
    expect(acao).toMatchObject({ tipo: 'PENDENCIA' });
    expect(acao.tipo === 'PENDENCIA' && acao.motivo).toMatch(/pay_ficticio_1.*Sincronize/);
    // Remoção de algo que nunca existiu aqui não pede conferência.
    expect(decidirConciliacao(aviso('PAYMENT_DELETED'), null, HOJE)).toEqual({ tipo: 'NADA' });
  });

  it('pagamento no Asaas de cobrança já registrada à mão não cria segunda entrada [Cobranças.RF006]', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_CONFIRMED'), cobranca('PAGA_COM_REGISTRO_MANUAL'), HOJE);
    expect(acao.tipo).toBe('PENDENCIA');
    expect(acao.tipo === 'PENDENCIA' && acao.motivo).toMatch(/duas vezes/);
  });

  it('pagamento de cobrança cancelada pede conferência', () => {
    expect(decidirConciliacao(aviso('PAYMENT_RECEIVED'), cobranca('CANCELADA'), HOJE).tipo).toBe('PENDENCIA');
  });

  it('aviso de pagamento atrasado, chegando depois do estorno, não faz nada', () => {
    expect(decidirConciliacao(aviso('PAYMENT_CONFIRMED'), cobranca('ESTORNADA'), HOJE)).toEqual({ tipo: 'NADA' });
  });
});

// Defeitos D4, D5 e D8 do Plano de Testes (issue #65): dado presente e inválido não baixa com data
// inventada nem trava a fila; vira pendência de divergência, com o campo no motivo.
describe('aviso do Asaas com data ou valor inválido [Cobranças.RF005]', () => {
  function motivo(acao: ReturnType<typeof decidirConciliacao>): string {
    return acao.tipo === 'PENDENCIA' ? acao.motivo : `sem pendência: ${acao.tipo}`;
  }

  it('data do pagamento que não existe no calendário vira pendência, sem baixar', () => {
    for (const paymentDate of ['2026-02-30', '2026-13-45']) {
      const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED', { paymentDate }), cobranca('ABERTA'), HOJE);
      expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA', idCobrancaAsaas: 'pay_ficticio_1' });
      expect(motivo(acao)).toContain(`data do pagamento (${paymentDate})`);
    }
  });

  it('data com ano fora de 1900 a 9999 vira pendência, com o motivo certo', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_CONFIRMED', { paymentDate: '1899-12-31' }), cobranca('ABERTA'), HOJE);
    expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
    expect(motivo(acao)).toContain('data do pagamento (1899-12-31) está fora dos anos aceitos');
  });

  it('data de crédito que não existe no calendário vira pendência, sem baixar', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED', { creditDate: '2026-04-31' }), cobranca('ABERTA'), HOJE);
    expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
    expect(motivo(acao)).toContain('data de crédito (2026-04-31)');
  });

  it('valor pago de 0,001 real, que em centavos dá zero, vira pendência (D8)', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED', { value: 0.001 }), cobranca('ABERTA'), HOJE);
    expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
    expect(motivo(acao)).toMatch(/valor pago.*zero centavo/);
  });

  it('valor pago acima do que a coluna guarda vira pendência (D5)', () => {
    // Um trilhão de reais, e 21.474.836,48 reais: um centavo acima do maior inteiro do banco.
    for (const value of [1_000_000_000_000, 21_474_836.48]) {
      const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED', { value }), cobranca('ABERTA'), HOJE);
      expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
      expect(motivo(acao)).toMatch(/valor pago.*maior valor que o sistema guarda/);
    }
  });

  it('valor negativo ou em texto e data que não é data contam como não informados, como hoje', () => {
    // As mesmas entradas do CT-FZ-01: o worker usa o valor da cobrança e a data de hoje.
    const estranho = aviso('PAYMENT_RECEIVED', { value: -85, paymentDate: 'ontem à tarde' });
    expect(decidirConciliacao(estranho, cobranca('ABERTA'), HOJE)).toMatchObject({ tipo: 'BAIXAR', valorPagoCentavos: 8500, pagoEm: HOJE });
    const emTexto = aviso('PAYMENT_RECEIVED', { value: '85,00' });
    expect(decidirConciliacao(emTexto, cobranca('ABERTA'), HOJE)).toMatchObject({ tipo: 'BAIXAR', valorPagoCentavos: 8500 });
  });

  it('recebido depois do confirmado, com data de crédito inexistente, vira pendência em vez de marcar a disponibilidade', () => {
    const acao = decidirConciliacao(aviso('PAYMENT_RECEIVED', { creditDate: '2026-13-45' }), cobranca('PAGA'), HOJE);
    expect(acao).toMatchObject({ tipo: 'PENDENCIA', tipoDaPendencia: 'DIVERGENCIA' });
    expect(motivo(acao)).toContain('data de crédito (2026-13-45)');
  });
});

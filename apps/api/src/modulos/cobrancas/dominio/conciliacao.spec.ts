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

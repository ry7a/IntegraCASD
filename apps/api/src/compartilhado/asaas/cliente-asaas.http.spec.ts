import { Logger } from '@nestjs/common';
import { ErroAsaas } from './cliente-asaas.js';
import { ClienteAsaasHttp, configuracaoAsaasDoAmbiente } from './cliente-asaas.http.js';

// Nenhum teste chama o Asaas real: o `fetch` é sempre um dublê.
const configuracao = { urlBase: 'https://asaas.teste/v3', chaveApi: 'chave-falsa' };

function resposta(status: number, corpo: object, cabecalhos: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhos });
}

describe('ClienteAsaasHttp', () => {
  const chamarHttp = vi.fn<typeof fetch>();
  const esperar = vi.fn<(milissegundos: number) => Promise<void>>().mockResolvedValue();
  const cliente = new ClienteAsaasHttp(configuracao, chamarHttp, esperar);

  const novaCobranca = {
    clienteIdAsaas: 'cus_1',
    valorEmCentavos: 12990,
    vencimento: '2026-11-10',
    descricao: 'Mensalidade de novembro',
    multaPercentual: 2,
    jurosMensalPercentual: 1,
  };

  beforeEach(() => {
    chamarHttp.mockReset();
    esperar.mockClear();
    // Evita poluir a saída dos testes com os avisos que o cliente registra de propósito.
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('cria a cobrança enviando o valor em reais e a chave no cabeçalho access_token', async () => {
    chamarHttp.mockResolvedValueOnce(
      resposta(200, {
        id: 'pay_1',
        bankSlipUrl: 'https://asaas.teste/boleto/pay_1',
        invoiceUrl: 'https://asaas.teste/i/pay_1',
      }),
    );

    const cobranca = await cliente.criarCobranca(novaCobranca);

    expect(cobranca).toEqual({
      idAsaas: 'pay_1',
      urlBoleto: 'https://asaas.teste/boleto/pay_1',
      urlFatura: 'https://asaas.teste/i/pay_1',
    });
    const [url, opcoes = {}] = chamarHttp.mock.calls[0];
    expect(url).toBe('https://asaas.teste/v3/payments');
    expect((opcoes.headers as Record<string, string>).access_token).toBe('chave-falsa');
    expect(JSON.parse(opcoes.body as string)).toMatchObject({
      customer: 'cus_1',
      billingType: 'BOLETO',
      value: 129.9,
      dueDate: '2026-11-10',
      fine: { value: 2, type: 'PERCENTAGE' },
      interest: { value: 1 },
    });
  });

  it('atualiza o cliente com PUT /customers/{id}', async () => {
    chamarHttp.mockResolvedValueOnce(resposta(200, { id: 'cus_1' }));

    await cliente.atualizarCliente('cus_1', { nome: 'Ana Ficticia', cpf: '52998224725', email: 'ana@exemplo.com' });

    const [url, opcoes = {}] = chamarHttp.mock.calls[0];
    expect(url).toBe('https://asaas.teste/v3/customers/cus_1');
    expect(opcoes.method).toBe('PUT');
    expect(JSON.parse(opcoes.body as string)).toEqual({ name: 'Ana Ficticia', cpfCnpj: '52998224725', email: 'ana@exemplo.com' });
  });

  it('cancela com DELETE /payments/{id}, sem corpo', async () => {
    chamarHttp.mockResolvedValueOnce(resposta(200, { deleted: true, id: 'pay_1' }));

    await cliente.cancelarCobranca('pay_1');

    const [url, opcoes = {}] = chamarHttp.mock.calls[0];
    expect(url).toBe('https://asaas.teste/v3/payments/pay_1');
    expect(opcoes.method).toBe('DELETE');
    expect(opcoes.body).toBeUndefined();
  });

  it('consulta uma cobrança e converte reais em centavos; desconhecida (404) vira nulo', async () => {
    chamarHttp.mockResolvedValueOnce(
      resposta(200, {
        id: 'pay_1',
        customer: 'cus_1',
        status: 'RECEIVED',
        value: 85.5,
        dueDate: '2026-10-10',
        paymentDate: '2026-10-09',
        creditDate: '2026-10-11',
        externalReference: 'mensalidade:x:2026-10',
        fine: { value: 2 },
        interest: { value: 1 },
      }),
    );
    expect(await cliente.buscarCobranca('pay_1')).toMatchObject({
      idAsaas: 'pay_1',
      idCliente: 'cus_1',
      situacao: 'RECEIVED',
      removida: false,
      valorCentavos: 8550,
      pagoEm: '2026-10-09',
      disponivelEm: '2026-10-11',
      referenciaExterna: 'mensalidade:x:2026-10',
    });
    expect(chamarHttp.mock.calls[0][0]).toBe('https://asaas.teste/v3/payments/pay_1');

    chamarHttp.mockResolvedValueOnce(resposta(404, { errors: [{ code: 'not_found' }] }));
    expect(await cliente.buscarCobranca('pay_x')).toBeNull();
  });

  it('lista as cobranças do período percorrendo todas as páginas', async () => {
    const pagamento = (id: string) => ({ id, customer: 'cus_1', status: 'PENDING', value: 10, dueDate: '2026-10-10' });
    chamarHttp
      .mockResolvedValueOnce(resposta(200, { data: [pagamento('pay_1')], hasMore: true }))
      .mockResolvedValueOnce(resposta(200, { data: [pagamento('pay_2')], hasMore: false }));

    const cobrancas = await cliente.listarCobrancas({ vencimentoDe: '2026-10-01', vencimentoAte: '2026-10-31' });

    expect(cobrancas.map((cobranca) => cobranca.idAsaas)).toEqual(['pay_1', 'pay_2']);
    const primeira = new URL(chamarHttp.mock.calls[0][0] as string);
    expect(primeira.searchParams.get('dueDate[ge]')).toBe('2026-10-01');
    expect(primeira.searchParams.get('dueDate[le]')).toBe('2026-10-31');
    expect(new URL(chamarHttp.mock.calls[1][0] as string).searchParams.get('offset')).toBe('100');
  });

  it('recusa valor que não seja inteiro positivo, sem chamar o Asaas', async () => {
    await expect(cliente.criarCobranca({ ...novaCobranca, valorEmCentavos: 0 })).rejects.toThrow();
    await expect(cliente.criarCobranca({ ...novaCobranca, valorEmCentavos: 10.5 })).rejects.toThrow();
    expect(chamarHttp).not.toHaveBeenCalled();
  });

  it('traduz o erro 400 sem repassar a mensagem crua do Asaas', async () => {
    chamarHttp.mockResolvedValueOnce(
      resposta(400, { errors: [{ code: 'invalid_customer', description: 'Customer Inválido' }] }),
    );

    const falha = cliente.criarCobranca(novaCobranca);

    await expect(falha).rejects.toBeInstanceOf(ErroAsaas);
    await expect(falha).rejects.toThrow(/Confira CPF, e-mail e valor/);
    await expect(falha).rejects.not.toThrow(/Customer Inválido/);
  });

  it('no 429, espera o tempo informado pelo Asaas e repete a requisição', async () => {
    chamarHttp
      .mockResolvedValueOnce(resposta(429, {}, { 'RateLimit-Reset': '2' }))
      .mockResolvedValueOnce(resposta(200, { id: 'pay_2' }));

    const cobranca = await cliente.criarCobranca(novaCobranca);

    expect(cobranca).toEqual({ idAsaas: 'pay_2', urlBoleto: null, urlFatura: null });
    expect(esperar).toHaveBeenCalledWith(2000);
    expect(chamarHttp).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de 3 respostas 429 seguidas', async () => {
    chamarHttp.mockResolvedValue(resposta(429, {}, { 'RateLimit-Reset': '1' }));

    await expect(cliente.criarCobranca(novaCobranca)).rejects.toBeInstanceOf(ErroAsaas);
    expect(chamarHttp).toHaveBeenCalledTimes(3);
  });

  it('transforma falha de rede em ErroAsaas', async () => {
    chamarHttp.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(cliente.criarCliente({ nome: 'Aluno Teste', cpf: '12345678909', email: 'a@t.com' }))
      .rejects.toBeInstanceOf(ErroAsaas);
  });
});

describe('configuracaoAsaasDoAmbiente', () => {
  it('usa a URL de sandbox quando o ambiente é sandbox', () => {
    const resultado = configuracaoAsaasDoAmbiente({ ASAAS_AMBIENTE: 'sandbox', ASAAS_API_KEY: 'x' });
    expect(resultado.urlBase).toBe('https://api-sandbox.asaas.com/v3');
  });

  it('falha se a chave ainda for o texto de exemplo do .env.example', () => {
    expect(() =>
      configuracaoAsaasDoAmbiente({
        ASAAS_AMBIENTE: 'sandbox',
        ASAAS_API_KEY: 'coloque-sua-chave-do-sandbox',
      }),
    ).toThrow(/ASAAS_API_KEY/);
  });

  it('falha se o ambiente for desconhecido', () => {
    expect(() =>
      configuracaoAsaasDoAmbiente({ ASAAS_AMBIENTE: 'teste', ASAAS_API_KEY: 'x' }),
    ).toThrow(/ASAAS_AMBIENTE/);
  });
});

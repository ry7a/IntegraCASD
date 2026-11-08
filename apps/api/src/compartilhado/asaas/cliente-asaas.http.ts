import { Logger } from '@nestjs/common';
import {
  type AmbienteAsaas,
  ClienteAsaas,
  CobrancaAsaas,
  ErroAsaas,
  NovaCobrancaAsaas,
  NovoClienteAsaas,
  type CobrancaNoAsaas,
} from './cliente-asaas.js';

const URLS_BASE = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

export function urlBaseDoAmbiente(ambiente: AmbienteAsaas): string {
  return ambiente === 'SANDBOX' ? URLS_BASE.sandbox : URLS_BASE.producao;
}

const MAXIMO_DE_TENTATIVAS = 3;
const ESPERA_PADRAO_EM_SEGUNDOS = 5;
const ESPERA_MAXIMA_EM_SEGUNDOS = 60;
// Tempo máximo de cada tentativa (pedido e leitura da resposta). Sem ele, o `fetch` do Node espera
// até ~300 s por um Asaas travado, segurando a requisição do usuário e as rotinas por minutos.
// Leitura (GET): desistir cedo não tem efeito colateral; quem chamou repete ou mostra o erro.
const TEMPO_LIMITE_DE_LEITURA_EM_MS = 15_000;
// Pedido que cria ou altera (POST, PUT, DELETE): desistir não desfaz nada no Asaas. Se abortarmos uma
// criação de cobrança que o Asaas já estava gravando, ela existe lá e não aqui, e o usuário, ao tentar
// de novo, gera um segundo boleto para o aluno. Por isso esperamos mais antes de desistir.
const TEMPO_LIMITE_DE_ESCRITA_EM_MS = 45_000;

export interface ConfiguracaoAsaas {
  urlBase: string;
  chaveApi: string;
}

// Monta a configuração a partir do .env. Falha cedo, com mensagem clara, se algo estiver faltando.
// A chave do Asaas de sandbox só funciona na URL de sandbox (e a de produção na de produção).
export function configuracaoAsaasDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfiguracaoAsaas {
  const ambiente = env.ASAAS_AMBIENTE ?? '';
  const chaveApi = env.ASAAS_API_KEY ?? '';

  if (ambiente !== 'sandbox' && ambiente !== 'producao') {
    throw new Error('ASAAS_AMBIENTE deve ser "sandbox" ou "producao".');
  }
  if (chaveApi === '' || chaveApi.startsWith('coloque-')) {
    throw new Error('ASAAS_API_KEY não está preenchida no .env.');
  }
  return { urlBase: URLS_BASE[ambiente], chaveApi };
}

type Esperar = (milissegundos: number) => Promise<void>;

const esperarDeVerdade: Esperar = (milissegundos) =>
  new Promise((resolver) => setTimeout(resolver, milissegundos));

// Único código do sistema que fala HTTP com o Asaas.
// O `fetch` e a espera são parâmetros para o teste trocá-los por versões falsas.
export class ClienteAsaasHttp extends ClienteAsaas {
  private readonly logger = new Logger(ClienteAsaasHttp.name);

  constructor(
    private readonly configuracao: ConfiguracaoAsaas,
    private readonly chamarHttp: typeof fetch = fetch,
    private readonly esperar: Esperar = esperarDeVerdade,
  ) {
    super();
  }

  estaConfigurado(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async testarCredenciais(ambiente: AmbienteAsaas, chaveApi: string): Promise<void> {
    await new ClienteAsaasHttp({ urlBase: urlBaseDoAmbiente(ambiente), chaveApi }, this.chamarHttp, this.esperar).testarComunicacao();
  }

  // Consulta sem efeito: só confere se a chave é aceita.
  async testarComunicacao(): Promise<void> {
    await this.enviar<object>('GET', '/customers?limit=1');
  }

  async criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    const resposta = await this.enviar<{ id: string }>('POST', '/customers', {
      name: dados.nome,
      cpfCnpj: dados.cpf,
      email: dados.email,
    });
    return { idAsaas: resposta.id };
  }

  async atualizarCliente(idAsaas: string, dados: NovoClienteAsaas): Promise<void> {
    await this.enviar<{ id: string }>('PUT', `/customers/${encodeURIComponent(idAsaas)}`, {
      name: dados.nome,
      cpfCnpj: dados.cpf,
      email: dados.email,
    });
  }

  async criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    if (!Number.isInteger(dados.valorEmCentavos) || dados.valorEmCentavos <= 0) {
      throw new Error('valorEmCentavos deve ser um inteiro positivo.');
    }

    const resposta = await this.enviar<{ id: string; bankSlipUrl?: string | null; invoiceUrl?: string | null }>(
      'POST',
      '/payments',
      {
        customer: dados.clienteIdAsaas,
        billingType: 'BOLETO',
        // O Asaas espera reais com casas decimais; o sistema guarda centavos inteiros.
        value: dados.valorEmCentavos / 100,
        dueDate: dados.vencimento,
        description: dados.descricao,
        // Multa e juros em percentual: o Asaas aplica no pagamento em atraso.
        fine: { value: dados.multaPercentual, type: 'PERCENTAGE' },
        interest: { value: dados.jurosMensalPercentual },
        ...(dados.referenciaExterna === undefined ? {} : { externalReference: dados.referenciaExterna }),
      },
    );
    return { idAsaas: resposta.id, urlBoleto: resposta.bankSlipUrl ?? null, urlFatura: resposta.invoiceUrl ?? null };
  }

  async cancelarCobranca(idAsaas: string): Promise<void> {
    // O Asaas chama de "excluir" a cobrança que não deve mais ficar disponível para pagamento.
    // encodeURIComponent: o id vai na URL e nunca deve conseguir mudar o caminho.
    await this.enviar<{ deleted: boolean }>('DELETE', `/payments/${encodeURIComponent(idAsaas)}`);
  }

  async buscarCobranca(idAsaas: string): Promise<CobrancaNoAsaas | null> {
    try {
      return paraCobrancaNoAsaas(await this.enviar<PagamentoDoAsaas>('GET', `/payments/${encodeURIComponent(idAsaas)}`));
    } catch (erro) {
      if (erro instanceof CobrancaDesconhecida) return null;
      throw erro;
    }
  }

  async listarCobrancas(periodo: { vencimentoDe: string; vencimentoAte: string }): Promise<CobrancaNoAsaas[]> {
    const cobrancas: CobrancaNoAsaas[] = [];
    for (let deslocamento = 0; ; deslocamento += ITENS_POR_PAGINA) {
      const filtro = new URLSearchParams({
        'dueDate[ge]': periodo.vencimentoDe,
        'dueDate[le]': periodo.vencimentoAte,
        limit: String(ITENS_POR_PAGINA),
        offset: String(deslocamento),
      });
      const pagina = await this.enviar<{ data: PagamentoDoAsaas[]; hasMore: boolean }>('GET', `/payments?${filtro.toString()}`);
      cobrancas.push(...pagina.data.map(paraCobrancaNoAsaas));
      if (!pagina.hasMore) return cobrancas;
    }
  }

  // Envia a requisição. Se o Asaas responder 429 (excesso de requisições), espera o tempo que ele
  // informou e tenta de novo, até o limite de tentativas.
  private async enviar<T>(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: object): Promise<T> {
    const tempoLimiteEmMs = metodo === 'GET' ? TEMPO_LIMITE_DE_LEITURA_EM_MS : TEMPO_LIMITE_DE_ESCRITA_EM_MS;
    for (let tentativa = 1; ; tentativa++) {
      let resposta: Response;
      try {
        resposta = await this.chamarHttp(`${this.configuracao.urlBase}${caminho}`, {
          method: metodo,
          headers: {
            'Content-Type': 'application/json',
            // O Asaas não usa "Authorization: Bearer": a chave vai neste cabeçalho.
            access_token: this.configuracao.chaveApi,
            'User-Agent': 'IntegraCASD',
          },
          ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
          // Cancela a tentativa se o Asaas não responder a tempo (o mesmo sinal vale para ler o corpo).
          signal: AbortSignal.timeout(tempoLimiteEmMs),
        });
      } catch (erro) {
        throw erroDeComunicacao(erro, tempoLimiteEmMs);
      }

      if (resposta.ok) {
        try {
          return (await resposta.json()) as T;
        } catch (erro) {
          // O tempo pode estourar no meio da leitura do corpo: vira o mesmo erro de Asaas indisponível.
          if (estourouOTempoLimite(erro)) throw erroDeComunicacao(erro, tempoLimiteEmMs);
          throw erro;
        }
      }
      if (resposta.status === 429 && tentativa < MAXIMO_DE_TENTATIVAS) {
        await this.esperar(segundosDeEspera(resposta) * 1000);
        continue;
      }
      throw await this.traduzirErro(resposta);
    }
  }

  // Transforma a resposta de erro do Asaas numa mensagem orientada à ação.
  // No log vão só o status e os códigos de erro; a mensagem crua do Asaas nunca chega ao
  // usuário e a chave nunca é registrada.
  private async traduzirErro(resposta: Response): Promise<ErroAsaas | CobrancaDesconhecida> {
    const detalhe = (await resposta.json().catch(() => null)) as {
      errors?: { code?: string }[];
    } | null;
    const codigos = detalhe?.errors?.map((erro) => erro.code).join(', ') ?? '';
    this.logger.warn(`O Asaas respondeu ${resposta.status} ${codigos}`.trim());

    if (resposta.status === 400) {
      return new ErroAsaas(
        'O Asaas recusou os dados enviados. Confira CPF, e-mail e valor e tente novamente.',
        'DADOS_RECUSADOS',
      );
    }
    if (resposta.status === 401 || resposta.status === 403) {
      return new ErroAsaas(
        'O Asaas recusou a chave de acesso. Peça à diretoria para conferir a configuração da integração.',
        'CHAVE_RECUSADA',
      );
    }
    if (resposta.status === 404) return new CobrancaDesconhecida();
    if (resposta.status === 429) {
      return new ErroAsaas(
        'O Asaas pediu para reduzir o ritmo das requisições. Aguarde alguns minutos e tente novamente.',
        'LIMITE_DE_REQUISICOES',
      );
    }
    return new ErroAsaas('O Asaas está com problemas no momento. Tente novamente em alguns minutos.');
  }
}

// 404: o recurso pedido não existe no Asaas. Só a consulta de cobrança trata; nas demais, vira erro comum.
class CobrancaDesconhecida extends ErroAsaas {
  constructor() {
    super('O Asaas não encontrou o registro pedido. Sincronize as cobranças e tente de novo.', 'DADOS_RECUSADOS');
  }
}

// Falha de rede ou tempo esgotado: o Asaas está indisponível (motivo padrão do ErroAsaas), e os
// casos de uso reagem igual nos dois casos (a rotina ou o webhook tenta de novo; a geração para).
function erroDeComunicacao(erro: unknown, tempoLimiteEmMs: number): ErroAsaas {
  if (estourouOTempoLimite(erro)) {
    return new ErroAsaas(
      `O Asaas não respondeu em ${tempoLimiteEmMs / 1000} segundos. Aguarde alguns minutos e tente novamente.`,
    );
  }
  return new ErroAsaas('Não foi possível falar com o Asaas. Confira a conexão com a internet e tente novamente.');
}

// O `AbortSignal.timeout` interrompe o `fetch` com um erro de nome "TimeoutError".
function estourouOTempoLimite(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'TimeoutError';
}

const ITENS_POR_PAGINA = 100;

// O pagamento como o Asaas devolve (só os campos usados).
type PagamentoDoAsaas = {
  id: string;
  customer: string;
  status: string;
  deleted?: boolean;
  value: number;
  dueDate: string;
  description?: string | null;
  externalReference?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  creditDate?: string | null;
  fine?: { value?: number } | null;
  interest?: { value?: number } | null;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
};

function paraCobrancaNoAsaas(pagamento: PagamentoDoAsaas): CobrancaNoAsaas {
  return {
    idAsaas: pagamento.id,
    idCliente: pagamento.customer,
    situacao: pagamento.status,
    removida: pagamento.deleted === true,
    // O Asaas manda reais com casas decimais; aqui vira centavos inteiros.
    valorCentavos: Math.round(pagamento.value * 100),
    vencimento: pagamento.dueDate,
    descricao: pagamento.description ?? null,
    referenciaExterna: pagamento.externalReference ?? null,
    pagoEm: pagamento.paymentDate ?? pagamento.clientPaymentDate ?? pagamento.confirmedDate ?? null,
    disponivelEm: pagamento.creditDate ?? null,
    multaPercentual: pagamento.fine?.value ?? 0,
    jurosMensalPercentual: pagamento.interest?.value ?? 0,
    urlBoleto: pagamento.bankSlipUrl ?? null,
    urlFatura: pagamento.invoiceUrl ?? null,
  };
}

// Lê, em segundos, quanto esperar (cabeçalho RateLimit-Reset). Limita a 60 s para
// uma requisição nunca ficar travada por muito tempo.
function segundosDeEspera(resposta: Response): number {
  const informado = Number(resposta.headers.get('RateLimit-Reset'));
  if (!Number.isFinite(informado) || informado <= 0) {
    return ESPERA_PADRAO_EM_SEGUNDOS;
  }
  return Math.min(informado, ESPERA_MAXIMA_EM_SEGUNDOS);
}

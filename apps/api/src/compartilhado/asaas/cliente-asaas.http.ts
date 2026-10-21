import { Logger } from '@nestjs/common';
import {
  ClienteAsaas,
  CobrancaAsaas,
  ErroAsaas,
  NovaCobrancaAsaas,
  NovoClienteAsaas,
} from './cliente-asaas.js';

const URLS_BASE = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

const MAXIMO_DE_TENTATIVAS = 3;
const ESPERA_PADRAO_EM_SEGUNDOS = 5;
const ESPERA_MAXIMA_EM_SEGUNDOS = 60;

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

  async criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    const resposta = await this.enviar<{ id: string }>('/customers', {
      name: dados.nome,
      cpfCnpj: dados.cpf,
      email: dados.email,
    });
    return { idAsaas: resposta.id };
  }

  async criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    if (!Number.isInteger(dados.valorEmCentavos) || dados.valorEmCentavos <= 0) {
      throw new Error('valorEmCentavos deve ser um inteiro positivo.');
    }

    const resposta = await this.enviar<{ id: string; bankSlipUrl?: string | null }>('/payments', {
      customer: dados.clienteIdAsaas,
      billingType: 'BOLETO',
      // O Asaas espera reais com casas decimais; o sistema guarda centavos inteiros.
      value: dados.valorEmCentavos / 100,
      dueDate: dados.vencimento,
      description: dados.descricao,
    });
    return { idAsaas: resposta.id, urlBoleto: resposta.bankSlipUrl ?? null };
  }

  // Envia um POST. Se o Asaas responder 429 (excesso de requisições), espera o tempo que ele
  // informou e tenta de novo, até o limite de tentativas.
  private async enviar<T>(caminho: string, corpo: object): Promise<T> {
    for (let tentativa = 1; ; tentativa++) {
      let resposta: Response;
      try {
        resposta = await this.chamarHttp(`${this.configuracao.urlBase}${caminho}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // O Asaas não usa "Authorization: Bearer": a chave vai neste cabeçalho.
            access_token: this.configuracao.chaveApi,
            'User-Agent': 'IntegraCASD',
          },
          body: JSON.stringify(corpo),
        });
      } catch {
        throw new ErroAsaas(
          'Não foi possível falar com o Asaas. Confira a conexão com a internet e tente novamente.',
        );
      }

      if (resposta.ok) {
        return (await resposta.json()) as T;
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
  private async traduzirErro(resposta: Response): Promise<ErroAsaas> {
    const detalhe = (await resposta.json().catch(() => null)) as {
      errors?: { code?: string }[];
    } | null;
    const codigos = detalhe?.errors?.map((erro) => erro.code).join(', ') ?? '';
    this.logger.warn(`O Asaas respondeu ${resposta.status} ${codigos}`.trim());

    if (resposta.status === 400) {
      return new ErroAsaas(
        'O Asaas recusou os dados enviados. Confira CPF, e-mail e valor e tente novamente.',
      );
    }
    if (resposta.status === 401 || resposta.status === 403) {
      return new ErroAsaas(
        'O Asaas recusou a chave de acesso. Peça à diretoria para conferir a configuração da integração.',
      );
    }
    if (resposta.status === 429) {
      return new ErroAsaas(
        'O Asaas pediu para reduzir o ritmo das requisições. Aguarde alguns minutos e tente novamente.',
      );
    }
    return new ErroAsaas('O Asaas está com problemas no momento. Tente novamente em alguns minutos.');
  }
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

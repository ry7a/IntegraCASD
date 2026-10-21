// Cliente HTTP usado por todas as funções geradas pelo orval (o "mutator").
// É o único lugar do frontend que chama fetch. Aqui as falhas viram um ErroDaApi
// com uma mensagem que pode ser mostrada direto na tela.

const MENSAGEM_SEM_CONEXAO =
  'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.';
const MENSAGEM_ERRO_INESPERADO =
  'O servidor não conseguiu atender o pedido. Tente de novo em instantes; se continuar, avise a equipe.';

export class ErroDaApi extends Error {
  status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = 'ErroDaApi';
    this.status = status;
  }
}

// O orval lê este tipo para dizer que o `error` dos hooks é sempre um ErroDaApi.
export type ErrorType<_Erro> = ErroDaApi;

// O NestJS responde erros como { statusCode, message, error }. O `message`
// pode ser texto ou uma lista (erros de validação).
function extrairMensagem(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null || !('message' in corpo)) {
    return null;
  }
  const { message } = corpo;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(' ');
  return null;
}

export async function clienteHttp<T>(url: string, opcoes: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    // fetch só lança quando não há resposta nenhuma (servidor fora do ar, sem rede).
    throw new ErroDaApi(MENSAGEM_SEM_CONEXAO, 0);
  }

  const texto = await resposta.text();
  const corpo: unknown = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    const mensagem = resposta.status >= 500 ? null : extrairMensagem(corpo);
    throw new ErroDaApi(mensagem ?? MENSAGEM_ERRO_INESPERADO, resposta.status);
  }

  return corpo as T;
}

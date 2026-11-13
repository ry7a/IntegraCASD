// Apoio dos testes de fuzzing (CT-FZ-01 e CT-FZ-02): lê os arquivos de entradas e troca os marcadores
// pelos valores de verdade. As entradas foram geradas por um LLM e ficam versionadas em ./entradas/*.json;
// o teste só as lê, sem chamar o LLM de novo (Plano de Testes, Seção 4.1). Veja o README.md desta pasta.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA_DAS_ENTRADAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'entradas');

// O que cada entrada promete:
// - "recusa": 4xx e nada gravado;
// - "aceito": 2xx e o registro gravado uma única vez;
// - "recusa-ou-aceito": qualquer um dos dois, desde que coerente (nunca 5xx, nunca gravação pela metade);
// - "lista" / "lista-vazia" (só consultas): 200 com uma lista (vazia, no segundo caso).
export type Esperado = 'recusa' | 'aceito' | 'recusa-ou-aceito' | 'lista' | 'lista-vazia';

export interface ArquivoDeEntradas<Entrada> {
  alvo: string;
  // O "pedido" feito ao LLM, resumido, para quem revisa saber de onde as entradas saíram.
  comoForamGeradas: string;
  // Só nos formulários: um corpo válido; cada entrada muda alguns campos dele.
  base?: Record<string, unknown>;
  entradas: Entrada[];
}

// Lê ./entradas/<nome> e confere o mínimo de cada entrada, para um erro de digitação aparecer logo.
export function lerArquivoDeEntradas<Entrada extends { descricao: string; esperado: Esperado }>(nome: string): ArquivoDeEntradas<Entrada> {
  const arquivo = JSON.parse(readFileSync(path.join(PASTA_DAS_ENTRADAS, nome), 'utf8')) as ArquivoDeEntradas<Entrada>;
  const validos: Esperado[] = ['recusa', 'aceito', 'recusa-ou-aceito', 'lista', 'lista-vazia'];
  for (const entrada of arquivo.entradas) {
    if (typeof entrada.descricao !== 'string' || !validos.includes(entrada.esperado)) {
      throw new Error(`Entrada mal escrita em ${nome}: ${JSON.stringify(entrada).slice(0, 200)}`);
    }
  }
  return arquivo;
}

export function lerEntradas<Entrada extends { descricao: string; esperado: Esperado }>(nome: string): Entrada[] {
  return lerArquivoDeEntradas<Entrada>(nome).entradas;
}

// Texto que parece aleatório, mas é sempre o mesmo (encadeia hashes de 0, 1, 2...). Serve para gerar um id
// enorme que o PostgreSQL não consiga comprimir, e que se repita igual em toda execução (caso de regressão).
function textoEmbaralhado(tamanho: number): string {
  let texto = '';
  for (let i = 0; texto.length < tamanho; i++) {
    texto += createHash('sha256').update(String(i)).digest('hex');
  }
  return texto.slice(0, tamanho);
}

// Troca, dentro de um texto, os marcadores {{NOME}} pelo valor que o teste preparou (ex.: {{ALUNO_ID}}).
// Cada marcador é uma função: {{CPF}} gera um CPF novo a cada uso.
export type Trocas = Record<string, () => string>;

function trocarNoTexto(texto: string, trocas: Trocas): string {
  return texto.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_trecho, nome: string) => {
    const gerar = trocas[nome];
    if (gerar === undefined) throw new Error(`Marcador desconhecido no arquivo de entradas: {{${nome}}}`);
    return gerar();
  });
}

// Percorre um valor do JSON e devolve outro com os marcadores trocados. Além dos {{NOME}} em textos, há
// marcadores que GERAM valores grandes, para não gravar megabytes no arquivo:
//   { "$repetir": "x", "vezes": 3 }   vira "xxx"
//   { "$embaralhado": 6000 }          vira um texto de 6000 caracteres que não se comprime
export function expandir(valor: unknown, trocas: Trocas): unknown {
  if (typeof valor === 'string') return trocarNoTexto(valor, trocas);
  if (Array.isArray(valor)) return valor.map((item) => expandir(item, trocas));
  if (typeof valor === 'object' && valor !== null) {
    const objeto = valor as Record<string, unknown>;
    if (typeof objeto.$repetir === 'string') return objeto.$repetir.repeat(Number(objeto.vezes));
    if (typeof objeto.$embaralhado === 'number') return textoEmbaralhado(objeto.$embaralhado);
    // Object.fromEntries (e não `resultado[chave] = ...`): uma chave "__proto__" vinda do JSON continua
    // sendo uma chave comum. Com a atribuição, ela trocaria o protótipo do objeto e sumiria do corpo.
    return Object.fromEntries(Object.entries(objeto).map(([chave, item]) => [chave, expandir(item, trocas)]));
  }
  return valor;
}

// Corpo bruto (texto enviado sem passar pelo JSON.stringify): um texto, ou uma lista de pedaços que se juntam.
// A lista permite montar, por exemplo, um JSON com 5000 colchetes aninhados sem escrevê-los no arquivo.
export function expandirCorpoBruto(valor: unknown, trocas: Trocas): string {
  const partes = Array.isArray(valor) ? valor : [valor];
  return partes.map((parte) => String(expandir(parte, trocas))).join('');
}

// Detalhes internos que nunca podem chegar a quem usa a API numa mensagem de erro ([Usabilidade.NF002]).
export const DETALHE_INTERNO = /prisma|postgres|invalid input syntax|violates|constraint|stack|\bat \S+\.(ts|js):\d+/i;

// Mostra a resposta no nome do erro: quando uma entrada falha, o relatório já diz o que voltou.
export function resumoDaResposta(resposta: { status: number; body: unknown; text?: string }): string {
  const corpo = resposta.body !== undefined && JSON.stringify(resposta.body) !== '{}' ? JSON.stringify(resposta.body) : (resposta.text ?? '');
  return `HTTP ${resposta.status} ${corpo.slice(0, 300)}`;
}

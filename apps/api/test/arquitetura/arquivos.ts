// Funções de apoio dos testes de arquitetura (funções de aptidão do backend).
// Os testes não executam o código: eles LEEM os arquivos .ts e conferem imports e texto.
// Veja docs/governanca/README.md para a lista de regras.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do repositório (este arquivo está em apps/api/test/arquitetura/).
const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = path.resolve(aqui, '../../../..');
export const RAIZ_API = path.join(RAIZ_REPO, 'apps', 'api');
export const PASTA_SRC = path.join(RAIZ_API, 'src');
export const PASTA_MODULOS = path.join(PASTA_SRC, 'modulos');

// Pastas que nunca entram na varredura: código gerado (Prisma) e dependências.
const PASTAS_IGNORADAS = ['generated', 'node_modules', 'dist'];

// Lista, de forma recursiva, os arquivos de uma pasta com a extensão dada (ex.: '.ts').
// Devolve caminhos absolutos. Se a pasta não existe, devolve lista vazia
// (várias pastas, como compartilhado/asaas, ainda não foram criadas).
export function listarArquivos(pasta: string, extensao: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(pasta, { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }
  return entradas
    .filter((relativo) => relativo.endsWith(extensao))
    .filter((relativo) => !relativo.split(path.sep).some((parte) => PASTAS_IGNORADAS.includes(parte)))
    .map((relativo) => path.join(pasta, relativo));
}

// Nomes das pastas dentro de src/modulos/ (cada uma é um módulo).
export function listarModulos(): string[] {
  return readdirSync(PASTA_MODULOS, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name);
}

// Remove comentários para que uma palavra citada num comentário não conte como violação.
// Remove blocos /* ... */ e comentários de linha que começam depois de um espaço
// (assim o "//" de uma URL como https://... não é cortado).
export function removerComentarios(conteudo: string): string {
  return conteudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

// Lê um arquivo de texto já sem comentários.
export function lerCodigo(arquivo: string): string {
  return removerComentarios(readFileSync(arquivo, 'utf8'));
}

// Devolve o texto de cada import do arquivo: import x from 'a', import 'a',
// export { x } from 'a' e import('a').
export function extrairImports(conteudo: string): string[] {
  const imports: string[] = [];
  const regex = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  for (const achado of removerComentarios(conteudo).matchAll(regex)) {
    imports.push(achado[1]);
  }
  return imports;
}

// Caminho relativo à raiz do repositório, sempre com "/" (igual no Windows e no Linux).
// É o formato usado nas mensagens de erro e em docs/governanca/excecoes.json.
export function caminhoRelativo(arquivo: string): string {
  return path.relative(RAIZ_REPO, arquivo).split(path.sep).join('/');
}

// Para um import relativo ('../infra/x.js'), devolve o caminho absoluto de destino.
// Imports de pacotes ('@nestjs/common') devolvem null.
export function resolverImportRelativo(arquivo: string, textoDoImport: string): string | null {
  if (!textoDoImport.startsWith('.')) return null;
  return path.resolve(path.dirname(arquivo), textoDoImport);
}

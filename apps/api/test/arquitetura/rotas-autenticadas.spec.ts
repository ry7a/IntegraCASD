// B8: toda rota é autenticada, exceto login, webhook e saúde ([Segurança.NF001]).
// Lê o contrato gerado (packages/api-client/openapi.json), que o CI mantém em dia (F3).
//
// Convenções para quem for implementar a autenticação:
// - Rota autenticada: declarar o esquema de segurança, por exemplo @ApiCookieAuth()
//   no controller. No openapi.json isso vira "security": [{ "cookie": [] }].
// - Rota de Administração (path começa com /api/admin): além da segurança, declarar
//   @ApiExtension('x-perfil', 'DIRETORIA'). O perfil é verificado de verdade no backend;
//   a extensão só deixa o requisito visível (e testável) no contrato.
// Rotas cuja autenticação ainda não existe ficam em docs/governanca/excecoes.json (regra B8),
// com o alvo no formato "GET /api/alunos".
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, RAIZ_REPO, caminhoRelativo, lerCodigo, listarArquivos } from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// Únicas rotas que podem ser públicas (o prefixo /api vem de configurarApp em openapi.ts).
const ROTAS_PUBLICAS = ['/api/auth/login', '/api/webhooks/asaas'];

// Únicos arquivos que podem marcar rota com @Publico(). O webhook e a saúde ficam fora do OpenAPI
// (@ApiExcludeController), então o teste do contrato não os enxerga: esta lista fecha a brecha.
const ARQUIVOS_COM_ROTA_PUBLICA = [
  'apps/api/src/modulos/acesso/api/autenticacao.controller.ts', // login
  'apps/api/src/modulos/cobrancas/api/webhook-asaas.controller.ts', // webhook (token próprio)
  'apps/api/src/compartilhado/saude/saude.controller.ts', // saúde (Railway e monitor externo)
];
const PREFIXO_ADMIN = '/api/admin';
const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

type Operacao = { security?: unknown[]; [chave: string]: unknown };
type Contrato = { paths: Record<string, Record<string, Operacao>> };

function lerOperacoes() {
  const arquivo = path.join(RAIZ_REPO, 'packages', 'api-client', 'openapi.json');
  const contrato = JSON.parse(readFileSync(arquivo, 'utf8')) as Contrato;
  const operacoes: Array<{ alvo: string; caminho: string; operacao: Operacao }> = [];
  for (const [caminho, metodos] of Object.entries(contrato.paths)) {
    for (const metodo of METODOS) {
      if (metodos[metodo]) {
        operacoes.push({ alvo: `${metodo.toUpperCase()} ${caminho}`, caminho, operacao: metodos[metodo] });
      }
    }
  }
  return operacoes;
}

describe('B8: toda rota autenticada', () => {
  it('toda operação declara security não vazio (exceto login, webhook e exceções)', () => {
    const violacoes = lerOperacoes()
      .filter(({ caminho }) => !ROTAS_PUBLICAS.includes(caminho))
      .filter(({ operacao }) => !Array.isArray(operacao.security) || operacao.security.length === 0)
      .map(({ alvo }) => alvo);
    const { pendentes, obsoletas } = aplicarExcecoes('B8', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });

  it('rotas de Administração declaram x-perfil: DIRETORIA', () => {
    const violacoes = lerOperacoes()
      .filter(({ caminho }) => caminho.startsWith(PREFIXO_ADMIN))
      .filter(({ operacao }) => operacao['x-perfil'] !== 'DIRETORIA')
      .map(({ alvo }) => alvo);
    expect(violacoes).toEqual([]);
  });
});

describe('B8: rotas públicas só onde pode', () => {
  it('@Publico() só aparece nos controllers de login, webhook e saúde', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => /@Publico\(\)/.test(lerCodigo(arquivo)))
      .map(caminhoRelativo)
      .filter((relativo) => !ARQUIVOS_COM_ROTA_PUBLICA.includes(relativo));
    expect(violacoes).toEqual([]);
  });
});

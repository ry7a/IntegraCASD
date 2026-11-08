// B8: toda rota é autenticada, exceto login, webhook e saúde ([Segurança.NF001]).
// Lê o contrato gerado (packages/api-client/openapi.json), que o CI mantém em dia (F3).
//
// Convenções (a guarda global exige sessão; o contrato precisa dizer o mesmo):
// - Rota autenticada: declarar o esquema de segurança, @ApiCookieAuth('cookie') no controller.
//   No openapi.json isso vira "security": [{ "cookie": [] }].
// - Rota de Administração (path começa com /api/admin): além da segurança, declarar
//   @ApiExtension('x-perfil', 'DIRETORIA'). O perfil é verificado de verdade no backend;
//   a extensão só deixa o requisito visível (e testável) no contrato.
// Uma exceção legítima vai para docs/governanca/excecoes.json (regra B8), com o alvo no formato
// "GET /api/caminho"; hoje não há nenhuma.
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

// Chamada do decorator, com ou sem @ e com espaços (só "@Publico()" deixaria passar "@Publico( )").
// Sem a flag g: com ela, o .test() guarda a posição entre chamadas e erra no arquivo seguinte.
const USO_DO_PUBLICO = /\bPublico\s*\(/;
// A chave de metadados que a guarda lê para liberar a rota, pelo nome da constante ou pelo valor.
// Quem a usar fora daqui marca rota pública sem passar pelo @Publico() (ex.: SetMetadata direto).
const CHAVE_DA_ROTA_PUBLICA = /\bCHAVE_ROTA_PUBLICA\b|['"`]rotaPublica['"`]/;
const ARQUIVOS_DA_CHAVE = [
  'apps/api/src/compartilhado/autenticacao/publico.decorator.ts', // define a chave
  'apps/api/src/compartilhado/autenticacao/autenticacao.guard.ts', // lê a chave
];
// Decorators de rota do Nest: cada um é um handler (um endpoint).
const DECORATOR_DE_ROTA = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(/;

// Quantos handlers e quantos @Publico() tem cada controller público. Na saúde e no webhook o @Publico()
// fica na classe e vale para todos os handlers; como os dois estão fora do OpenAPI, o teste do contrato
// não veria uma rota nova ali. No login, o @Publico() fica só no handler do login (sessão e logout estão
// no contrato, com security); o número de handlers dele fica livre. Mudou de propósito? Atualize aqui e
// em docs/governanca/README.md.
const CONTROLLERS_PUBLICOS: Array<{ arquivo: string; handlers?: number; publicos: number }> = [
  { arquivo: 'apps/api/src/compartilhado/saude/saude.controller.ts', handlers: 2, publicos: 1 },
  { arquivo: 'apps/api/src/modulos/cobrancas/api/webhook-asaas.controller.ts', handlers: 1, publicos: 1 },
  { arquivo: 'apps/api/src/modulos/acesso/api/autenticacao.controller.ts', publicos: 1 },
];

function contar(codigo: string, expressao: RegExp): number {
  return [...codigo.matchAll(new RegExp(expressao.source, 'g'))].length;
}

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
      .filter((arquivo) => USO_DO_PUBLICO.test(lerCodigo(arquivo)))
      .map(caminhoRelativo)
      .filter((relativo) => !ARQUIVOS_COM_ROTA_PUBLICA.includes(relativo));
    expect(violacoes).toEqual([]);
  });

  it('ninguém marca rota pública por fora do @Publico() (chave de metadados ou SetMetadata direto)', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => CHAVE_DA_ROTA_PUBLICA.test(lerCodigo(arquivo)))
      .map(caminhoRelativo)
      .filter((relativo) => !ARQUIVOS_DA_CHAVE.includes(relativo));
    expect(violacoes).toEqual([]);
  });

  it('cada controller público tem só os handlers e o @Publico() conhecidos (rota nova ali nasceria pública)', () => {
    const encontrados = CONTROLLERS_PUBLICOS.map(({ arquivo, handlers }) => {
      const codigo = lerCodigo(path.join(RAIZ_REPO, arquivo));
      return {
        arquivo,
        ...(handlers === undefined ? {} : { handlers: contar(codigo, DECORATOR_DE_ROTA) }),
        publicos: contar(codigo, USO_DO_PUBLICO),
      };
    });
    expect(encontrados).toEqual(CONTROLLERS_PUBLICOS);
  });

  it('as expressões pegam o jeito errado (confere a própria varredura)', () => {
    expect(USO_DO_PUBLICO.test('@Publico ( )')).toBe(true);
    expect(USO_DO_PUBLICO.test('applyDecorators(Publico(), Get())')).toBe(true);
    expect(USO_DO_PUBLICO.test('export const Publico = () => SetMetadata(CHAVE_ROTA_PUBLICA, true);')).toBe(false);
    expect(CHAVE_DA_ROTA_PUBLICA.test("@SetMetadata('rotaPublica', true)")).toBe(true);
    expect(CHAVE_DA_ROTA_PUBLICA.test('@SetMetadata(CHAVE_ROTA_PUBLICA, true)')).toBe(true);
    expect(contar("@Get()\n@Post('x')\n@Patch(':id')\n@ApiOkResponse()", DECORATOR_DE_ROTA)).toBe(3);
  });
});

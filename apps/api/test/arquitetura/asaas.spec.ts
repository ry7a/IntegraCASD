// B4: só o Cliente Asaas fala com o Asaas.
// Chamadas HTTP e a URL do Asaas só podem aparecer em src/compartilhado/asaas/.
// O resto do código depende de uma interface (veja apps/api/CLAUDE.md).
// A pasta ainda não existe: o teste passa assim mesmo, porque nenhum outro arquivo usa HTTP.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, caminhoRelativo, lerCodigo, listarArquivos } from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

const PASTA_DO_CLIENTE = path.join(PASTA_SRC, 'compartilhado', 'asaas');

// fetch( , axios, undici, a URL do Asaas e os módulos http/https do Node.
const PROIBIDO = /\bfetch\s*\(|axios|undici|asaas\.com|['"](node:)?https?['"]/;

describe('B4: só o Cliente Asaas fala com o Asaas', () => {
  it('HTTP e a URL do Asaas só aparecem em src/compartilhado/asaas/', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => !arquivo.startsWith(PASTA_DO_CLIENTE + path.sep))
      .filter((arquivo) => PROIBIDO.test(lerCodigo(arquivo)))
      .map(caminhoRelativo);
    const { pendentes, obsoletas } = aplicarExcecoes('B4', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });
});

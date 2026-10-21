// B5: dinheiro em centavos, como inteiro. Nunca Float/Decimal e nunca arredondamento solto.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, RAIZ_API, caminhoRelativo, lerCodigo, listarArquivos, removerComentarios } from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// Lê o schema do Prisma e devolve cada campo como { modelo, campo, tipo }.
function lerCamposDoSchema() {
  const schema = removerComentarios(readFileSync(path.join(RAIZ_API, 'prisma', 'schema.prisma'), 'utf8'));
  const campos: Array<{ modelo: string; campo: string; tipo: string }> = [];
  for (const bloco of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    for (const linha of bloco[2].split('\n')) {
      // Uma linha de campo é: nome Tipo (com ? ou [] opcionais) ...
      const campo = linha.match(/^\s*(\w+)\s+(\w+)(\?|\[\])?/);
      if (campo) campos.push({ modelo: bloco[1], campo: campo[1], tipo: campo[2] });
    }
  }
  return campos;
}

describe('B5: dinheiro em centavos', () => {
  it('o schema tem campos para conferir (o leitor do schema funciona)', () => {
    expect(lerCamposDoSchema().length).toBeGreaterThan(0);
  });

  it('o schema não usa Float nem Decimal', () => {
    const violacoes = lerCamposDoSchema()
      .filter((c) => c.tipo === 'Float' || c.tipo === 'Decimal')
      .map((c) => `${c.modelo}.${c.campo}`);
    const { pendentes, obsoletas } = aplicarExcecoes('B5', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });

  it('todo campo terminado em Centavos é Int', () => {
    const campos = lerCamposDoSchema().filter((c) => c.campo.endsWith('Centavos'));
    expect(campos.filter((c) => c.tipo !== 'Int').map((c) => `${c.modelo}.${c.campo}`)).toEqual([]);
  });

  it('o código não usa parseFloat nem .toFixed(', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => /\bparseFloat\b|\.toFixed\s*\(/.test(lerCodigo(arquivo)))
      .map(caminhoRelativo);
    const { pendentes, obsoletas } = aplicarExcecoes('B5', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });
});

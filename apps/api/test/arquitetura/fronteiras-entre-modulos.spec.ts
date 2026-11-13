// B1: fronteiras entre módulos (ADR-0001).
// Cada módulo tem um index.ts: a porta de entrada pública. Quem está fora do módulo
// só pode importar dali, nunca de arquivos internos (api/, aplicacao/, infra/...).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PASTA_MODULOS,
  PASTA_SRC,
  caminhoRelativo,
  extrairImports,
  lerCodigo,
  listarArquivos,
  listarModulos,
  resolverImportRelativo,
} from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// Devolve os imports do arquivo que entram em OUTRO módulo sem passar pelo index.
function importsQueFuramAFronteira(arquivo: string): string[] {
  const relativoAModulos = path.relative(PASTA_MODULOS, arquivo);
  const dentroDeModulos = !relativoAModulos.startsWith('..');
  const moduloDoArquivo = relativoAModulos.split(path.sep)[0];
  const ruins: string[] = [];

  for (const texto of extrairImports(readFileSync(arquivo, 'utf8'))) {
    const destino = resolverImportRelativo(arquivo, texto);
    if (destino === null) continue; // pacote (@nestjs/common...), não é módulo nosso
    const relativoDoDestino = path.relative(PASTA_MODULOS, destino);
    if (relativoDoDestino.startsWith('..')) continue; // não aponta para dentro de modulos/

    const [moduloDestino, ...resto] = relativoDoDestino.split(path.sep);
    if (dentroDeModulos && moduloDestino === moduloDoArquivo) continue; // import interno

    // Aceita "modulos/Y/index" e "modulos/Y/index.js".
    const ehIndex = resto.length === 1 && /^index(\.js)?$/.test(resto[0]);
    if (!ehIndex) ruins.push(texto);
  }
  return ruins;
}

describe('B1: fronteiras entre módulos [Padrões.NF003] CT-NF-07', () => {
  it('todo módulo tem um index.ts como ponto de entrada público', () => {
    const semIndex = listarModulos().filter(
      (modulo) => !existsSync(path.join(PASTA_MODULOS, modulo, 'index.ts')),
    );
    expect(semIndex).toEqual([]);
  });

  it('ninguém importa arquivos internos de outro módulo (só modulos/<nome>/index)', () => {
    const violacoes: string[] = [];
    for (const arquivo of listarArquivos(PASTA_SRC, '.ts')) {
      for (const texto of importsQueFuramAFronteira(arquivo)) {
        violacoes.push(`${caminhoRelativo(arquivo)} importa '${texto}'`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('compartilhado/ não depende de nenhum módulo', () => {
    const violacoes: string[] = [];
    for (const arquivo of listarArquivos(path.join(PASTA_SRC, 'compartilhado'), '.ts')) {
      for (const texto of extrairImports(readFileSync(arquivo, 'utf8'))) {
        const destino = resolverImportRelativo(arquivo, texto);
        if (destino !== null && !path.relative(PASTA_MODULOS, destino).startsWith('..')) {
          violacoes.push(`${caminhoRelativo(arquivo)} importa '${texto}'`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('não usa forwardRef (sinal de dependência circular entre módulos)', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => /\bforwardRef\b/.test(lerCodigo(arquivo)))
      .map(caminhoRelativo);
    const { pendentes, obsoletas } = aplicarExcecoes('B1', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });
});

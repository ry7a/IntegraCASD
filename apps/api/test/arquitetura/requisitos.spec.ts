// G5: rastreabilidade de requisitos.
// docs/governanca/requisitos-verificaveis.json lista os requisitos não funcionais que o
// código precisa respeitar. Regras:
// - "coberto": existe ao menos um teste (*.spec.ts em apps/api) que cita o requisito
//   entre colchetes, no formato [Categoria.NFnnn], como no documento de requisitos;
// - "pendente": precisa explicar o motivo;
// - todo requisito citado num teste precisa estar na lista;
// - todo id da lista precisa existir no documento de requisitos (.tex).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_API, RAIZ_REPO, listarArquivos } from './arquivos.js';

type Requisito = { id: string; titulo: string; situacao: string; motivo?: string };

const lista = JSON.parse(
  readFileSync(path.join(RAIZ_REPO, 'docs', 'governanca', 'requisitos-verificaveis.json'), 'utf8'),
) as { requisitos: Requisito[] };

// Conteúdo de cada teste do backend (os arquivos .spec.ts de src/ e test/).
const testes = ['src', 'test']
  .flatMap((pasta) => listarArquivos(path.join(RAIZ_API, pasta), '.spec.ts'))
  .map((arquivo) => readFileSync(arquivo, 'utf8'));

// Ids citados em testes: o texto entre colchetes, como em [Categoria.NFnnn].
const ID_CITADO = /\[([^\][.]+\.NF\d{3})\]/g;
const idsCitados = new Set(testes.flatMap((texto) => [...texto.matchAll(ID_CITADO)].map((m) => m[1])));

// Ids existentes no documento: cada \section{Categoria} seguida de \req{NFnnn}{...}.
function lerIdsDoDocumento(): Set<string> {
  const tex = readFileSync(
    path.join(RAIZ_REPO, 'docs', 'requisitos', 'IntegraCASD_DocRequisitos_v1.2.tex'),
    'utf8',
  );
  const ids = new Set<string>();
  let categoria = '';
  for (const linha of tex.split('\n')) {
    const secao = linha.match(/^\\section\{([^}]+)\}/);
    if (secao) categoria = secao[1];
    const requisito = linha.match(/^\\req\{(NF\d{3})\}/);
    if (requisito) ids.add(`${categoria}.${requisito[1]}`);
  }
  return ids;
}

describe('G5: rastreabilidade de requisitos', () => {
  it('todo requisito tem situação coberto ou pendente, e o pendente tem motivo', () => {
    const invalidos = lista.requisitos
      .filter((r) => {
        if (r.situacao === 'coberto') return false;
        return r.situacao !== 'pendente' || !r.motivo || r.motivo.trim() === '';
      })
      .map((r) => r.id);
    expect(invalidos).toEqual([]);
  });

  it('todo requisito coberto é citado por ao menos um teste', () => {
    const semTeste = lista.requisitos
      .filter((r) => r.situacao === 'coberto' && !idsCitados.has(r.id))
      .map((r) => r.id);
    expect(semTeste).toEqual([]);
  });

  it('todo requisito citado num teste está na lista', () => {
    const naLista = lista.requisitos.map((r) => r.id);
    expect([...idsCitados].filter((id) => !naLista.includes(id))).toEqual([]);
  });

  it('todo id da lista existe no documento de requisitos', () => {
    const existentes = lerIdsDoDocumento();
    expect(existentes.size).toBeGreaterThan(0);
    expect(lista.requisitos.map((r) => r.id).filter((id) => !existentes.has(id))).toEqual([]);
  });

  it('não há ids repetidos na lista', () => {
    const ids = lista.requisitos.map((r) => r.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});

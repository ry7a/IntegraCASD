// G3: lista de dependências aprovadas.
// Para ADICIONAR (ou remover) um pacote: combine com a equipe, depois edite
// docs/governanca/dependencias.json NO MESMO COMMIT que altera o package.json.
// O teste falha enquanto o package.json e a lista não estiverem de acordo.
//
// Também garante as versões fixadas do projeto (veja o CLAUDE.md da raiz):
// typescript 6.0.3 (o 7 quebra a CLI do NestJS) e Prisma 7.10.0 (a tag "latest" é uma RC).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_REPO } from './arquivos.js';

type PackageJson = {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
type ListaAprovada = Record<
  string,
  { dependencies?: string[]; devDependencies?: string[]; peerDependencies?: string[] }
>;

const PACOTES_DO_WORKSPACE = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/api-client/package.json',
];

// Versões exatas obrigatórias, onde o pacote aparecer.
const VERSOES_FIXADAS: Record<string, string> = {
  typescript: '6.0.3',
  prisma: '7.10.0',
  '@prisma/client': '7.10.0',
  '@prisma/adapter-pg': '7.10.0', // tem de andar junto com o @prisma/client
};

const TIPOS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

function lerJson<T>(caminhoRelativo: string): T {
  return JSON.parse(readFileSync(path.join(RAIZ_REPO, caminhoRelativo), 'utf8')) as T;
}

const aprovadas = lerJson<ListaAprovada>('docs/governanca/dependencias.json');

describe('G3: dependências aprovadas', () => {
  for (const arquivo of PACOTES_DO_WORKSPACE) {
    const pacote = lerJson<PackageJson>(arquivo);

    it(`${arquivo} só tem dependências da lista aprovada`, () => {
      const lista = aprovadas[pacote.name];
      expect(lista, `${pacote.name} não está em docs/governanca/dependencias.json`).toBeDefined();

      for (const tipo of TIPOS) {
        const noPackageJson = Object.keys(pacote[tipo] ?? {}).sort();
        const naLista = [...(lista[tipo] ?? [])].sort();
        // Mensagem do diff: o que está no package.json e falta na lista, e vice-versa.
        expect({
          [`${tipo} fora da lista`]: noPackageJson.filter((nome) => !naLista.includes(nome)),
          [`${tipo} na lista mas ausentes do package.json`]: naLista.filter(
            (nome) => !noPackageJson.includes(nome),
          ),
        }).toEqual({
          [`${tipo} fora da lista`]: [],
          [`${tipo} na lista mas ausentes do package.json`]: [],
        });
      }
    });

    it(`${arquivo} respeita as versões fixadas`, () => {
      const erradas: string[] = [];
      for (const tipo of TIPOS) {
        for (const [nome, versao] of Object.entries(pacote[tipo] ?? {})) {
          const esperada = VERSOES_FIXADAS[nome];
          if (esperada !== undefined && versao !== esperada) {
            erradas.push(`${nome}: ${versao} (esperado ${esperada})`);
          }
        }
      }
      expect(erradas).toEqual([]);
    });
  }

  it('todo pacote da lista existe no workspace (sem entradas esquecidas)', () => {
    const nomes = PACOTES_DO_WORKSPACE.map((arquivo) => lerJson<PackageJson>(arquivo).name).sort();
    expect(Object.keys(aprovadas).sort()).toEqual(nomes);
  });
});

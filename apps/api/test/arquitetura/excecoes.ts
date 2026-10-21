// Leitura das exceções explícitas (docs/governanca/excecoes.json).
// Regra de ouro: uma regra de arquitetura nunca é enfraquecida; quando existe um motivo
// legítimo para violá-la, a violação é registrada ali, com justificativa e referência.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ_REPO } from './arquivos.js';

export type Excecao = {
  regra: string;
  alvo: string;
  justificativa: string;
  referencia: string;
};

// Regras cujos testes consultam o arquivo de exceções (G4).
export const REGRAS_QUE_ACEITAM_EXCECAO = [
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B8', 'B11', 'B12', 'F5',
];

export function lerExcecoes(): Excecao[] {
  const arquivo = path.join(RAIZ_REPO, 'docs', 'governanca', 'excecoes.json');
  return JSON.parse(readFileSync(arquivo, 'utf8')) as Excecao[];
}

// Recebe as violações encontradas por uma regra (cada uma identificada por um "alvo",
// como o caminho do arquivo) e separa:
// - pendentes: violações SEM exceção registrada (o teste deve falhar);
// - obsoletas: exceções registradas que não correspondem a nenhuma violação
//   (a exceção não é mais necessária e precisa ser removida; o teste também falha).
export function aplicarExcecoes(regra: string, violacoes: string[]) {
  const doTipo = lerExcecoes().filter((excecao) => excecao.regra === regra);
  const alvosComExcecao = doTipo.map((excecao) => excecao.alvo);
  return {
    pendentes: violacoes.filter((alvo) => !alvosComExcecao.includes(alvo)),
    obsoletas: alvosComExcecao.filter((alvo) => !violacoes.includes(alvo)),
  };
}

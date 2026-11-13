// G7: os ganchos do git barram merge e push com lint, teste ou função de aptidão falhando.
// Sem pull request nem revisão obrigatória, os ganchos são o último portão antes da main. Este teste confere
// que eles existem, rodam as três verificações e saem com erro quando uma falha, e que o `pnpm install` os liga.
// A demonstração de ponta a ponta (quebrar um teste e ver o merge parar) é manual: veja docs/testes.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_REPO } from './arquivos.js';

const GANCHOS = ['pre-merge-commit', 'pre-push'];

describe('G7: os ganchos do git barram merge e push com teste falhando CT-NF-07', () => {
  it.each(GANCHOS)('.githooks/%s roda lint, testes e arquitetura e sai com erro se algo falhar', (gancho) => {
    const arquivo = path.join(RAIZ_REPO, '.githooks', gancho);
    expect(existsSync(arquivo)).toBe(true);
    const texto = readFileSync(arquivo, 'utf8');
    // As três verificações encadeadas com &&: a primeira que falhar interrompe as outras.
    expect(texto).toMatch(/pnpm lint && pnpm test && (BASE_GIT="\$BASE" )?pnpm verificar:arquitetura/);
    // E a falha vira código de saída diferente de zero, que é o que faz o git desistir.
    expect(texto).toMatch(/if \[ \$\? -ne 0 \]; then[\s\S]*exit 1/);
  });

  it('o pnpm install liga os ganchos (script prepare aponta o core.hooksPath para .githooks)', () => {
    const pacote = JSON.parse(readFileSync(path.join(RAIZ_REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pacote.scripts.prepare).toContain('git config core.hooksPath .githooks');
  });
});

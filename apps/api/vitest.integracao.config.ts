import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { urlDoBancoDeIntegracao } from './test/apoio/banco-de-integracao.js';

// Testes de integração (test/integracao) e de sistema (test/sistema) do Plano de Testes.
// Diferente do `pnpm test`, estes usam um PostgreSQL DE VERDADE: o banco `integracasd_integracao`, apagado e
// recriado a cada execução (test/apoio/preparar-banco.ts). O Asaas e o e-mail continuam falsos.
// Não rodam no gancho do git nem no CI. Para rodar, na raiz:
//   docker compose up -d
//   pnpm test:integracao
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/integracao/**/*.spec.ts', 'test/sistema/**/*.spec.ts'],
    globalSetup: ['test/apoio/preparar-banco.ts'],
    // Relatório "verbose": mostra o nome de cada teste (evidência para o relatório de testes) e o que eles
    // escrevem no terminal, como os tempos medidos pelo CT-NF-03.
    reporters: ['verbose'],
    // Todos os arquivos usam o mesmo banco: um arquivo por vez, para um não atrapalhar a contagem do outro.
    fileParallelism: false,
    // Variáveis de ambiente que a aplicação lê. Os valores são de teste, não segredos: o token do webhook e a
    // chave de cifragem só valem neste banco, que é apagado a cada execução. As do Asaas e do e-mail ficam
    // vazias de propósito, para nada daqui chegar a um serviço de verdade.
    env: {
      DATABASE_URL: urlDoBancoDeIntegracao(),
      ASAAS_WEBHOOK_TOKEN: 'token-do-webhook-so-para-teste',
      CHAVE_DE_CIFRAGEM: Buffer.alloc(32, 7).toString('base64'),
      ASAAS_AMBIENTE: '',
      ASAAS_API_KEY: '',
      EMAIL_API_KEY: '',
      EMAIL_ALERTAS_PARA: '',
      GERACAO_A_PARTIR_DE: '',
    },
    // Cada arquivo sobe a aplicação inteira (Nest, Prisma e pg-boss) e alguns criam mil alunos.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});

import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// No Prisma 7 a CLI não lê o .env sozinha. O .env do projeto fica na raiz
// do monorepo, então carregamos ele aqui (recurso nativo do Node, sem dotenv).
// No CI não existe .env: o `prisma generate` não precisa de banco e funciona assim mesmo.
const arquivoEnv = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env em vez do helper env() do Prisma: o env() lança erro quando a
    // variável não existe, o que quebraria o `prisma generate` no CI.
    url: process.env.DATABASE_URL,
  },
});

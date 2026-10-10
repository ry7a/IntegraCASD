import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

// Em desenvolvimento, carrega o .env da raiz do monorepo (recurso nativo do Node).
// Em produção não há .env: as variáveis vêm do ambiente do contêiner.
const arquivoEnv = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  ConsumidorDaGeracaoRecorrente,
  ConsumidorDaSincronizacao,
  ConsumidorDaVigilancia,
  ConsumidorDeEventosWebhook,
  ConsumidorDoReprocessamento,
  ReacaoAAlunoAlterado,
} from './modulos/cobrancas/index.js';
import { WorkerModule } from './worker.module.js';
import { validarConfiguracaoNaSubida } from './compartilhado/configuracao.js';

// Mesmo padrão do main.ts: em desenvolvimento carrega o .env da raiz do monorepo.
// Este arquivo roda compilado em apps/api/dist/, por isso sobe três níveis até a raiz.
const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

async function bootstrap() {
  // Em produção, sem DATABASE_URL e CHAVE_DE_CIFRAGEM válidas o worker nem sobe.
  validarConfiguracaoNaSubida('worker');
  // "Application context" = a aplicação Nest sem servidor HTTP: só o container de injeção.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // Ao receber Ctrl+C (ou o sinal de parada), o Nest fecha a fila e o banco com calma.
  app.enableShutdownHooks();
  await app.get(ConsumidorDeEventosWebhook).iniciar();
  await app.get(ConsumidorDaGeracaoRecorrente).iniciar();
  await app.get(ReacaoAAlunoAlterado).iniciar();
  await app.get(ConsumidorDoReprocessamento).iniciar();
  await app.get(ConsumidorDaSincronizacao).iniciar();
  await app.get(ConsumidorDaVigilancia).iniciar();
}
await bootstrap();

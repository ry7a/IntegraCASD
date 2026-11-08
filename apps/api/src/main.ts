import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp, criarDocumentoOpenApi } from './openapi.js';

// Em desenvolvimento, carrega o .env da raiz do monorepo (recurso nativo do Node).
// Em produção não há .env: as variáveis vêm do ambiente do contêiner.
// Este arquivo roda compilado em apps/api/dist/, por isso sobe três níveis até a raiz.
const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  // Documentação navegável da API em http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, criarDocumentoOpenApi(app));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

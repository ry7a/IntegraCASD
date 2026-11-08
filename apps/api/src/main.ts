import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { validarConfiguracaoNaSubida } from './compartilhado/configuracao.js';
import { configurarApp, criarDocumentoOpenApi } from './openapi.js';

// Em desenvolvimento, carrega o .env da raiz do monorepo (recurso nativo do Node).
// Em produção não há .env: as variáveis vêm do ambiente do contêiner.
// Este arquivo roda compilado em apps/api/dist/, por isso sobe três níveis até a raiz.
const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

async function bootstrap() {
  // Em produção, sem DATABASE_URL, CHAVE_DE_CIFRAGEM e ASAAS_WEBHOOK_TOKEN válidos a API nem sobe.
  validarConfiguracaoNaSubida('api');
  const emProducao = process.env.NODE_ENV === 'production';

  // NestExpressApplication: o mesmo app, com os métodos do Express (set, disable...) tipados.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  // Ao receber o sinal de parada (a Railway manda SIGTERM a cada implantação), o Nest fecha a fila e o
  // banco com calma, em vez de cortar requisições no meio.
  app.enableShutdownHooks();

  // Na Railway há exatamente um proxy na frente da API. Com "trust proxy" = 1, o Express lê o IP e o
  // protocolo (https) do cabeçalho X-Forwarded-* que esse proxy põe, sem confiar em mais ninguém.
  app.set('trust proxy', 1);
  // Não anuncia "X-Powered-By: Express" nas respostas: é informação de graça para quem procura falhas.
  app.disable('x-powered-by');

  if (!emProducao) {
    // Documentação navegável da API em http://localhost:3000/api/docs. Fica fechada em produção.
    SwaggerModule.setup('api/docs', app, criarDocumentoOpenApi(app));
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

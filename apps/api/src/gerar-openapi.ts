import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp, criarDocumentoOpenApi } from './openapi.js';

// Mesmo padrão do main.ts: carrega o .env da raiz do monorepo, se existir. Montar a
// aplicação exige as variáveis (o PgBossService, por exemplo, lê o DATABASE_URL), mesmo sem
// conectar no banco. No CI não há .env: o workflow passa as variáveis.
const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

// Grava o contrato da API em packages/api-client/openapi.json, de onde o orval
// gera o cliente do frontend. Monta a aplicação sem abrir porta e sem consultar o banco.
// Uso (na raiz): pnpm gerar:cliente-api
async function gerar() {
  // Só os erros vão para o terminal: sem isso, uma falha ao montar a aplicação
  // terminaria o script sem nenhuma mensagem.
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configurarApp(app);
  const documento = criarDocumentoOpenApi(app);

  const destino = path.resolve(import.meta.dirname, '../../../packages/api-client/openapi.json');
  writeFileSync(destino, JSON.stringify(documento, null, 2) + '\n');
  // process.stdout.write em vez de console.log: a regra no-console (B11) vale para todo o src/.
  process.stdout.write(`OpenAPI gravado em ${destino}\n`);

  await app.close();
}
await gerar();

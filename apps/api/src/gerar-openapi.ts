import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp, criarDocumentoOpenApi } from './openapi.js';

// Grava o contrato da API em packages/api-client/openapi.json, de onde o orval
// gera o cliente do frontend. Monta a aplicação sem abrir porta e sem consultar o banco.
// Uso (na raiz): pnpm gerar:cliente-api
async function gerar() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app);
  const documento = criarDocumentoOpenApi(app);

  const destino = path.resolve(import.meta.dirname, '../../../packages/api-client/openapi.json');
  writeFileSync(destino, JSON.stringify(documento, null, 2) + '\n');
  // process.stdout.write em vez de console.log: a regra no-console (B11) vale para todo o src/.
  process.stdout.write(`OpenAPI gravado em ${destino}\n`);

  await app.close();
}
await gerar();

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Configuração usada tanto pela API (main.ts) quanto pelo script que grava o
// openapi.json (gerar-openapi.ts). Assim os dois enxergam exatamente as mesmas rotas.

export function configurarApp(app: INestApplication) {
  // Toda rota fica sob /api. No frontend, o Vite repassa /api para a porta 3000.
  app.setGlobalPrefix('api');
}

export function criarDocumentoOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('IntegraCASD')
    .setDescription('API do sistema de gestão financeira do CASD')
    .setVersion('0.0.1')
    .build();
  return SwaggerModule.createDocument(app, config);
}

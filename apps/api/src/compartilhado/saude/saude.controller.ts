import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Publico } from '../autenticacao/publico.decorator.js';
import { ConferirSaude } from './conferir-saude.js';
import type { RespostaDaSaude } from './saude.js';

// Rotas de saúde, públicas (quem chama é a Railway e o monitor externo, sem sessão). Ficam fora do
// OpenAPI, como o webhook: o frontend não as usa. Respondem só situações, nunca detalhes do erro.
@ApiExcludeController()
@Publico()
@Controller('saude')
export class SaudeController {
  constructor(private readonly conferir: ConferirSaude) {}

  // 200 se o banco responde; 503 senão. Usada pela Railway para liberar cada implantação.
  @Get()
  async basica(@Res({ passthrough: true }) resposta: Response) {
    return responder(resposta, await this.conferir.basica());
  }

  // 200 se o banco responde e a vigilância do Asaas rodou na última hora; 503 senão.
  @Get('completa')
  async completa(@Res({ passthrough: true }) resposta: Response) {
    return responder(resposta, await this.conferir.completa());
  }
}

// passthrough: o Nest continua enviando o corpo devolvido; aqui só trocamos o código HTTP e impedimos
// que algum proxy guarde em cache uma resposta de saúde antiga.
function responder(resposta: Response, saude: RespostaDaSaude) {
  resposta.status(saude.status);
  resposta.setHeader('Cache-Control', 'no-store');
  return saude.corpo;
}

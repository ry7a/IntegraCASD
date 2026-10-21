import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ReceberEventoWebhook } from '../aplicacao/receber-evento-webhook.js';
import type { EventoRecebido } from '../aplicacao/receber-evento-webhook.js';
import { TokenDoWebhookGuard } from './token-do-webhook.guard.js';

// Webhook do Asaas: valida o token (guard), grava o evento, enfileira e responde 200.
// Nenhuma regra de negócio aqui. Fica fora do OpenAPI: só o Asaas chama esta rota,
// então o frontend não precisa de cliente gerado para ela.
@ApiExcludeController()
@Controller('webhooks/asaas')
@UseGuards(TokenDoWebhookGuard)
export class WebhookAsaasController {
  constructor(private readonly receberEventoWebhook: ReceberEventoWebhook) {}

  // O Nest responderia 201 num POST; o Asaas espera 200.
  @Post()
  @HttpCode(200)
  async receber(@Body() corpo: unknown): Promise<{ recebido: true }> {
    await this.receberEventoWebhook.executar(lerEvento(corpo));
    return { recebido: true };
  }
}

// Confere o mínimo de que precisamos do corpo: o id do evento e o tipo. O resto do corpo
// é guardado como veio, para o worker interpretar depois.
function lerEvento(corpo: unknown): EventoRecebido {
  if (typeof corpo === 'object' && corpo !== null && !Array.isArray(corpo)) {
    const { id, event } = corpo as Record<string, unknown>;
    if (typeof id === 'string' && id !== '' && typeof event === 'string' && event !== '') {
      return { idAsaas: id, tipo: event, payload: corpo as EventoRecebido['payload'] };
    }
  }
  throw new BadRequestException('O corpo do evento precisa ter "id" e "event".');
}

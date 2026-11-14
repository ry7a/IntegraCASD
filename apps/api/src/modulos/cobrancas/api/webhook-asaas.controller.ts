import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ReceberEventoWebhook } from '../aplicacao/receber-evento-webhook.js';
import type { EventoRecebido } from '../aplicacao/receber-evento-webhook.js';
import { TokenDoWebhookGuard } from './token-do-webhook.guard.js';
import { Publico } from '../../../compartilhado/autenticacao/publico.decorator.js';
import { lerTexto } from '../../../compartilhado/leitura-de-entrada.js';

// Webhook do Asaas: valida o token (guard), grava o evento, enfileira e responde 200.
// Nenhuma regra de negócio aqui. Fica fora do OpenAPI: só o Asaas chama esta rota,
// então o frontend não precisa de cliente gerado para ela.
@ApiExcludeController()
@Publico()
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

// Limites do formato do evento, não regra de negócio (ADR-0002): acima deles o banco recusaria a
// gravação e o webhook responderia 500 ([Confiabilidade.NF001]). Os ids do Asaas têm umas dezenas de
// caracteres; um id enorme estoura o índice único de id_asaas. Os tipos (PAYMENT_RECEIVED...) têm menos de 40.
// Os avisos do Asaas têm uns 4 níveis de objetos; milhares de listas aninhadas estouram a pilha ao gravar.
const TAMANHO_MAXIMO_DO_ID = 255;
const TAMANHO_MAXIMO_DO_TIPO = 100;
const PROFUNDIDADE_MAXIMA = 32; // o corpo é o nível 1

// Confere o mínimo de que precisamos do corpo: o id do evento e o tipo, e os limites acima. O resto
// do corpo é guardado como veio, para o worker interpretar depois.
function lerEvento(corpo: unknown): EventoRecebido {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw new BadRequestException('O corpo do evento precisa ter "id" e "event".');
  }
  const { id, event } = corpo as Record<string, unknown>;
  if (typeof id !== 'string' || id === '' || typeof event !== 'string' || event === '') {
    throw new BadRequestException('O corpo do evento precisa ter "id" e "event".');
  }
  if (id.length > TAMANHO_MAXIMO_DO_ID) {
    throw new BadRequestException(`O "id" do evento passa de ${TAMANHO_MAXIMO_DO_ID} caracteres.`);
  }
  if (event.length > TAMANHO_MAXIMO_DO_TIPO) {
    throw new BadRequestException(`O "event" do evento passa de ${TAMANHO_MAXIMO_DO_TIPO} caracteres.`);
  }
  const problema = problemaNoCorpo(corpo, 1);
  if (problema === 'aninhado-demais') {
    throw new BadRequestException(`O corpo do evento passa de ${PROFUNDIDADE_MAXIMA} níveis de objetos e listas aninhados.`);
  }
  if (problema === 'caractere-nulo') {
    throw new BadRequestException('O corpo do evento tem caractere nulo (\\u0000), que não pode ser gravado.');
  }
  return { idAsaas: id, tipo: event, payload: corpo as EventoRecebido['payload'] };
}

// Percorre o corpo inteiro: todo texto (valores e nomes de chaves) sem caractere nulo e no máximo
// PROFUNDIDADE_MAXIMA níveis de objetos e listas. Para no primeiro problema; por isso a recursão nunca
// passa de PROFUNDIDADE_MAXIMA + 1 chamadas, por mais fundo que o corpo seja, e não estoura a pilha.
function problemaNoCorpo(valor: unknown, nivel: number): 'caractere-nulo' | 'aninhado-demais' | null {
  if (typeof valor === 'string') return temCaractereNulo(valor) ? 'caractere-nulo' : null;
  if (typeof valor !== 'object' || valor === null) return null; // número, booleano ou null
  if (nivel > PROFUNDIDADE_MAXIMA) return 'aninhado-demais';
  // Object.entries também serve para listas: as chaves são os índices ("0", "1"...).
  for (const [chave, item] of Object.entries(valor)) {
    if (temCaractereNulo(chave)) return 'caractere-nulo';
    const problema = problemaNoCorpo(item, nivel + 1);
    if (problema !== null) return problema;
  }
  return null;
}

// O PostgreSQL recusa o caractere nulo em texto e em JSON. A regra é a do texto do módulo comum; o
// tamanho não importa aqui (por isso o máximo infinito), só o motivo da recusa.
function temCaractereNulo(texto: string): boolean {
  const leitura = lerTexto(texto, Number.POSITIVE_INFINITY);
  return !leitura.valido && leitura.motivo === 'caractere-nulo';
}

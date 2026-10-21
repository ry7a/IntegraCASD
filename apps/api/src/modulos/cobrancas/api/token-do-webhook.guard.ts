import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

// Guard: um filtro que roda antes do controller e decide se a requisição pode seguir.
// Aqui ele confere o cabeçalho `asaas-access-token` contra o ASAAS_WEBHOOK_TOKEN do .env.
@Injectable()
export class TokenDoWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TokenDoWebhookGuard.name);

  canActivate(contexto: ExecutionContext): boolean {
    const esperado = process.env.ASAAS_WEBHOOK_TOKEN ?? '';
    // Sem token configurado (ou ainda com o valor de exemplo), recusa tudo: nunca aceitar
    // requisição de graça por esquecimento de configuração.
    if (esperado === '' || esperado.startsWith('coloque-')) {
      this.logger.error('ASAAS_WEBHOOK_TOKEN não está preenchido no .env; webhook recusado.');
      throw new UnauthorizedException();
    }

    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const recebido = requisicao.header('asaas-access-token') ?? '';

    if (!tokensIguais(recebido, esperado)) {
      // O token recebido nunca vai para o log.
      this.logger.warn('Webhook recusado: token inválido.');
      throw new UnauthorizedException();
    }
    return true;
  }
}

// Comparação em tempo constante: um `===` termina mais cedo quando as primeiras letras
// diferem, e esse detalhe de tempo poderia ajudar alguém a descobrir o token aos poucos.
function tokensIguais(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

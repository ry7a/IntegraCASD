import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { TokenDoWebhookGuard } from './token-do-webhook.guard.js';

// Monta só o pedaço do contexto que o guard usa: o cabeçalho da requisição.
function criarContexto(token?: string) {
  const requisicao = {
    header: (nome: string) => (nome === 'asaas-access-token' ? token : undefined),
  };
  return { switchToHttp: () => ({ getRequest: () => requisicao }) } as unknown as ExecutionContext;
}

describe('TokenDoWebhookGuard', () => {
  const tokenOriginal = process.env.ASAAS_WEBHOOK_TOKEN;

  beforeEach(() => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-falso-de-teste';
  });

  afterAll(() => {
    // Restaura o ambiente para não afetar outros testes.
    if (tokenOriginal === undefined) {
      delete process.env.ASAAS_WEBHOOK_TOKEN;
    } else {
      process.env.ASAAS_WEBHOOK_TOKEN = tokenOriginal;
    }
  });

  it('deixa passar quando o token confere', () => {
    expect(new TokenDoWebhookGuard().canActivate(criarContexto('token-falso-de-teste'))).toBe(true);
  });

  it('recusa um token diferente', () => {
    expect(() => new TokenDoWebhookGuard().canActivate(criarContexto('outro-token'))).toThrow(
      UnauthorizedException,
    );
  });

  it('recusa quando o cabeçalho não vem', () => {
    expect(() => new TokenDoWebhookGuard().canActivate(criarContexto())).toThrow(
      UnauthorizedException,
    );
  });

  it('recusa tudo se o token não estiver configurado no .env', () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    expect(() => new TokenDoWebhookGuard().canActivate(criarContexto(''))).toThrow(
      UnauthorizedException,
    );
  });
});

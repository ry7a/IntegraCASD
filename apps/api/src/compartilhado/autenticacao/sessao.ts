import { createHash, randomBytes } from 'node:crypto';

export const NOME_COOKIE_SESSAO = 'integracasd_sessao';
export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

export function criarTokenDeSessao(): string {
  return randomBytes(32).toString('base64url');
}

export function resumirToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function lerTokenDoCookie(cabecalho: string | undefined): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const [nome, ...valor] = parte.trim().split('=');
    if (nome === NOME_COOKIE_SESSAO) return decodeURIComponent(valor.join('='));
  }
  return null;
}

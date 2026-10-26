import type { Prisma } from '../../../generated/prisma/client.js';

// Chaves do lock de cada tipo de código: qualquer número fixo, desde que diferente entre os tipos.
export const CHAVE_DO_CODIGO_DE_CONTRATO = 7_251_001;
export const CHAVE_DO_CODIGO_DE_PROJETO = 7_251_002;

// O código é "o próximo da sequência" (24C002 -> 24C003): se duas pessoas criam ao mesmo tempo, as duas
// leriam o mesmo último número e gerariam o mesmo código. O lock do PostgreSQL faz a segunda esperar a
// primeira terminar a transação; aí ela já enxerga o código da primeira. O lock é solto sozinho no
// fim da transação (`xact`). O UNIQUE da coluna `codigo` continua como rede de segurança.
export async function reservarSequenciaDoCodigo(tx: Prisma.TransactionClient, chave: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${chave})`;
}

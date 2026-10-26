import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifra de segredos guardados no banco (a chave do Asaas) [Segurança.NF003], com AES-256-GCM do próprio
// Node (sem biblioteca nova). O GCM também detecta adulteração: um texto cifrado alterado não decifra.
// A chave-mestra vem do .env (CHAVE_DE_CIFRAGEM, 32 bytes em base64) e nunca vai para o banco.
//
// Formato guardado: base64 de [vetor de inicialização (12 bytes) | etiqueta (16 bytes) | texto cifrado].

const ALGORITMO = 'aes-256-gcm';

export class ChaveDeCifragemAusente extends Error {
  constructor() {
    super('CHAVE_DE_CIFRAGEM não está preenchida no .env (32 bytes em base64).');
  }
}

export function chaveMestraDoAmbiente(env: NodeJS.ProcessEnv = process.env): Buffer {
  const chave = Buffer.from(env.CHAVE_DE_CIFRAGEM ?? '', 'base64');
  if (chave.length !== 32) throw new ChaveDeCifragemAusente();
  return chave;
}

export function cifrar(texto: string, chaveMestra: Buffer): string {
  const vetor = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, chaveMestra, vetor);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return Buffer.concat([vetor, cifrador.getAuthTag(), cifrado]).toString('base64');
}

export function decifrar(guardado: string, chaveMestra: Buffer): string {
  const bytes = Buffer.from(guardado, 'base64');
  const decifrador = createDecipheriv(ALGORITMO, chaveMestra, bytes.subarray(0, 12));
  decifrador.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decifrador.update(bytes.subarray(28)), decifrador.final()]).toString('utf8');
}

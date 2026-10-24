import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

const MEMORIA_KIB = 65_536;
const ITERACOES = 3;
const PARALELISMO = 1;
const TAMANHO_HASH = 32;

type ParametrosArgon2 = {
  message: string;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

function derivar(senha: string, sal: Buffer): Promise<Buffer> {
  const parametros: ParametrosArgon2 = {
    message: senha,
    nonce: sal,
    parallelism: PARALELISMO,
    tagLength: TAMANHO_HASH,
    memory: MEMORIA_KIB,
    passes: ITERACOES,
  };
  return new Promise((resolve, reject) => {
    argon2('argon2id', parametros, (erro, hash) => {
      if (erro) reject(erro);
      else resolve(hash);
    });
  });
}

// Formato proprio, versionado e autocontido: algoritmo$parametros$sal$hash.
export async function criarHashDaSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal);
  return `argon2id$v=19$m=${MEMORIA_KIB},t=${ITERACOES},p=${PARALELISMO}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function senhaConfere(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 5 || partes[0] !== 'argon2id' || partes[1] !== 'v=19') return false;

  try {
    const sal = Buffer.from(partes[3], 'base64');
    const esperado = Buffer.from(partes[4], 'base64');
    if (sal.length !== 16 || esperado.length !== TAMANHO_HASH) return false;
    const calculado = await derivar(senha, sal);
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

// Evita revelar pela duracao da resposta se um e-mail esta cadastrado.
export async function simularVerificacaoDeSenha(senha: string): Promise<void> {
  await derivar(senha, Buffer.alloc(16, 0x5a));
}

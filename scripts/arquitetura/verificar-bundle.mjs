// F8: orçamento de bundle. Mede o tamanho (gzip) dos .js de apps/web/dist/assets e falha
// se a soma passar do limite. Rode depois do build: pnpm build && pnpm verificar:build
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// Limite da soma dos .js em gzip: 215 KB (1 KB = 1000 bytes, como o Vite informa).
// Motivo: em 2026-10-21 o bundle único media ~170 KB; o limite deixa ~25% de folga.
// Serve para pegar um salto inesperado (biblioteca pesada importada sem querer).
// Se uma funcionalidade legítima estourar o limite, aumente aqui NO MESMO COMMIT,
// explicando o motivo na mensagem, depois de combinar com a equipe.
const LIMITE_EM_BYTES = 215_000

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pastaAssets = path.join(raiz, 'apps', 'web', 'dist', 'assets')

let arquivos
try {
  arquivos = readdirSync(pastaAssets).filter((nome) => nome.endsWith('.js'))
} catch {
  console.error('apps/web/dist/assets não existe. Rode "pnpm build" antes.')
  process.exit(1)
}
if (arquivos.length === 0) {
  console.error('Nenhum .js em apps/web/dist/assets.')
  process.exit(1)
}

let total = 0
for (const nome of arquivos) {
  const tamanho = gzipSync(readFileSync(path.join(pastaAssets, nome))).length
  total += tamanho
  console.log(`  ${nome}: ${(tamanho / 1000).toFixed(1)} KB (gzip)`)
}

const mensagem = `Bundle JS (F8): ${(total / 1000).toFixed(1)} KB gzip, limite ${(LIMITE_EM_BYTES / 1000).toFixed(0)} KB.`
if (total > LIMITE_EM_BYTES) {
  console.error(`${mensagem} ESTOUROU o orçamento.`)
  process.exit(1)
}
console.log(`${mensagem} ok.`)

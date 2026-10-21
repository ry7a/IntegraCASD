// F6 (parte do build): dados fictícios não chegam à produção.
// Procura em apps/web/dist os marcadores "dados-ficticios-integracasd:<feature>" que cada
// features/<x>/dados-ficticios.ts deixa no bundle (veja compartilhado/dados-ficticios-marcador.ts).
//
// Modo padrão (AVISO): lista as features que ainda usam dados fictícios e sai com 0.
// Modo --estrito: falha (código 1) se houver qualquer marcador. Hoje as telas usam dados
// fictícios de propósito; o ADR-0003 registra quando passar o CI para --estrito.
//
// Uso: node scripts/arquitetura/verificar-dados-ficticios.mjs [--estrito]
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const estrito = process.argv.includes('--estrito')
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pastaAssets = path.join(raiz, 'apps', 'web', 'dist', 'assets')

let arquivos
try {
  arquivos = readdirSync(pastaAssets).filter((nome) => nome.endsWith('.js'))
} catch {
  console.error('apps/web/dist/assets não existe. Rode "pnpm build" antes.')
  process.exit(1)
}

const features = new Set()
for (const nome of arquivos) {
  const conteudo = readFileSync(path.join(pastaAssets, nome), 'utf8')
  for (const achado of conteudo.matchAll(/dados-ficticios-integracasd:([a-z-]+)/g)) {
    features.add(achado[1])
  }
}

if (features.size === 0) {
  console.log('Dados fictícios (F6): nenhum marcador no bundle. ok.')
} else if (estrito) {
  console.error(`Dados fictícios (F6): o bundle ainda contém dados fictícios das features: ${[...features].join(', ')}.`)
  process.exit(1)
} else {
  console.warn(
    `AVISO (F6): o bundle ainda contém dados fictícios das features: ${[...features].join(', ')}. ` +
      'Tudo bem durante o protótipo; passe a usar --estrito quando as telas estiverem integradas à API.',
  )
}

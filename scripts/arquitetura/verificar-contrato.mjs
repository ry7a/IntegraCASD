// F3: contrato sincronizado. O cliente da API (packages/api-client) precisa estar em dia
// com os controllers do backend.
//
// Como funciona: tira uma "foto" (hash) dos arquivos de packages/api-client, roda
// `pnpm gerar:cliente-api` e compara. Se algo mudou, quem alterou a API esqueceu de
// regenerar e commitar o cliente. É mais seguro que "git diff", que não vê arquivos novos
// e se confunde com mudanças ainda não commitadas.
//
// Não precisa de banco de dados: gerar-openapi.ts monta a aplicação sem conectar.
// Uso (na raiz): pnpm verificar:contrato
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pasta = path.join(raiz, 'packages', 'api-client')

// Arquivo -> hash do conteúdo, ignorando node_modules.
function fotografar() {
  const foto = new Map()
  const arquivos = readdirSync(pasta, { recursive: true, encoding: 'utf8' })
    .filter((relativo) => !relativo.split(path.sep).includes('node_modules'))
    .sort()
  for (const relativo of arquivos) {
    const completo = path.join(pasta, relativo)
    try {
      foto.set(relativo.split(path.sep).join('/'), createHash('sha256').update(readFileSync(completo)).digest('hex'))
    } catch {
      // diretório: não tem conteúdo para somar ao hash
    }
  }
  return foto
}

const antes = fotografar()
execSync('pnpm gerar:cliente-api', { cwd: raiz, stdio: 'inherit' })
const depois = fotografar()

const diferentes = [...new Set([...antes.keys(), ...depois.keys()])].filter((arquivo) => antes.get(arquivo) !== depois.get(arquivo))

if (diferentes.length > 0) {
  console.error('\nContrato fora de sincronia (F3). Estes arquivos mudaram ao regenerar o cliente:\n')
  for (const arquivo of diferentes) console.error(`  - packages/api-client/${arquivo}`)
  console.error('\nRode "pnpm gerar:cliente-api" e faça commit dos arquivos gerados.')
  process.exit(1)
}
console.log('\nContrato (F3): cliente da API em dia com o backend.')

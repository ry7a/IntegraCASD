// F5 (parte CSS): tema centralizado. Cor em hex só em apps/web/src/index.css.
// (Em .ts/.tsx quem confere é o ESLint; veja apps/web/eslint.config.js.)
//
// Arquivos que ainda têm hex ficam em docs/governanca/excecoes.json (regra F5, alvo = caminho
// do arquivo). Exceção sem violação correspondente (obsoleta) também faz o script falhar.
//
// Uso (na raiz): node scripts/arquitetura/verificar-cores.mjs
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pastaSrc = path.join(raiz, 'apps', 'web', 'src')
const arquivoDoTema = 'apps/web/src/index.css'

// #RGB, #RGBA, #RRGGBB ou #RRGGBBAA. Seletores como "#root" não casam (r não é hex).
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/

function listarCss(pasta) {
  return readdirSync(pasta, { recursive: true, encoding: 'utf8' })
    .filter((relativo) => relativo.endsWith('.css'))
    .map((relativo) => path.join(pasta, relativo))
}

const caminhoRelativo = (arquivo) => path.relative(raiz, arquivo).split(path.sep).join('/')

// Arquivos com hex (fora do tema), ignorando o que está dentro de comentários /* ... */.
const violacoes = []
for (const arquivo of listarCss(pastaSrc)) {
  const relativo = caminhoRelativo(arquivo)
  if (relativo === arquivoDoTema) continue
  const semComentarios = readFileSync(arquivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  if (HEX.test(semComentarios)) violacoes.push(relativo)
}

const excecoes = JSON.parse(readFileSync(path.join(raiz, 'docs', 'governanca', 'excecoes.json'), 'utf8'))
  .filter((excecao) => excecao.regra === 'F5')
const alvosComExcecao = excecoes.map((excecao) => excecao.alvo)

const semExcecao = violacoes.filter((arquivo) => !alvosComExcecao.includes(arquivo))
const obsoletas = alvosComExcecao.filter((alvo) => !violacoes.includes(alvo))

if (semExcecao.length > 0 || obsoletas.length > 0) {
  console.error('Verificação de cores (F5) falhou:\n')
  for (const arquivo of semExcecao) {
    console.error(`  - ${arquivo}: tem cor em hex. Use variáveis do tema definidas em ${arquivoDoTema}.`)
  }
  for (const alvo of obsoletas) {
    console.error(`  - exceção obsoleta em docs/governanca/excecoes.json: ${alvo} não tem mais hex. Remova a exceção.`)
  }
  process.exit(1)
}
console.log(`Cores (F5): ok (${violacoes.length} arquivo(s) com exceção registrada).`)

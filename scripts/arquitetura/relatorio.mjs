// G6: relatório para a revisão arquitetural de cada sprint (15 minutos; veja docs/governanca/README.md).
// Só lê arquivos e imprime. Nunca falha.
//
// Uso (na raiz): pnpm relatorio:arquitetura
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const lerJson = (...partes) => JSON.parse(readFileSync(path.join(raiz, ...partes), 'utf8'))

console.log('Relatório de arquitetura do IntegraCASD')
console.log('=======================================\n')

// 1. Exceções por regra: quanto mais crescem, mais a arquitetura está sendo contornada.
const excecoes = lerJson('docs', 'governanca', 'excecoes.json')
const porRegra = new Map()
for (const excecao of excecoes) porRegra.set(excecao.regra, (porRegra.get(excecao.regra) ?? 0) + 1)
console.log(`1. Exceções registradas: ${excecoes.length}`)
for (const [regra, quantidade] of [...porRegra].sort()) console.log(`   ${regra}: ${quantidade}`)
if (excecoes.length === 0) console.log('   (nenhuma)')

// 2. TODOs nos consultas.ts do web: cada um é uma tela ainda ligada a dados fictícios.
const pastaFeatures = path.join(raiz, 'apps', 'web', 'src', 'features')
let todos = 0
const todosPorFeature = []
for (const entrada of readdirSync(pastaFeatures, { withFileTypes: true })) {
  const arquivo = path.join(pastaFeatures, entrada.name, 'consultas.ts')
  if (!entrada.isDirectory() || !existsSync(arquivo)) continue
  const quantidade = readFileSync(arquivo, 'utf8').split('\n').filter((linha) => linha.includes('TODO')).length
  todos += quantidade
  todosPorFeature.push(`${entrada.name}: ${quantidade}`)
}
console.log(`\n2. TODOs nos consultas.ts do web (endpoints ainda não integrados): ${todos}`)
console.log(`   ${todosPorFeature.join(' | ')}`)

// 3. Tamanho do bundle (só se já houve build).
const pastaAssets = path.join(raiz, 'apps', 'web', 'dist', 'assets')
console.log('\n3. Bundle JS (gzip)')
if (existsSync(pastaAssets)) {
  const total = readdirSync(pastaAssets)
    .filter((nome) => nome.endsWith('.js'))
    .reduce((soma, nome) => soma + gzipSync(readFileSync(path.join(pastaAssets, nome))).length, 0)
  console.log(`   ${(total / 1000).toFixed(1)} KB (o limite está em scripts/arquitetura/verificar-bundle.mjs)`)
} else {
  console.log('   sem dist/ (rode "pnpm build" para medir)')
}

// 4. Requisitos ainda sem teste.
const requisitos = lerJson('docs', 'governanca', 'requisitos-verificaveis.json').requisitos
const pendentes = requisitos.filter((requisito) => requisito.situacao === 'pendente')
console.log(`\n4. Requisitos pendentes: ${pendentes.length} de ${requisitos.length}`)
for (const requisito of pendentes) console.log(`   [${requisito.id}] ${requisito.motivo}`)

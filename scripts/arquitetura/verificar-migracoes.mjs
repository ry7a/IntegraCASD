// B7: migrações imutáveis e compatíveis com a versão anterior do código.
//
// Falha se, em relação a uma base do git:
//  1. alguma migração que JÁ EXISTIA na base foi modificada ou apagada
//     (migração aplicada nunca se edita: crie outra);
//  2. uma migração NOVA tem DROP COLUMN ou RENAME sem a linha de comentário
//       -- excecao-aprovada: <motivo>
//     (essas operações quebram a versão anterior do código e impedem voltar a versão).
//
// Uso:  node scripts/arquitetura/verificar-migracoes.mjs [base]
// A base vem do argumento ou da variável BASE_GIT; o padrão é "main".
// No CI, a base é o commit anterior ao push, ou a branch de destino do pull request.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const PASTA = 'apps/api/prisma/migrations'
const COMMIT_ZERO = /^0+$/ // o git usa zeros como "antes" no primeiro push

function git(...argumentos) {
  return execFileSync('git', argumentos, { encoding: 'utf8' })
}

const raiz = git('rev-parse', '--show-toplevel').trim()
process.chdir(raiz)

const base = process.argv[2] ?? process.env.BASE_GIT ?? 'main'
const semBase = COMMIT_ZERO.test(base)
if (semBase) {
  console.log('Base sem commit anterior (primeiro push): todas as migrações são tratadas como novas.')
}

// Resolve a base para um commit. Se não existir, falha com uma mensagem clara.
let commitBase = null
try {
  if (!semBase) commitBase = git('rev-parse', '--verify', `${base}^{commit}`).trim()
} catch {
  console.error(`Base git "${base}" não encontrada. Use "git fetch" (no CI: fetch-depth: 0) ou informe outra base.`)
  process.exit(1)
}

// Une dois grupos de mudanças:
//  - commits: base...HEAD (três pontos: a partir do ancestral comum, como num merge);
//    se a base é o próprio HEAD, o resultado é vazio e tudo bem;
//  - árvore de trabalho e índice contra o HEAD (cobre o gancho pre-merge-commit, em que o
//    resultado do merge ainda está no índice, e migrações recém-criadas e não commitadas).
// --no-renames faz uma renomeação aparecer como "D" (apagou) + "A" (criou).
const mudancas = new Map() // caminho -> status ('A', 'M' ou 'D')

function registrar(saida) {
  for (const linha of saida.split('\n').filter(Boolean)) {
    const [status, caminho] = linha.split('\t')
    const letra = status[0]
    // Se o arquivo foi criado num lugar e modificado em outro, continua sendo criação.
    if (mudancas.get(caminho) === 'A' && letra === 'M') continue
    mudancas.set(caminho, letra)
  }
}

if (semBase) {
  // Sem base para comparar: tudo o que está versionado conta como novo.
  for (const caminho of git('ls-files', '--', PASTA).split('\n').filter(Boolean)) mudancas.set(caminho, 'A')
} else {
  registrar(git('diff', '--name-status', '--no-renames', `${commitBase}...HEAD`, '--', PASTA))
  registrar(git('diff', '--name-status', '--no-renames', 'HEAD', '--', PASTA))
}
// Arquivos novos ainda fora do git (prisma migrate dev cria a pasta sem dar git add).
for (const caminho of git('ls-files', '--others', '--exclude-standard', '--', PASTA).split('\n').filter(Boolean)) {
  mudancas.set(caminho, 'A')
}

const erros = []

for (const [caminho, status] of mudancas) {
  if (status === 'M' || status === 'D' || status === 'T') {
    // Só vale como violação se o arquivo existia na base.
    let existiaNaBase = true
    try {
      git('cat-file', '-e', `${commitBase}:${caminho}`)
    } catch {
      existiaNaBase = false
    }
    if (existiaNaBase) {
      const acao = status === 'D' ? 'apagada' : 'modificada'
      erros.push(`${caminho}: migração já existente foi ${acao}. Nunca edite migração aplicada; crie uma nova.`)
    }
  }
}

// Migrações novas: confere as operações que quebram a versão anterior do código.
const OPERACAO_PERIGOSA = /\bDROP\s+COLUMN\b|\bRENAME\b/i
// [ \t] em vez de \s: o motivo precisa estar na MESMA linha (\s aceitaria a quebra de linha
// e contaria o SQL da linha seguinte como motivo).
const EXCECAO_APROVADA = /^[ \t]*--[ \t]*excecao-aprovada:[ \t]*\S+/m

for (const [caminho, status] of mudancas) {
  if (status !== 'A' || !caminho.endsWith('.sql')) continue
  let sql
  try {
    sql = readFileSync(path.join(raiz, caminho), 'utf8')
  } catch {
    continue // arquivo criado e apagado na árvore de trabalho
  }
  const semComentarios = sql.replace(/--.*$/gm, '')
  if (OPERACAO_PERIGOSA.test(semComentarios) && !EXCECAO_APROVADA.test(sql)) {
    erros.push(
      `${caminho}: tem DROP COLUMN ou RENAME. Use o padrão "expandir e depois contrair" em duas migrações, ` +
        'ou, se for mesmo necessário, acrescente a linha "-- excecao-aprovada: <motivo>" depois de combinar com a equipe.',
    )
  }
}

if (erros.length > 0) {
  console.error('Verificação de migrações (B7) falhou:\n')
  for (const erro of erros) console.error(`  - ${erro}`)
  process.exit(1)
}
console.log(`Migrações (B7): ok (base ${base}, ${mudancas.size} mudança(s) em ${PASTA}).`)

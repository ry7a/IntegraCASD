import { readdirSync } from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// ---------------------------------------------------------------------------
// Funções de aptidão do frontend (F1 a F7): regras de arquitetura que o ESLint confere.
// Veja docs/governanca/README.md e o ADR-0003.
//
// Atenção ao jeito que o ESLint combina blocos: para o MESMO arquivo, se dois blocos
// definem a mesma regra (ex.: no-restricted-imports), vale só o último, sem juntar os dois.
// Por isso cada bloco abaixo monta a lista COMPLETA de restrições da sua pasta,
// usando as funções `importacoesProibidas` e `sintaxeProibida`.
// ---------------------------------------------------------------------------

// Cada pasta de src/features/ é uma feature. Lê do disco para que uma feature nova
// já nasça com as regras, sem precisar editar este arquivo.
const FEATURES = readdirSync(new URL('./src/features', import.meta.url), { withFileTypes: true })
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => entrada.name)

// --- Imports proibidos (no-restricted-imports) -----------------------------

// F2: só o cliente gerado fala com a API, e só pela entrada do pacote.
const REGRAS_DE_CLIENTE_DA_API = [
  {
    regex: '^@integracasd/api-client/',
    message: 'Importe só da entrada do pacote: "@integracasd/api-client" (nada de src/ ou gerado/).',
  },
  {
    regex: '(^|/)packages/api-client(/|$)',
    message: 'Não use caminho relativo para o pacote. Importe de "@integracasd/api-client".',
  },
]

// F6: dados fictícios só entram pelo consultas.ts da mesma feature.
const REGRA_DE_DADOS_FICTICIOS = {
  regex: '(^|/)dados-ficticios(\\.[a-z]+)?$',
  message: 'Só o consultas.ts da própria feature pode importar dados-ficticios.',
}

// F1: dentro de uma feature, proíbe importar qualquer OUTRA feature (por alias ou caminho relativo).
function regrasDeOutrasFeatures(featureAtual) {
  return FEATURES.filter((nome) => nome !== featureAtual).map((outra) => ({
    regex: `^(@/features/|(\\./)?(\\.\\./)+(features/)?)${outra}(/|$)`,
    message: `A feature "${featureAtual}" não pode importar a feature "${outra}". O que é comum sobe para src/compartilhado/.`,
  }))
}

// F1: o compartilhado não conhece as features nem o shell (app).
const REGRA_DO_COMPARTILHADO = {
  regex: '^(@/(features|app)|(\\./)?(\\.\\./)+(features|app))(/|$)',
  message: 'src/compartilhado/ não pode importar features/ nem app/ (a dependência vai no outro sentido).',
}

function importacoesProibidas({ extras = [], dadosFicticios = true } = {}) {
  return [
    'error',
    {
      paths: [{ name: 'axios', message: 'Chamadas à API usam só o cliente gerado em @integracasd/api-client.' }],
      patterns: [...REGRAS_DE_CLIENTE_DA_API, ...(dadosFicticios ? [REGRA_DE_DADOS_FICTICIOS] : []), ...extras],
    },
  ]
}

// --- Sintaxe proibida (no-restricted-syntax) --------------------------------

// F2: fetch via window/globalThis/self (o fetch "solto" é pego por no-restricted-globals).
const SINTAXE_DE_FETCH = [
  {
    selector: 'CallExpression[callee.object.name=/^(window|globalThis|self)$/][callee.property.name="fetch"]',
    message: 'Nunca use fetch direto. Use os hooks do cliente gerado (@integracasd/api-client).',
  },
]

// F4: formatação de números e datas fica toda em src/compartilhado/formatacao.ts.
const SINTAXE_DE_FORMATACAO = [
  {
    selector: 'MemberExpression[object.name="Intl"][property.name=/^(NumberFormat|DateTimeFormat)$/]',
    message: 'Formatação só em src/compartilhado/formatacao.ts. Use as funções de lá (formatarMoeda, formatarData...).',
  },
  {
    selector: 'CallExpression[callee.property.name=/^(toLocaleString|toLocaleDateString|toLocaleTimeString|toFixed)$/]',
    message: 'Formatação só em src/compartilhado/formatacao.ts. Use as funções de lá (formatarInteiro, formatarPercentual...).',
  },
]

// F5: cor em hex só no tema (src/index.css). Em TS/TSX use as classes do tema (bg-primary...).
const HEX = '#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b'
const MENSAGEM_DE_COR = 'Cor em hex só em src/index.css. Use as classes do tema (bg-primary, text-muted-foreground...).'
const SINTAXE_DE_COR = [
  { selector: `Literal[value=/${HEX}/]`, message: MENSAGEM_DE_COR },
  { selector: `TemplateElement[value.raw=/${HEX}/]`, message: MENSAGEM_DE_COR },
]

// F7: sem estado global paralelo. Contexto do React só no shell (app/) e no compartilhado/.
const SINTAXE_DE_CONTEXTO = [
  {
    selector: 'CallExpression[callee.name="createContext"], CallExpression[callee.property.name="createContext"]',
    message: 'createContext só em src/app/ ou src/compartilhado/. Dados da API ficam no cache do TanStack Query.',
  },
]

function sintaxeProibida({ formatacao = true, contexto = true } = {}) {
  return [
    'error',
    ...SINTAXE_DE_FETCH,
    ...(formatacao ? SINTAXE_DE_FORMATACAO : []),
    ...SINTAXE_DE_COR,
    ...(contexto ? SINTAXE_DE_CONTEXTO : []),
  ]
}

// --- Configuração ------------------------------------------------------------

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Regras para todo o src/ (os blocos abaixo repetem o que mudar para cada pasta).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // F2: fetch e XMLHttpRequest proibidos.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Nunca use fetch direto. Use os hooks do cliente gerado (@integracasd/api-client).' },
        { name: 'XMLHttpRequest', message: 'Chamadas à API usam só o cliente gerado (@integracasd/api-client).' },
      ],
      'no-restricted-imports': importacoesProibidas(),
      'no-restricted-syntax': sintaxeProibida(),
    },
  },

  // app/ (shell): pode importar as features e usar createContext.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': sintaxeProibida({ contexto: false }),
    },
  },

  // compartilhado/: não importa features nem app (F1); pode usar createContext.
  {
    files: ['src/compartilhado/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': importacoesProibidas({ extras: [REGRA_DO_COMPARTILHADO] }),
      'no-restricted-syntax': sintaxeProibida({ contexto: false }),
    },
  },

  // formatacao.ts é o único lugar onde Intl e toFixed são permitidos (F4).
  {
    files: ['src/compartilhado/formatacao.ts'],
    rules: {
      'no-restricted-syntax': sintaxeProibida({ formatacao: false, contexto: false }),
    },
  },

  // Uma feature não importa outra (F1). Gerado em loop: um bloco por feature.
  ...FEATURES.flatMap((feature) => [
    {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': importacoesProibidas({ extras: regrasDeOutrasFeatures(feature) }),
      },
    },
    // F6: dentro da feature, só o consultas.ts pode importar o dados-ficticios.
    {
      files: [`src/features/${feature}/consultas.ts`],
      rules: {
        'no-restricted-imports': importacoesProibidas({
          extras: regrasDeOutrasFeatures(feature),
          dadosFicticios: false,
        }),
      },
    },
  ]),
])

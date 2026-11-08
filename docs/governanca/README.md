# Governança da arquitetura

O projeto não tem pull request nem revisão obrigatória. No lugar dela, as regras de arquitetura são **funções de aptidão**: verificações automáticas que falham quando alguém quebra uma regra. A decisão está no [ADR-0003](../adr/0003-funcoes-de-aptidao.md).

## Como rodar tudo

Na raiz do repositório (PowerShell):

```powershell
pnpm lint                    # ESLint do web (F1, F2, F4, F5, F6, F7) e oxlint da API (B11, B12)
pnpm test                    # testes da API, inclui apps/api/test/arquitetura (B1 a B8, B11, B13, G3, G4, G5)
pnpm verificar:arquitetura   # migrações (B7) e cores em CSS (F5); não precisa de build
pnpm build
pnpm verificar:build         # orçamento de bundle (F8) e dados fictícios no bundle (F6)
pnpm verificar:contrato      # contrato da API em dia com o cliente gerado (F3); demora um pouco
pnpm relatorio:arquitetura   # relatório para a revisão da sprint (G6)
```

Os ganchos `.githooks/pre-merge-commit` e `.githooks/pre-push` rodam `pnpm lint`, `pnpm test` e `pnpm verificar:arquitetura` antes de concluir um merge e antes de cada push (o segundo cobre o merge fast-forward, que não passa pelo primeiro). Eles são ativados sozinho pelo `pnpm install` (script `prepare`). O CI roda tudo isso e mais o que depende de build.

## As funções de aptidão

### Backend (`apps/api/test/arquitetura/`, Vitest)

Os testes não executam o código: leem os `.ts` com `node:fs` e conferem imports e texto. O helper está em `arquivos.ts`.

| Id  | Regra | Como violar sem querer | O que fazer |
| --- | ----- | ---------------------- | ----------- |
| B1  | Cada módulo em `src/modulos/<nome>/` tem `index.ts` e só se importa de outro módulo por ele; sem `forwardRef` | importar `../cadastros/infra/...` de outro módulo | exportar o que precisa no `index.ts` do módulo dono |
| B2  | `dominio/` não importa `@nestjs/*`, `@prisma/*`, `generated/prisma`, `infra/`, `api/`, `aplicacao/`; `api/` não importa `infra/`; `aplicacao/` não importa `api/` | controller chamando repositório | o controller chama um caso de uso (`aplicacao/`) |
| B3  | `PrismaService`, `@prisma/*`, `generated/prisma` e `$transaction` não aparecem em `api/` nem `dominio/` | usar o Prisma no controller | mover para o repositório em `infra/` |
| B4  | `fetch(`, `axios`, `undici`, `node:http(s)` e `asaas.com` só em `src/compartilhado/asaas/` | chamar o Asaas direto de um módulo | usar a interface do Cliente Asaas |
| B5  | Schema sem `Float`/`Decimal`; campo `...Centavos` é `Int`; sem `parseFloat` e `.toFixed(` no `src/` | valor monetário decimal | centavos, como inteiro |
| B6  | Sem `.delete(`, `.deleteMany(` no `src/`; sem `DELETE FROM` e `DROP TABLE` nas migrações | excluir registro | inativar (campo `ativo`/situação) ou estornar |
| B8  | Toda operação do `packages/api-client/openapi.json` tem `security` não vazio, exceto login e webhook; rota `/api/admin...` declara `x-perfil: DIRETORIA`; `@Publico()` só nos controllers de login, webhook e saúde | rota nova sem autenticação | veja "Convenção de segurança" abaixo |
| B11 | Nenhum arquivo versionado com o prefixo de chave do Asaas; nenhum `.env` versionado (só `.env.example`) | colar a chave num arquivo | usar o `.env` (ignorado pelo git) |
| B13 | Só `src/compartilhado/auditoria/trilha.ts` grava em `registroAuditoria`; ninguém faz `update`/`delete` nela; existe a migração com o gatilho que recusa `UPDATE`, `DELETE` e `TRUNCATE` na trilha ([Segurança.NF006]) | `tx.registroAuditoria.create(...)` direto no módulo | `registrarNaTrilha(tx, {...})` dentro da transação da alteração (ADR-0004) |
| G3  | Todo `package.json` do workspace só tem dependências da lista; `typescript` 6.0.3, `prisma`, `@prisma/client` e `@prisma/adapter-pg` 7.10.0 | instalar pacote novo | veja "Dependências" abaixo |
| G4  | Exceções com regra, alvo, justificativa e referência; exceção obsoleta falha | | veja "Exceções" abaixo |
| G5  | Requisito "coberto" é citado por um teste; requisito citado num teste está na lista; ids existem no documento de requisitos | | veja "Requisitos" abaixo |

O oxlint (`apps/api/.oxlintrc.json`) cobre **B11** (`no-console`: use o `Logger` do Nest ou `process.stdout.write` em scripts, e nunca registre segredos) e **B12** (`typescript/no-explicit-any` e `typescript/ban-ts-comment`: use `unknown` e conserte o tipo em vez de `any` ou `@ts-ignore`).

### Frontend (`apps/web/eslint.config.js`)

O ESLint combina blocos por pasta; o arquivo explica como. Mensagens de erro dizem o que fazer.

| Id | Regra |
| -- | ----- |
| F1 | Uma feature não importa outra (alias `@/features/x` ou caminho relativo); `src/compartilhado/` não importa `features/` nem `app/` |
| F2 | Sem `fetch`, `XMLHttpRequest` nem `axios` em `src/`; do cliente gerado só se importa a entrada `@integracasd/api-client` |
| F4 | `Intl.NumberFormat`, `Intl.DateTimeFormat`, `.toLocaleString(`, `.toLocaleDateString(`, `.toLocaleTimeString(` e `.toFixed(` só em `src/compartilhado/formatacao.ts` |
| F5 | Cor em hex (`#RGB`, `#RRGGBB`...) proibida em literais de string e template de `.ts`/`.tsx`. Em `.css`, só em `src/index.css` (script `verificar-cores.mjs`) |
| F6 | `dados-ficticios` só pode ser importado pelo `consultas.ts` da mesma feature |
| F7 | `createContext` só em `src/app/` e `src/compartilhado/` |

### Scripts (`scripts/arquitetura/`)

| Id | Script | O que confere |
| -- | ------ | ------------- |
| B7 | `verificar-migracoes.mjs [base]` | Compara com uma base do git (argumento, ou variável `BASE_GIT`, ou `main`). Falha se uma migração que já existia na base foi modificada ou apagada. Falha se uma migração nova tem `DROP COLUMN` ou `RENAME` sem a linha `-- excecao-aprovada: <motivo>`. Considera também o que está no índice e na árvore de trabalho (por isso funciona no gancho de merge). Com base de zeros (primeiro push), trata tudo como novo. |
| F3 | `verificar-contrato.mjs` | Regenera `openapi.json` e o cliente (`pnpm gerar:cliente-api`) e falha se algum arquivo de `packages/api-client` mudou. Se falhar: rode `pnpm gerar:cliente-api` e commite o resultado. Não precisa de banco. |
| F5 | `verificar-cores.mjs` | Hex em `.css` fora de `src/index.css`. |
| F6 | `verificar-dados-ficticios.mjs [--estrito]` | Procura no `apps/web/dist` os marcadores `dados-ficticios-integracasd:<feature>`, que cada `dados-ficticios.ts` deixa no bundle. Modo padrão: aviso (sai com 0). `--estrito`: falha. Passar o CI para `--estrito` quando as telas estiverem integradas à API. |
| F8 | `verificar-bundle.mjs` | Soma do gzip dos `.js` de `dist/assets` abaixo do limite (valor e motivo comentados no script). |
| G6 | `relatorio.mjs` | Veja "Revisão por sprint". |

## Exceções (G4)

Quando uma regra é violada por um motivo legítimo, **não se enfraquece a regra**: registra-se a exceção em [`excecoes.json`](excecoes.json):

```json
{ "regra": "B8", "alvo": "GET /api/alunos", "justificativa": "...", "referencia": "ADR-0003 ou requisito" }
```

- `alvo` tem um formato por regra: caminho do arquivo a partir da raiz (B1 a B6, B11, F5), `"MÉTODO /caminho"` (B8) ou `Modelo.campo` (B5, para o schema).
- Exceção sem justificativa (ou muito curta) faz o teste falhar.
- Exceção **obsoleta** (a violação deixou de existir) também falha: apague-a. É assim que as exceções temporárias, como as de autenticação, não ficam esquecidas.

## Convenção de segurança (B8)

- **Rota autenticada:** declarar o esquema de segurança do Swagger no controller, por exemplo `@ApiCookieAuth()`. No `openapi.json` vira `"security": [{ "cookie": [] }]`.
- **Rotas públicas permitidas:** apenas `/api/auth/login`, `/api/webhooks/asaas`, `/api/saude` e `/api/saude/completa`. O webhook e a saúde ficam fora do contrato (`@ApiExcludeController`), por isso o teste também confere que `@Publico()` só aparece nos três controllers da lista fixa em `rotas-autenticadas.spec.ts`.
- **Rotas de Administração** (caminho começa com `/api/admin`): além da segurança, declarar `@ApiExtension('x-perfil', 'DIRETORIA')`. O perfil é verificado de verdade no backend; a extensão só torna o requisito visível e testável no contrato.
- Hoje a autenticação não existe: `GET /api` e `GET /api/alunos` são exceções registradas. Ao implementar a autenticação, remova as exceções.

## Dependências (G3)

[`dependencias.json`](dependencias.json) lista, por pacote do workspace, as dependências permitidas. Para **adicionar** (ou remover) uma dependência:

1. Combine com a equipe (regra do projeto: nada de dependência nova sem conversa).
2. Edite a lista no **mesmo commit** que altera o `package.json`.

Também são conferidas as versões fixadas: `typescript` 6.0.3 (o 7 quebra a CLI do NestJS) e `prisma`, `@prisma/client` e `@prisma/adapter-pg` 7.10.0 (a tag `latest` do `prisma` aponta para uma RC).

## Requisitos verificáveis (G5)

[`requisitos-verificaveis.json`](requisitos-verificaveis.json) lista os requisitos não funcionais que o código precisa respeitar, cada um `coberto` ou `pendente` (com motivo). Para marcar como `coberto`, escreva um teste `*.spec.ts` em `apps/api` que cite o requisito entre colchetes, no formato do documento de requisitos (`[Categoria.NFnnn]`) e troque a situação. Um requisito citado num teste precisa estar na lista, e todo id da lista precisa existir em `docs/requisitos/IntegraCASD_DocRequisitos_v1.1.tex`.

## Revisão arquitetural por sprint (G6)

Ritual de **15 minutos**, no fim de cada sprint, com a equipe toda:

1. Rode `pnpm relatorio:arquitetura` e projete a saída.
2. **Exceções por regra (3 min):** alguma cresceu? Alguma pode ser removida agora (ex.: autenticação pronta)? Leia as justificativas das novas.
3. **TODOs dos `consultas.ts` (3 min):** quantas telas ainda usam dados fictícios? Se zerou, mude `verificar:build` para `--estrito` (F6).
4. **Bundle (2 min):** o tamanho subiu muito desde a última sprint? Foi uma biblioteca nova?
5. **Requisitos pendentes (4 min):** algum deveria ter teste agora, porque o módulo correspondente já existe? Crie a tarefa.
6. **Regras (3 min):** alguma regra atrapalhou sem proteger nada (muitos falsos positivos)? Alguma regra nova faz falta? Registre num ADR se mudar.

## Pendências

B9 (webhook não processa) e B10 (idempotência e atomicidade da baixa) ainda não têm teste porque webhook e worker não existem. Serão criados junto com o módulo de Cobranças. Veja o [ADR-0003](../adr/0003-funcoes-de-aptidao.md).

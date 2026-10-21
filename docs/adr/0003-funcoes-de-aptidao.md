# ADR-0003: Funções de aptidão como guardiãs da arquitetura

- **Status:** Aceita
- **Data:** 2026-10-21
- **Decisores:** Marcello Ryaj
- **Requisitos relacionados:** [Confiabilidade.NF003], [Confiabilidade.NF004], [Desempenho.NF001], [Segurança.NF001], [Segurança.NF003]

## Contexto

As regras de arquitetura do IntegraCASD (fronteiras entre módulos, dinheiro em centavos, nada excluído fisicamente, só o Cliente Asaas fala com o Asaas...) estão escritas nos `CLAUDE.md` e no [ADR-0001](0001-monolito-modular.md). O ADR-0001 admitia que as fronteiras "dependem de disciplina e revisão de código".

Só que a revisão deixou de existir: o projeto não usa pull request nem revisão obrigatória, e a `main` recebe merges locais (veja o [CONTRIBUTING](../../CONTRIBUTING.md)). A equipe tem 4 pessoas que estão aprendendo TypeScript, o sistema será mantido por várias gestões do CASD e boa parte do código será escrita com ajuda de IA. Uma regra que só existe em texto é esquecida; uma violação só é percebida meses depois, quando já custa caro corrigir.

## Decisão

Vamos transformar cada regra de arquitetura importante numa **função de aptidão** (fitness function): uma verificação automática, barata e rápida, que falha quando a regra é violada. Elas substituem a revisão obrigatória como guardiãs da arquitetura.

- **Backend:** testes Vitest em `apps/api/test/arquitetura/`, que leem os arquivos `.ts` e conferem imports e texto. Rodam com `pnpm test`.
- **Frontend:** regras nativas do ESLint (`no-restricted-imports`, `no-restricted-syntax`, `no-restricted-globals`) em `apps/web/eslint.config.js`. Rodam com `pnpm lint`.
- **Repositório, git e build:** scripts Node em `scripts/arquitetura/`, chamados por `pnpm verificar:arquitetura`, `pnpm verificar:build` e `pnpm verificar:contrato`.
- **Onde rodam:** nos ganchos locais `.githooks/pre-merge-commit` (antes de concluir um merge) e `.githooks/pre-push` (antes de cada push, o que cobre também o merge fast-forward) e no CI.
- **Governança:** listas em `docs/governanca/` (dependências aprovadas, exceções, requisitos verificáveis), explicadas no `docs/governanca/README.md`.

Regras de funcionamento:

1. **Regra violada por motivo legítimo não é enfraquecida:** registra-se uma exceção em `docs/governanca/excecoes.json`, com justificativa e referência. Exceção sem justificativa, ou que não corresponde mais a nenhuma violação, faz o teste falhar.
2. **Adicionar dependência** exige editar `docs/governanca/dependencias.json` no mesmo commit, o que obriga a conversa com a equipe.
3. Uma vez por sprint, a equipe faz uma revisão arquitetural de 15 minutos com `pnpm relatorio:arquitetura`.

### Funções de aptidão

| Id  | Regra                                                                                                   | Onde é verificada                                                             |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| B1  | Módulos só se conhecem pelo `index.ts`; sem `forwardRef`                                                 | `apps/api/test/arquitetura/fronteiras-entre-modulos.spec.ts`                  |
| B2  | Camadas do módulo: domínio puro, `api/` não chama `infra/`, `aplicacao/` não conhece `api/`             | `apps/api/test/arquitetura/camadas.spec.ts`                                   |
| B3  | Prisma e `$transaction` fora de `api/` e `dominio/`                                                      | `apps/api/test/arquitetura/camadas.spec.ts`                                   |
| B4  | Só `compartilhado/asaas/` usa HTTP e a URL do Asaas                                                      | `apps/api/test/arquitetura/asaas.spec.ts`                                     |
| B5  | Dinheiro em centavos: sem `Float`/`Decimal`, `...Centavos` é `Int`, sem `parseFloat`/`.toFixed(`        | `apps/api/test/arquitetura/dinheiro.spec.ts`                                  |
| B6  | Nada excluído fisicamente: sem `.delete(`, `DELETE FROM`, `DROP TABLE`                                   | `apps/api/test/arquitetura/exclusao-fisica.spec.ts`                           |
| B7  | Migrações imutáveis; `DROP COLUMN`/`RENAME` novos só com exceção aprovada                                | `scripts/arquitetura/verificar-migracoes.mjs` (`pnpm verificar:arquitetura`)  |
| B8  | Toda rota tem `security`, exceto login e webhook; rotas `/api/admin` declaram `x-perfil: DIRETORIA`     | `apps/api/test/arquitetura/rotas-autenticadas.spec.ts`                        |
| B9  | Webhook não processa: valida token, grava, enfileira, responde                                           | **Pendente** (veja abaixo)                                                    |
| B10 | Idempotência e atomicidade da baixa                                                                      | **Pendente** (veja abaixo)                                                    |
| B11 | Sem segredos: `no-console` no `src/`, sem chave do Asaas nem `.env` versionados                          | `apps/api/.oxlintrc.json`; `apps/api/test/arquitetura/segredos.spec.ts`       |
| B12 | Tipagem honesta: sem `any` explícito, sem `@ts-ignore`                                                   | `apps/api/.oxlintrc.json` (`pnpm lint`)                                       |
| F1  | Uma feature não importa outra; `compartilhado/` não importa `features/` nem `app/`                       | `apps/web/eslint.config.js`                                                   |
| F2  | Só o cliente gerado chama a API (sem `fetch`, `XMLHttpRequest`, `axios`; só a entrada do pacote)        | `apps/web/eslint.config.js`                                                   |
| F3  | Contrato sincronizado: regenerar o cliente não muda nada                                                 | `scripts/arquitetura/verificar-contrato.mjs` (`pnpm verificar:contrato`)      |
| F4  | Formatação (`Intl`, `toLocale...`, `toFixed`) só em `compartilhado/formatacao.ts`                        | `apps/web/eslint.config.js`                                                   |
| F5  | Cor em hex só no tema: `.ts`/`.tsx` pelo ESLint; `.css` só em `index.css`                                | `apps/web/eslint.config.js`; `scripts/arquitetura/verificar-cores.mjs`        |
| F6  | Dados fictícios só entram por `consultas.ts`; não vão para o bundle de produção                          | `apps/web/eslint.config.js`; `scripts/arquitetura/verificar-dados-ficticios.mjs` |
| F7  | `createContext` só em `app/` e `compartilhado/`                                                          | `apps/web/eslint.config.js`                                                   |
| F8  | Orçamento de bundle (gzip dos `.js`)                                                                     | `scripts/arquitetura/verificar-bundle.mjs` (`pnpm verificar:build`)           |
| G3  | Dependências só as da lista aprovada; versões fixadas (`typescript` 6.0.3, Prisma 7.10.0)                | `apps/api/test/arquitetura/dependencias.spec.ts`                              |
| G4  | Exceções com justificativa; exceções obsoletas falham                                                    | `apps/api/test/arquitetura/excecoes.spec.ts` e `excecoes.ts`                  |
| G5  | Requisito "coberto" tem teste que o cita; requisito citado existe na lista                               | `apps/api/test/arquitetura/requisitos.spec.ts`                                |

### Pendências

- **B9 (webhook não processa)** e **B10 (idempotência e atomicidade)**: webhook e worker ainda não existem. Os testes serão criados junto com o módulo de Cobranças: B9 confere que o controller do webhook só valida `asaas-access-token`, grava, enfileira e responde ([Desempenho.NF001]); B10 confere que a baixa e a marcação de "processado" ocorrem na mesma transação e que um evento repetido não gera efeito duplicado ([Confiabilidade.NF003], [Confiabilidade.NF004]). Enquanto isso, esses requisitos constam como "pendente" em `requisitos-verificaveis.json`.
- **F6 em modo estrito:** hoje as telas usam dados fictícios de propósito, então o CI roda `verificar-dados-ficticios.mjs` só em modo aviso. Quando todas as telas estiverem integradas à API (os `TODO` dos `consultas.ts` zerados, veja `pnpm relatorio:arquitetura`), trocar o script `verificar:build` para usar `--estrito`.
- **Exceções de autenticação (B8):** `GET /api` e `GET /api/alunos` estão em `excecoes.json` porque a autenticação ainda não existe. Ao implementá-la, remover as exceções (o teste obriga: exceção obsoleta falha).
- **Outras exceções registradas:** B3 no DTO de alunos (importa o enum gerado pelo Prisma só para o OpenAPI) e F5 em `estilo-telas.css` (cores em hex que devem migrar para variáveis do tema em `index.css`).
- `apps/web/src/App.css` é sobra do modelo do Vite e não é importado por ninguém; remover numa limpeza.

## Alternativas consideradas

### Alternativa 1: voltar a exigir pull request e revisão

- **Prós:** uma segunda pessoa olha cada mudança e ainda ensina.
- **Contras:** equipe pequena, prazo de 2 meses; a revisão é lenta e depende de atenção humana para coisas que uma máquina confere melhor (um import errado passa despercebido).
- **Por que não:** a equipe decidiu não ter PR. As funções de aptidão cobrem exatamente o que a revisão cobriria em arquitetura, sem custo de espera.

### Alternativa 2: só documentar as regras

- **Prós:** custo zero.
- **Contras:** regra só em texto é esquecida; ninguém percebe a violação até ser tarde.
- **Por que não:** é a situação atual, e o ADR-0001 já apontava esse risco.

### Alternativa 3: ferramenta dedicada de arquitetura (ex.: dependency-cruiser, ArchUnit para TS)

- **Prós:** regras mais expressivas e relatórios de dependências.
- **Contras:** dependência nova, curva de aprendizado extra.
- **Por que não:** a restrição do projeto é não adicionar dependências sem necessidade. Vitest, ESLint e Node bastam para as regras de hoje; reavaliar se as regras ficarem complicadas de manter.

## Consequências

**Positivas:**

- Violações de arquitetura são pegas em segundos, na máquina de quem escreveu e no CI, com mensagem que diz o que corrigir.
- As regras ficam executáveis e versionadas: quem herdar o projeto aprende a arquitetura lendo os testes.
- Exceções ficam visíveis, justificadas e com prazo implícito (a exceção obsoleta falha).

**Negativas e riscos:**

- As verificações por texto/regex são simples de propósito e podem ter falsos positivos (ex.: um `.delete(` de um `Map`) ou deixar passar construções incomuns. Falso positivo vira exceção registrada ou ajuste da regra.
- Mais um conjunto de arquivos para manter: as listas de `docs/governanca/` precisam andar junto com o código.
- O gancho local pode ser pulado com `--no-verify`; o CI é a rede de proteção.
- O contrato do `openapi.json` precisa ser regenerado e commitado a cada mudança de API (o CI avisa se esquecer).

**Quando revisitar:**

Se as regras passarem de ~30 ou ficarem difíceis de ler, avaliar uma ferramenta dedicada. Se a equipe voltar a ter revisão obrigatória, reavaliar o que ainda vale automatizar.

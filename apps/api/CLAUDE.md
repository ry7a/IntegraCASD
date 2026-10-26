# Backend (apps/api)

NestJS 12 + Prisma 7.10.0 + PostgreSQL 18 + pg-boss 12. O mesmo código roda em dois processos: `src/main.ts` (API HTTP) e `src/main-worker.ts` (worker, sem porta HTTP).

## Organização de um módulo

Cada módulo de domínio fica em `src/modulos/<nome>/` e segue estas camadas:

```
src/modulos/cobrancas/
  cobrancas.module.ts   declara o que o módulo exporta
  api/                  controllers e DTOs (só recebe e responde)
  aplicacao/            casos de uso (orquestra, controla a transação)
  dominio/              entidades e regras de negócio
  infra/                repositórios Prisma, adaptadores externos
```

- Nomes de domínio em português sem acento (`cobranca`, `movimentacao`, `aluno`); termos do framework em inglês (`Controller`, `Service`, `Module`).
- Controllers não contêm regra de negócio: convertem a requisição e chamam um caso de uso.
- Um caso de uso por arquivo, com nome de ação: `emitir-cobranca-avulsa.ts`.
- O Cadastros é o módulo de referência: na dúvida sobre estrutura, siga o que ele faz.
- Código compartilhado entre módulos (auditoria, autenticação, eventos internos, cliente Asaas) fica em `src/compartilhado/`.

## Prisma e banco

- Valores monetários: campos `Int` em centavos.
- Mudança de esquema sempre por migração: `pnpm prisma migrate dev --name descricao-curta`. Nunca edite uma migração já aplicada; crie outra.
- Migrações devem ser compatíveis com a versão anterior do código (permite voltar a versão em caso de falha).
  Remover ou renomear coluna é "expandir e depois contrair": primeiro uma migração que só acrescenta,
  depois outra que remove (`scripts/arquitetura/verificar-migracoes.mjs` barra `DROP COLUMN` e `RENAME`).
- O `migrate dev` recusa rodar fora de um terminal interativo quando há avisos (ex.: índice único novo).
  Nesse caso, gere o SQL com
  `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
  grave em `prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql` e aplique com `pnpm exec prisma migrate deploy`.
- O Prisma não descreve `CHECK`: escreva-os à mão no fim do `migration.sql` e cite a regra num
  comentário do modelo no `schema.prisma`, para quem lê o schema saber que ela existe.
- Operações que mexem em mais de uma tabela usam `prisma.$transaction(async (tx) => ...)`, passando `tx` adiante.
- Exclusão física é proibida: use o campo de situação (inativação) ou estorno.
- CPF de cadastro ativo é único por índice parcial no banco, não só por validação no código.
- Colunas obsoletas do aluno (`situacao`, `alojamentoTexto`, `apto`, `vaga`): não use em código novo.
  Ficam até a carga inicial preencher `ativo` e `alojamentoId`; depois saem numa migração própria.
- Regras do MER que ainda não têm caso de uso nem teste (entram com os casos de uso de Movimentações):
  categoria compatível com o tipo da movimentação, estorno só de movimentação de origem `MANUAL`,
  e as duas pernas da transferência com mesmo valor, tipos opostos e contas diferentes.
- Todo ponto de entrada que monta a aplicação (`main.ts`, `main-worker.ts`, `gerar-openapi.ts`) carrega
  o `.env` da raiz: alguns providers leem variáveis já no construtor (o `PgBossService` exige `DATABASE_URL`).

## Asaas

- Todo acesso ao Asaas passa pelo cliente em `src/compartilhado/asaas/`. Módulos dependem da interface, nunca do cliente HTTP.
- Em testes, use um dublê da interface. Nunca chame o Asaas real em teste automatizado.
- Respostas 429 são tratadas no cliente: aguardar o intervalo informado e repetir.
- Erros do Asaas são traduzidos para mensagens orientadas à ação antes de chegar à API ([Usabilidade.NF002]). Nunca repasse a mensagem crua da plataforma.

## Webhook e worker

- O controller do webhook só faz: validar `asaas-access-token`, gravar o evento (id do Asaas com `UNIQUE`), enfileirar no pg-boss e responder 200. Nenhuma regra de negócio ali.
- O processamento fica em handlers do worker. Antes de processar, verificar se o evento já foi processado; a marcação de "processado" acontece dentro da mesma transação da baixa.
- Rotinas agendadas (geração recorrente, sincronização, alerta de webhook parado) são jobs do pg-boss registrados no worker e devem gravar início, fim, total processado e falhas.
- Toda rotina deve ser segura para rodar duas vezes (ex.: não gerar mensalidade se já existir uma para o aluno no período).

## Segurança e auditoria

- Toda rota exige sessão autenticada, exceto login e webhook (que usa o token próprio).
- Rotas de Administração exigem perfil de diretoria; o perfil é verificado no backend, sempre.
- Senhas com argon2. A chave do Asaas é guardada cifrada e nunca é logada.
- Auditoria: toda alteração chama `registrarNaTrilha(tx, {...})` (`src/compartilhado/auditoria/trilha.ts`)
  dentro da mesma transação, nunca `tx.registroAuditoria.create` direto. A trilha é só de inclusão: o banco
  recusa `UPDATE`/`DELETE` nela (ADR-0004, regra B13). Rotina automática grava com `usuarioId: null`.

## Testes

- Vitest. Regras de domínio e casos de uso têm teste unitário.
- O fluxo de conciliação (webhook → worker → baixa) tem teste cobrindo o evento repetido e a falha no meio da transação.

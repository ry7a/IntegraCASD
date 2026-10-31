# Backend (apps/api)

NestJS 12 + Prisma 7.10.0 + PostgreSQL 18 + pg-boss 12. O mesmo código roda em dois processos: `src/main.ts` (API HTTP) e `src/main-worker.ts` (worker, sem porta HTTP).

## Organização de um módulo

Cada módulo de domínio fica em `src/modulos/<nome>/` e segue estas camadas:

```
src/modulos/cobrancas/
  index.ts              entrada pública: outro módulo só importa daqui (regra B1)
  cobrancas.module.ts   módulo do Nest (providers, controllers, exports)
  api/                  controllers e DTOs (só recebe e responde)
  aplicacao/            casos de uso (orquestra, controla a transação)
  dominio/              entidades e regras de negócio
  infra/                repositórios Prisma, adaptadores externos
```

- Nomes de domínio em português sem acento (`cobranca`, `movimentacao`, `aluno`); termos do framework em inglês (`Controller`, `Service`, `Module`).
- Controllers não contêm regra de negócio: convertem a requisição e chamam um caso de uso.
- Um caso de uso por arquivo, com nome de ação: `emitir-cobranca-avulsa.ts`.
- Módulos: `acesso` (login e sessão), `administracao`, `cadastros`, `cobrancas`, `indicadores`, `movimentacoes`.
- O Cadastros é o módulo de referência: na dúvida sobre estrutura, siga o que ele faz.
- Camadas conferidas por teste (B2, B3): `dominio/` não importa Nest nem Prisma; `api/` não importa `infra/`;
  Prisma e `$transaction` nunca aparecem em `api/` nem em `dominio/`.
- Código compartilhado entre módulos fica em `src/compartilhado/`: `asaas/`, `auditoria/`, `autenticacao/`,
  `eventos/`, `fila/`, `notificacao/`, `prisma/`, `seguranca/` e `datas.ts` (dia de hoje em São Paulo).
- Quando um módulo precisa avisar outro sem importá-lo (evitando ciclo), use `EventosInternos`
  (`src/compartilhado/eventos/`): quem publica não conhece quem ouve. Quem ouve não chama o Asaas na hora:
  enfileira uma rotina, que o pg-boss repete se falhar. Exemplo: "aluno alterado" -> atualizar o cliente no Asaas.

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
- Código de contrato e de projeto (24C002, 25P013): gerado no repositório, na mesma transação da inclusão,
  depois de `reservarSequenciaDoCodigo` (lock `pg_advisory_xact_lock`, em `cadastros/infra/codigo-sequencial.ts`).
  Sem o lock, criações simultâneas leem o mesmo último número e a maioria falha. Todo código sequencial novo
  (calculado a partir do último existente) deve usar o mesmo padrão, com uma chave de lock própria.
- Colunas obsoletas do aluno (`situacao`, `alojamentoTexto`, `apto`, `vaga`): não use em código novo.
  Ficam até a carga inicial preencher `ativo` e `alojamentoId`; depois saem numa migração própria.
- Regras do MER nas movimentações, em `modulos/movimentacoes/dominio/movimentacao.ts`: categoria compatível com o
  tipo (`conferirCategoria`) e estorno só de lançamento `MANUAL` ainda não estornado (`regraDoEstorno`; o espelho
  copia conta, categoria e vínculo). Ainda sem caso de uso nem teste: as duas pernas da transferência com mesmo
  valor, tipos opostos e contas diferentes.
- Todo ponto de entrada que monta a aplicação (`main.ts`, `main-worker.ts`, `gerar-openapi.ts`) carrega
  o `.env` da raiz: alguns providers leem variáveis já no construtor (o `PgBossService` exige `DATABASE_URL`).

## Asaas

- Todo acesso ao Asaas passa pelo cliente em `src/compartilhado/asaas/`. Módulos dependem da interface, nunca do cliente HTTP.
  O módulo importa o `AsaasModule` e injeta `ClienteAsaas`; a configuração só é lida a cada chamada,
  para a API e o gerador do OpenAPI subirem sem ela.
- A chave em uso vem da tabela `configuracoes_asaas` (cadastrada pela diretoria na tela, cifrada com AES-256-GCM
  pela `CHAVE_DE_CIFRAGEM` do `.env`, ver `src/compartilhado/seguranca/cifra.ts`); sem linha nessa tabela, vem do
  `.env` (`ASAAS_AMBIENTE`, `ASAAS_API_KEY`). Quem decide é a `FonteDaConfiguracaoAsaas`. Uma chave nova é
  testada no Asaas antes de ser guardada; a trilha registra a troca sem a chave.
- Nenhuma cobrança existe só aqui ([Confiabilidade.NF005]): primeiro o Asaas cria, depois o banco grava.
- Em testes, use um dublê da interface. Nunca chame o Asaas real em teste automatizado.
- Respostas 429 são tratadas no cliente: aguardar o intervalo informado e repetir.
- Erros do Asaas são traduzidos para mensagens orientadas à ação antes de chegar à API ([Usabilidade.NF002]). Nunca repasse a mensagem crua da plataforma.

## Webhook e worker

- O controller do webhook só faz: validar `asaas-access-token`, gravar o evento (id do Asaas com `UNIQUE`), enfileirar no pg-boss e responder 200. Nenhuma regra de negócio ali.
- O processamento fica em handlers do worker. Antes de processar, verificar se o evento já foi processado; a marcação de "processado" acontece dentro da mesma transação da baixa.
  A conciliação segue esse desenho: as regras (qual aviso leva a qual efeito) ficam em
  `modulos/cobrancas/dominio/conciliacao.ts`; o `ConciliacaoRepositorio` marca o evento como processado
  (com `updateMany ... processadoEm: null`, só um processamento consegue) e aplica o efeito na mesma transação.
- Evento gravado e não processado há mais de 5 minutos (queda entre gravar e enfileirar, ou tentativas
  esgotadas) é reenfileirado pela rotina `reprocessar-eventos-asaas`, a cada 15 minutos (ADR-0002).
- A sincronização com o Asaas ([Cobranças.RF007]) não tem regra de baixa própria: traduz a situação no Asaas
  no aviso equivalente do webhook (`dominio/sincronizacao.ts`) e aplica pela mesma `ConciliacaoRepositorio`.
  Roda sob pedido (tela) e todo dia às 5h (rotina `sincronizacao-asaas`).
- Rotinas agendadas (geração recorrente, sincronização, alerta de webhook parado) são jobs do pg-boss registrados no worker e devem gravar início, fim, total processado e falhas.
  Use o `AgendadorDeRotinas` (`src/compartilhado/fila/`): o nome da rotina entra em `ROTINAS` (vira uma fila
  "singleton", no máximo uma execução por vez) e o consumidor é ligado no `main-worker.ts`.
- Toda rotina deve ser segura para rodar duas vezes (ex.: não gerar mensalidade se já existir uma para o aluno no período).
- **Notificador de alertas** (`src/compartilhado/notificacao/`): único ponto que envia e-mail, como o cliente do Asaas é o
  único que fala com o Asaas. Os casos de uso dependem da classe abstrata `NotificadorDeAlertas`; o envio real usa a API
  HTTP de um provedor (Resend), sem dependência nova (a Railway bloqueia SMTP nos planos baratos). Lê `EMAIL_API_KEY` e
  `EMAIL_REMETENTE` do `.env` a cada envio (sem eles o alerta não sai e o motivo vai para o log) e nunca lança: devolve
  `enviado: false` com o motivo. A chave nunca vai para código, log ou trilha. Em testes, use `NotificadorDeAlertasFalso`.
- **Alerta de webhook parado** ([Confiabilidade.NF002]): a rotina `vigilancia-do-asaas` roda a cada 30 minutos no worker,
  mede há quanto tempo o Asaas não envia notificações (desde a última recebida ou do cadastro da chave) e, passado o prazo
  configurado (12, 24 ou 48 h), avisa a diretoria por e-mail. Um registro em `alertas_conciliacao` por interrupção evita
  repetir o e-mail a cada verificação: lembra a cada 24 h e encerra quando as notificações voltam. Se o e-mail não sai,
  a próxima verificação tenta de novo. As regras ficam em `cobrancas/dominio/silencio-do-asaas.ts`.

## Segurança e auditoria

- Toda rota exige sessão autenticada (guarda global), exceto login e webhook (que usa o token próprio), marcadas com `@Publico()`.
- Rotas de Administração ficam em `/api/admin/...` e exigem perfil de diretoria; o perfil é verificado no backend, sempre.
- No controller, declare também para o contrato (regra B8): `@ApiCookieAuth('cookie')` em toda rota autenticada e,
  nas de Administração, `@ApiExtension('x-perfil', 'DIRETORIA')` com `@Perfis(PerfilUsuario.DIRETORIA)`.
  Siga `administracao/api/usuarios.controller.ts`. Todo endpoint tem `@ApiOperation({ operationId })`: é o nome do hook gerado no frontend.
- Senhas com argon2. A chave do Asaas é guardada cifrada e nunca é logada.
- Auditoria: toda alteração chama `registrarNaTrilha(tx, {...})` (`src/compartilhado/auditoria/trilha.ts`)
  dentro da mesma transação, nunca `tx.registroAuditoria.create` direto. A trilha é só de inclusão: o banco
  recusa `UPDATE`/`DELETE` nela (ADR-0004, regra B13). Rotina automática grava com `usuarioId: null`.

## Testes

- Vitest. Regras de domínio e casos de uso têm teste unitário, no arquivo `*.spec.ts` ao lado do código.
- Os testes não usam banco nem rede: rodam sem o Docker. Dependências externas são trocadas por dublês
  (`cliente-asaas.falso.ts`, `agendador-de-rotinas.falso.ts`, `fila-de-eventos.falsa.ts`,
  `notificador-de-alertas.falso.ts`); repositórios são testados com um Prisma falso que anota as operações.
- `test/arquitetura/` guarda as funções de aptidão do backend (fronteiras, camadas, dinheiro, exclusão física,
  segredos, rotas autenticadas, trilha, dependências, requisitos); estão descritas em `docs/governanca/README.md`.
- Teste que cobre um requisito não funcional cita o id entre colchetes (`[Confiabilidade.NF003]`) e o requisito é
  marcado `coberto` em `docs/governanca/requisitos-verificaveis.json` (regra G5).
- O fluxo de conciliação (webhook → worker → baixa) tem teste cobrindo o evento repetido e a falha no meio da transação.
- Cobertura: `pnpm cobertura` na raiz (relatório em `coverage/index.html`).

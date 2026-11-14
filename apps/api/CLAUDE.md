# Backend (apps/api)

NestJS 12 + Prisma 7.10.0 + PostgreSQL 18 + pg-boss 12. O mesmo código roda em dois processos: `src/main.ts` (API HTTP) e `src/main-worker.ts` (worker, sem porta HTTP).

Em produção (`NODE_ENV=production`) a API também serve o site no mesmo endereço (`src/site.ts`): o build do
Vite em `apps/web/dist` (ou `CAMINHO_DO_SITE`), com `index.html` para toda página fora de `/api`, cache longo
só em `/assets` e cabeçalhos de segurança (CSP, HSTS...). Em desenvolvimento nada muda: o Vite serve o site.

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
  `eventos/`, `fila/`, `notificacao/`, `prisma/`, `saude/`, `seguranca/`, `datas.ts` (dia de hoje em São Paulo),
  `configuracao.ts` (variáveis de ambiente conferidas na subida da API e do worker), `leitura-de-entrada.ts`
  (abaixo) e `situacao-do-projeto.ts` (projeto encerrado = executado ou cancelado, usado por Cadastros e
  Movimentações sem um importar o outro).
- **Todo valor que vem de fora** (corpo, filtro da URL, aviso do Asaas) é lido por `leitura-de-entrada.ts`:
  `lerDia`, `lerMes`, `lerCentavos`, `lerInteiroNaoNegativo` e `lerTexto(valor, tamanhoMaximo)`. Elas não lançam
  erro: devolvem o valor ou o motivo da recusa (`formato`, `inexistente`, `abaixo-do-minimo`, `acima-do-maximo`,
  `caractere-nulo`). A mensagem sai de `mensagemDoDia`, `mensagemDoMes`, `mensagemDosCentavos` ou
  `mensagemDoTexto`, com o campo e o artigo (`'o vencimento'`), e o módulo só a embrulha no próprio erro
  (`CobrancaInvalida`, `DadoInvalido`...), que a `aplicacao/` transforma em 400. É o que garante data que existe,
  inteiro que cabe na coluna `Int` e texto sem `\u0000` (spec #57). Texto sem limite de negócio usa o teto
  técnico `TAMANHO_MAXIMO_TECNICO`.
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
  Exceção (ADR-0005): a origem `HERDADA`, débito da planilha trazido pela carga inicial, sem `idAsaas`.
  Nenhuma rota cria herdada (`DadosDaNovaCobranca` só aceita `OrigemEmitida`). Consulta nova que dependa
  do Asaas (conciliação, sincronização, boleto) precisa deixar a herdada de fora (`idAsaas: { not: null }`
  ou `paraConciliar`); `existeNoAsaas` e `conferirCobrancaNoAsaas` ficam em `dominio/cobranca.ts`.
- Em testes, use um dublê da interface. Nunca chame o Asaas real em teste automatizado.
- Respostas 429 são tratadas no cliente: aguardar o intervalo informado e repetir.
- Cada chamada ao Asaas tem tempo limite: 15 s nas leituras (GET, `TEMPO_LIMITE_DE_LEITURA_EM_MS`) e 45 s nos
  pedidos que criam ou alteram (POST, PUT, DELETE, `TEMPO_LIMITE_DE_ESCRITA_EM_MS`), porque abortar uma criação
  cedo demais pode deixar a cobrança no Asaas e não aqui. Estourou, vira o mesmo `ErroAsaas` de Asaas
  indisponível que a falha de rede: quem chamou reage igual (rotina e webhook repetem).
- Erros do Asaas são traduzidos para mensagens orientadas à ação antes de chegar à API ([Usabilidade.NF002]). Nunca repasse a mensagem crua da plataforma.

## Webhook e worker

- O controller do webhook só faz: validar `asaas-access-token`, gravar o evento (id do Asaas com `UNIQUE`), enfileirar no pg-boss e responder 200. Nenhuma regra de negócio ali.
  Ele também recusa com 400, sem gravar nem enfileirar, o evento fora dos limites do formato (o que o banco não
  consegue gravar): `id` ou `payment.id` com mais de 255 caracteres, `event` com mais de 100, caractere nulo ou
  surrogate sem par em qualquer texto do corpo e corpo com mais de 32 níveis (nota de 13/11/2026 no ADR-0002).
  Dado presente e inválido no pagamento (data inexistente, valor que não cabe) é gravado e vira pendência de
  conciliação no worker. Webhook e sincronização leem as datas do pagamento pela mesma função
  (`compartilhado/asaas/datas-do-pagamento.ts`).
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
  O cron e a manutenção do pg-boss rodam só no worker: o `main-worker.ts` chama `definirProcessoDaFila('worker')`
  antes de montar a aplicação; a API (padrão) só envia jobs e cria filas (`opcoesDoPgBoss`).
- Toda rotina deve ser segura para rodar duas vezes (ex.: não gerar mensalidade se já existir uma para o aluno no período).
- A geração recorrente respeita a trava opcional `GERACAO_A_PARTIR_DE` (`AAAA-MM`, lida a cada uso por
  `compartilhado/geracao-a-partir-de.ts`): mês anterior a ela não é gerado (a rotina só registra o motivo no log,
  sem gravar execução; o "gerar agora" responde 400) e a conferência dos parâmetros anuncia o primeiro mês liberado.
  A regra é `referenciaLiberada` (`cobrancas/dominio/geracao-recorrente.ts`); formato inválido é erro de configuração.
- **Notificador de alertas** (`src/compartilhado/notificacao/`): único ponto que envia e-mail, como o cliente do Asaas é o
  único que fala com o Asaas. Os casos de uso dependem da classe abstrata `NotificadorDeAlertas`; o envio real usa a API
  HTTP de um provedor (Resend), sem dependência nova (a Railway bloqueia SMTP nos planos baratos). Lê `EMAIL_API_KEY` e
  `EMAIL_REMETENTE` do `.env` a cada envio (sem eles o alerta não sai e o motivo vai para o log) e nunca lança: devolve
  `enviado: false` com o motivo. A chave nunca vai para código, log ou trilha. Em testes, use `NotificadorDeAlertasFalso`.
  A variável opcional `EMAIL_ALERTAS_PARA` (lista separada por vírgula, lida a cada envio) troca os destinatários:
  preenchida, os alertas vão só para ela, e não para a diretoria. Serve enquanto o remetente for o de teste do
  Resend, que só entrega para o dono da conta (`destinatarios-dos-alertas.ts`).
- **Alerta de webhook parado** ([Confiabilidade.NF002]): a rotina `vigilancia-do-asaas` roda a cada 30 minutos no worker,
  mede há quanto tempo o Asaas não envia notificações (desde a última recebida ou do cadastro da chave) e, passado o prazo
  configurado (12, 24 ou 48 h), avisa a diretoria por e-mail. Um registro em `alertas_conciliacao` por interrupção evita
  repetir o e-mail a cada verificação: lembra a cada 24 h e encerra quando as notificações voltam. Se o e-mail não sai,
  a próxima verificação tenta de novo. As regras ficam em `cobrancas/dominio/silencio-do-asaas.ts`.

## Segurança e auditoria

- Toda rota exige sessão autenticada (guarda global), exceto login, webhook (que usa o token próprio) e saúde,
  marcadas com `@Publico()`. O teste B8 só aceita `@Publico()` nesses três controllers, só deixa a chave
  `CHAVE_ROTA_PUBLICA` aparecer no decorator e na guarda, e fixa o número de rotas da saúde (2) e do webhook (1):
  uma rota nova ali não nasce pública sem ninguém ver.
- A guarda usa o perfil **atual** do usuário (`sessao.usuario.perfil`), não o copiado para a sessão no login:
  rebaixar alguém vale na hora. A coluna `sessoes.perfil` ficou só como registro do perfil no login (candidata a
  sair numa migração futura, no padrão expandir e contrair).
- **Saúde** (`src/compartilhado/saude/`, fora do OpenAPI): `GET /api/saude` responde 200 se o banco responde
  (a Railway libera cada implantação por ela; não depende do worker); `GET /api/saude/completa` exige também
  que a rotina `vigilancia-do-asaas` tenha concluído na última hora (um `max(completed_on)` na tabela de jobs do
  pg-boss, pelo `AgendadorDeRotinas.ultimaExecucaoConcluida`) e é a que o monitor externo vigia. A resposta da
  completa é reaproveitada por 30 s, para um excesso de pedidos não pesar no banco. Falha vira 503, sem detalhes.
- Rotas de Administração ficam em `/api/admin/...` e exigem perfil de diretoria; o perfil é verificado no backend, sempre.
- No controller, declare também para o contrato (regra B8): `@ApiCookieAuth('cookie')` em toda rota autenticada e,
  nas de Administração, `@ApiExtension('x-perfil', 'DIRETORIA')` com `@Perfis(PerfilUsuario.DIRETORIA)`.
  Siga `administracao/api/usuarios.controller.ts`. Todo endpoint tem `@ApiOperation({ operationId })`: é o nome do hook gerado no frontend.
- Senhas com argon2. A chave do Asaas é guardada cifrada e nunca é logada.
- Auditoria: toda alteração chama `registrarNaTrilha(tx, {...})` (`src/compartilhado/auditoria/trilha.ts`)
  dentro da mesma transação, nunca `tx.registroAuditoria.create` direto. A trilha é só de inclusão: o banco
  recusa `UPDATE`/`DELETE` nela (ADR-0004, regra B13). Rotina automática grava com `usuarioId: null`.
  Como ela não pode ser apagada, o `detalhe` **nunca leva dado pessoal** (nome, e-mail, CPF, telefone...):
  o registro já é identificado por `entidade` + `registroId`, e o detalhe diz o que mudou (regra B14, que também
  barra `JSON.stringify` na chamada). Como rede de segurança, `registrarNaTrilha` mascara e-mail e CPF no detalhe
  antes de gravar. Texto livre digitado pelo usuário (descrição, justificativa, motivo) ainda pode levar um nome:
  a máscara não pega isso.

## Testes

- Vitest. Regras de domínio e casos de uso têm teste unitário, no arquivo `*.spec.ts` ao lado do código.
- Os testes de unidade (`pnpm test`) não usam banco nem rede: rodam sem o Docker. Dependências externas são
  trocadas por dublês (`cliente-asaas.falso.ts`, `agendador-de-rotinas.falso.ts`, `fila-de-eventos.falsa.ts`,
  `notificador-de-alertas.falso.ts`); repositórios são testados com um Prisma falso que anota as operações.
- **Integração e sistema** (`test/integracao/`, `test/sistema/`, config `vitest.integracao.config.ts`): usam um
  PostgreSQL de verdade e a aplicação inteira; só o Asaas e o e-mail são falsos (`test/apoio/aplicacao.ts`).
  Rodam à mão com `pnpm test:integracao` (raiz), fora do `pnpm test`, dos ganchos e do CI. O banco
  `integracasd_integracao` é apagado e recriado a cada execução (`test/apoio/preparar-banco.ts`); outro banco só
  com `DATABASE_URL_INTEGRACAO`, local e com "integracao" no nome. Um arquivo por caso do Plano de Testes
  (`ct-cob-05-webhook.spec.ts`), com o requisito e o caso no `describe`. Dados fictícios pelas fábricas de
  `test/apoio/cenario.ts`; o banco é compartilhado entre os arquivos, então confira só o que o teste criou.
  O CT-NF-05 (mil alunos, ritmo real) leva uns 6 minutos; `$env:PULAR_CT_NF_05='1'` pula enquanto você trabalha.
- `test/arquitetura/` guarda as funções de aptidão do backend (fronteiras, camadas, dinheiro, exclusão física,
  segredos, rotas autenticadas, trilha, dependências, requisitos); estão descritas em `docs/governanca/README.md`.
- Teste que cobre um requisito não funcional cita o id entre colchetes (`[Confiabilidade.NF003]`) e o requisito é
  marcado `coberto` em `docs/governanca/requisitos-verificaveis.json` (regra G5).
- O fluxo de conciliação (webhook → worker → baixa) tem teste cobrindo o evento repetido e a falha no meio da transação.
- Cobertura: `pnpm cobertura` na raiz (relatório em `coverage/index.html`).

# Evidências visuais dos casos de teste (16/11/2026)

Prints que **ilustram** os casos do Plano de Testes v1.3 nas telas. O resultado oficial de cada caso continua o
do `RESULTADOS.md` da pasta `2026-11-14-2dfae9b`: estes prints não mudam nenhum Passou ou Falhou. Roteiro:
`docs/testes/roteiro-evidencias-visuais.md`.

| | |
|---|---|
| Ambiente | Homologação na Railway (`https://integracasd-homolog.up.railway.app`), Asaas sandbox |
| Commit no ar | `4eb497b` (app e worker, `V00-app.jpg` e `V00-worker.jpg`). Do `2dfae9b` para o `4eb497b` nada mudou no código da aplicação: `git diff --name-only 2dfae9b 4eb497b -- apps/api/src apps/api/prisma apps/web packages` não lista nada |
| Responsável | Marcello Ryaj, com o usuário Marcello (diretoria) da homologação, de 18:35 a 19:40 |
| Dados | Só fictícios: alunos de `dados-ficticios` (Ana Clara Ribeiro, Beatriz Moura Lima, Carlos Eduardo Vasconcelos, Júlia Nogueira Prado, Pedro Henrique Sales...), alunos da carga anonimizada e registros novos com "Teste Visual" no nome |

**Como ler os prints.** Os prints desta pasta mostram só a área da página do navegador, sem a barra de endereço e
sem o relógio do Windows. Por isso cada print tem aqui a URL e a hora da captura (horário de Brasília). Os `.jpg` são a captura
inteira; os `.png` foram recortados ou tarjados, com as coordenadas anotadas na coluna "Ajuste".

**Recortes e tarjas.** A homologação tem a carga anonimizada das movimentações de 2026. Nas telas de cadastros,
cobranças e movimentações, os prints foram recortados para ficar só com registros fictícios, ou os totais vindos
da carga foram cobertos de preto. Os blocos de inadimplência e de gastos por categoria aparecem como estão na
homologação. Nenhum valor foi alterado.

## Prints

| Caso | Arquivo | O que mostra | URL | Hora | Ajuste | Resultado |
|---|---|---|---|---|---|---|
| — | `V00-app.jpg` | Implantação ativa do `app`: "merge: Resultado de Testes v1.2 com a tabela dos defeitos" (`4eb497b`) | railway.com, projeto integracasd-homologacao, serviço app | 19:06 | — | Como esperado |
| — | `V00-worker.jpg` | Implantação ativa do `worker`, mesmo commit | railway.com, serviço worker | 19:07 | — | Como esperado |
| CT-CAD-01 | `CT-CAD-01a-cpf-repetido.jpg` | Novo aluno com o CPF de Ana Clara Ribeiro: "Já existe um cadastro ativo com este CPF (Ana Clara Ribeiro)" | /cadastros | 18:35 | — | Como esperado |
| CT-CAD-01 | `CT-CAD-01b-aluno-gravado.jpg` | Aluno "Teste Visual CAD-01" gravado, Ativo | /cadastros/alunos/31127b23-… | 18:36 | — | Como esperado |
| CT-CAD-01 | `CT-CAD-01c-trilha.jpg` | Trilha: 16/11/2026 18:36, Marcello, Inclusão, Aluno | /administracao?aba=trilha | 18:37 | — | Como esperado |
| CT-CAD-02 | `CT-CAD-02a-formulario.jpg` | Novo funcionário "Teste Visual CAD-02" com desligamento em 16/11/2026 | /cadastros?aba=funcionarios | 18:41 | — | — |
| CT-CAD-02 | `CT-CAD-02b-inativo.jpg` | Depois de salvar, fora dos ativos; com "Todos", aparece Inativo | /cadastros?aba=funcionarios | 18:41 | — | Como esperado |
| CT-CAD-03 | `CT-CAD-03a-termino-anterior.png` | Contrato com término 30/11 antes do início 01/12: "A data de término não pode ser anterior à data de início" | /cadastros?aba=contratos | 18:43 | recorte no diálogo | Como esperado |
| CT-CAD-03 | `CT-CAD-03b-contrato-ficticio.png` | Contrato fictício gravado (Gráfica Pontual, 26C002, vence em breve) | /cadastros?aba=contratos | 18:44 | recorte: só o contrato fictício | Como esperado |
| CT-CAD-04 | `CT-CAD-04a-aviso-projeto.png` | Movimentação ligada ao projeto executado 26P001: "Este projeto já foi executado. O lançamento é aceito, mas confira…". Não foi salva | Nova movimentação | 18:44 | recorte no diálogo | Como esperado |
| CT-COB-01 | `CT-COB-01a-parametros-e-falhas.png` | Parâmetros da geração e a execução de 09/11: 5 criadas, 0 já existiam, 1 falha (Pedro Henrique Sales, sem e-mail) | /administracao?aba=parametros | 18:39 | tarja: alunos a cobrar e total previsto | Como esperado |
| CT-COB-02 | `CT-COB-02a-vencimento-passado.png` | Cobrança avulsa com vencimento 15/11: "O vencimento não pode ser anterior a hoje" (R4) | /cobrancas | 18:55 | recorte no diálogo | Como esperado |
| CT-COB-02 | `CT-COB-02b-cadastro-incompleto.png` | Cobrança para Pedro Henrique Sales: "O cadastro do aluno está incompleto: falta o e-mail" (R3) | /cobrancas | 18:56 | recorte no diálogo | Como esperado |
| CT-COB-02 | `CT-COB-02c-aluno-inativo.png` | A aluna inativa Mariana Costa Albuquerque não está entre as 824 sugestões; o formulário pede um aluno da lista (R2) | /cobrancas | 18:57 | recorte no diálogo | Como esperado |
| CT-COB-03 | `CT-COB-03a-boleto-obtido.jpg` | "Teste M03 cancelar" aberta: depois de Baixar boleto, o botão vira "Abrir o boleto" | /cobrancas/8cd1dc14-… | 18:50 | — | Como esperado |
| CT-COB-03 | `CT-COB-03b-historico.jpg` | Histórico: "Boleto obtido para entrega por outro meio. (Marcello)" às 18:50 | /cobrancas/8cd1dc14-… | 18:50 | — | Como esperado |
| CT-COB-03 | `CT-COB-03c-cancelada-sem-boleto.jpg` | Cobrança cancelada: "Esta cobrança está cancelada: o boleto não vale mais e não é disponibilizado" | /cobrancas/8cd1dc14-… | 18:52 | — | Como esperado (ver observação 2) |
| CT-COB-03, CT-COB-04 | `CT-COB-03d-paga-sem-boleto-nem-cancelar.jpg` | "Teste M01" paga: o boleto é recusado e Cancelar e Registrar pagamento ficam desabilitados | /cobrancas/34ae31a9-… | 18:53 | — | Como esperado |
| CT-COB-04 | `CT-COB-04a-cancelada.jpg` | "Teste M03 cancelar" cancelada, com o motivo e a hora 18:51 | /cobrancas/8cd1dc14-… | 18:51 | — | Como esperado |
| CT-COB-04 | `CT-COB-04b-sandbox-removida.png` | No sandbox, a mesma cobrança só aparece no filtro "Exibir somente cobranças removidas" | sandbox.asaas.com/payment/list?deletedOnly=true | 19:01 | recorte sem a barra da conta | Como esperado |
| CT-COB-05 | `CT-COB-05a-webhook-sandbox.png` | Log do sandbox: notificação PAYMENT_DELETED de 18:51 enviada à homologação, resposta 200 `{"recebido": true}` | sandbox.asaas.com/customerConfigIntegrations/webhookLogs | 19:03 | recorte sem o menu | Como esperado |
| CT-COB-06 | `CT-COB-06a-sem-justificativa.png` | Registrar pagamento manual sem justificativa: "A justificativa é obrigatória". Nada foi registrado | /cobrancas/8cd1dc14-… | 18:51 | recorte no diálogo | Como esperado |
| CT-COB-06 | `CT-COB-06b-paga-com-registro-manual.jpg` | "Teste M02 Vencida" (Beatriz): Paga com registro manual, com a justificativa (registrada no M03, 15/11 15:58) | /cobrancas/ef6e3c49-… | 18:53 | — | Como esperado |
| CT-COB-06 | `CT-MOV-02b-origem-cobranca.png` | A entrada de R$ 6,00 desse pagamento em Movimentações | /movimentacoes | 18:47 | recorte: só linhas fictícias | Como esperado |
| CT-COB-07 | `CT-COB-07a-sincronizacao.png` | Sincronização das cobranças de novembro: 9 conferidas, nada a atualizar | /cobrancas | 18:54 | recorte no diálogo | Como esperado |
| CT-COB-07 | `CT-COB-07b-manual-mantido.jpg` | Sincronizar a cobrança com registro manual: "Nada mudou"; continua Paga com registro manual | /cobrancas/ef6e3c49-… | 18:54 | — | Como esperado |
| CT-COB-08 | `CT-COB-08a-padrao.png` | Sem filtro: Aberta e Vencida selecionadas, ordem por vencimento | /cobrancas | 18:49 | tarja: total de vencidas e nomes da carga | Como esperado |
| CT-COB-08 | `CT-COB-08b-filtros.png` | Aluno Carlos Eduardo, vencimento 01/11 a 31/12/2026, Aberta + Vencida + Paga: 2 cobranças | /cobrancas | 18:49 | tarja: total de vencidas | Como esperado |
| CT-MOV-01 | `CT-MOV-01a-data-amanha.png` | Data 17/11/2026: "A data não pode ser no futuro" | Nova movimentação | 18:45 | recorte no diálogo | Como esperado |
| CT-MOV-01 | `CT-MOV-01b-valor-zero.png` | Valor 0,00: "Informe um valor maior que zero" | Nova movimentação | 18:46 | recorte no diálogo | Como esperado |
| CT-MOV-02 | `CT-MOV-02a-dialogo-estorno.png` | Estornar "Teste Visual FZ-02": resumo, aviso de que não pode ser desfeito e motivo | /movimentacoes | 18:47 | recorte no diálogo | Como esperado |
| CT-MOV-02 | `CT-MOV-02c-estornada.png` | Original riscada com "Estornada em 16/11/2026" e a entrada "Estorno: …" de + R$ 5,00 | /movimentacoes | 18:48 | recorte: só linhas fictícias | Como esperado |
| CT-MOV-02 | `CT-MOV-02b-origem-cobranca.png` | Movimentação vinda de cobrança: Estornar desabilitado, com a dica "trate pela cobrança" | /movimentacoes | 18:47 | recorte: só linhas fictícias | Como esperado |
| CT-MOV-03 | `CT-MOV-03a-filtros.jpg` | Novembro, categoria Mensalidades, forma Asaas: 5 entradas fictícias, totais R$ 600,00 / R$ 0,00 / R$ 600,00 | /movimentacoes | 19:08 | — | Como esperado |
| CT-IND-01 | `CT-IND-01b-mes-vazio.png` | Dezembro de 2025: "Não há movimentações", tudo zero | / | 18:59 | recorte nos cartões | Como esperado |
| CT-IND-02 | `CT-IND-02a-inadimplencia.png` | Novembro de 2026: alunos inadimplentes, valor em aberto, faixas de atraso (até 30, 31 a 60, mais de 60 dias) e maiores devedores | / | 19:39 | recorte no bloco | Como esperado |
| CT-IND-03 | `CT-IND-03a-gastos-por-categoria.png` | Saídas de novembro por categoria, ordenadas por valor, com percentual e a comparação com outubro | / | 19:40 | recorte no bloco | Como esperado |
| CT-IND-01 a 03, CT-CAD-03, CT-ADM-02, CT-NF-07 | `CI-a-execucao-2dfae9b.jpg`, `CI-b-vitest-599-testes.jpg`, `CI-d-log-unidade-indicadores-contrato.png` | CI do GitHub no commit `2dfae9b`: Success; 75 arquivos e 599 testes. No log (d): contrato.spec (CT-CAD-03), consultar-painel (CT-IND-01), inadimplencia (CT-IND-02) e gastos-por-categoria (CT-IND-03) passando; categorias.spec (CT-ADM-02) aparece no `CI-c` | github.com/ry7a/IntegraCASD/actions/runs/43592468731 | 19:03 a 19:05 | recorte sem a barra lateral (c, d) | Como esperado |
| CT-ADM-02 | `CT-ADM-02a-nome-repetido.png` | Categoria "Contratos": "Já existe uma categoria ativa chamada Contratos" | /administracao?aba=categorias | 18:38 | recorte no diálogo | Como esperado |
| CT-ADM-03 | `CT-ADM-03a-dia-invalido.png` | Dia de geração 6, vencimento 5: "O dia de geração precisa ser antes do dia de vencimento"; aviso de que vale só para as próximas. A API depois confirmou que nada mudou (dia de geração 1) | /administracao?aba=parametros | 18:39 | tarja: alunos a cobrar e total previsto | Como esperado |
| CT-ADM-04 | `CT-ADM-04a-chave-oculta.jpg` | "Cadastrada em 08/11/2026 por Marcello. Por segurança, nunca é exibida." | /administracao?aba=integracao | 18:38 | — | Como esperado |
| CT-ADM-04 | `CT-ADM-04c-api-sem-chave.jpg` | Resposta de `GET /api/admin/integracao-asaas`: ambiente, datas, autor e prazo, sem a chave | /api/admin/integracao-asaas | 18:38 | — | Como esperado |
| CT-ADM-05 | `CT-ADM-05a-filtros.jpg` | Trilha de 15/11 a 16/11, usuário Marcello; nenhuma ação de editar ou excluir | /administracao?aba=trilha | 18:37 | — | Como esperado |
| CT-NF-04 | `CT-NF-04a-prazo.jpg` | Prazo do alerta: 24 horas (mesma captura do CT-ADM-04a) | /administracao?aba=integracao | 18:38 | — | Como esperado |
| CT-NF-04 | `CT-NF-04b-trilha.jpg` | Alerta de webhook parado na homologação: aberto em 13/11 19:00, e-mails, encerrado em 15/11 15:00 quando as notificações voltaram, aberto de novo em 16/11 16:00; "A trilha não pode ser alterada nem excluída" | /administracao?aba=trilha | 18:37 | — | Como esperado |
| CT-NF-07 | `CI-c-log-arquitetura.png` | Log do CI: `test/arquitetura/*.spec.ts` passando (busca: 12 ocorrências) | github.com/…/job/132439927798 | 19:05 | recorte sem a barra lateral | Como esperado |
| CT-FZ-01 | `CT-FZ-01b-entradas.png` | As entradas geradas por LLM no commit `2dfae9b`: aluno, cobrança avulsa, consultas, movimentação e webhook | github.com/ry7a/IntegraCASD/tree/2dfae9b/…/entradas | 19:06 | recorte: caminho da pasta e lista de arquivos | — |
| CT-FZ-01 | `CT-FZ-01c-entradas-webhook.png` | `webhook-asaas.json`: como foram geradas, marcadores e a primeira entrada (JSON truncado, esperado "recusa") | github.com/…/webhook-asaas.json | 19:06 | recorte: caminho do arquivo e conteúdo | — |
| CT-FZ-02 | `CT-FZ-02a-email-malformado.png` | E-mail `teste.visual@`: "Informe um e-mail válido" | /cadastros | 18:57 | recorte no diálogo | Como esperado |
| CT-FZ-02 | `CT-FZ-02a-cpf-invalido.png` | CPF 123.456.789-00: "Este CPF não é válido" | /cadastros | 18:58 | recorte no diálogo | Como esperado |
| CT-FZ-02 | `CT-FZ-02b-valor-negativo-gravado.png` | Valor "-5,00" numa saída: a tela gravou uma saída de R$ 5,00 | /movimentacoes | 18:47 | recorte: só a linha | **Divergência** (ver abaixo) |
| CT-FZ-02 | `CT-FZ-02c-busca-sql.png` | Busca de cobranças com `' OR 1=1 --`: "Nenhuma cobrança encontrada", sem erro | /cobrancas | 18:58 | tarja: total de vencidas | Como esperado |
| CT-FZ-02 | `CT-FZ-02d-busca-percentual.png` | Busca com `%`: nenhuma cobrança (D9 corrigido) | /cobrancas | 18:58 | tarja: total de vencidas | Como esperado |

Já existem na pasta `2026-11-14-2dfae9b` e não foram refeitos: CT-SIS-01 (`M01a` a `M01e`), CT-NF-01 (`M03-*`),
inativação com débito do CT-CAD-01 (`M02-*`) e emissão válida do CT-COB-02 (`M01a-emitida.png`).

## Divergência: valor negativo na tela de movimentação (CT-FZ-02)

Digitar `-5,00` no campo Valor de uma saída não foi recusado: a tela tirou o sinal e gravou "Teste Visual FZ-02:
valor negativo" como saída de R$ 5,00. O plano espera que valor negativo seja recusado, com mensagem no campo. O
teste automatizado do CT-FZ-02 manda o negativo direto para a API, que recusa; o campo da tela converte o texto
antes, e a API nunca recebe o sinal. O CT-FZ-02 continua Passou no `RESULTADOS.md` (o caso é da API), mas a tela
tem a falha. Para corrigir: o campo de valor recusar o sinal de menos, com a mensagem de valor inválido.

A saída gravada foi estornada às 18:48, com o motivo registrado no estorno (prints do CT-MOV-02). Defeito D10,
issue #67, corrigido pelo commit `4b21d6a` (merge `b3b0948`): o campo de valor passou a recusar o sinal de menos.

## Observações

1. **Validação no formulário:** em alguns prints a mensagem vem do próprio formulário, antes de chegar à API
   (valor zero no CT-MOV-01b, justificativa no CT-COB-06a, e-mail no CT-FZ-02a). A regra que vale é a da API,
   coberta pelo E07.
2. **Boleto de cobrança cancelada ou paga:** o botão "Baixar boleto" continua aparecendo, mas a API recusa e
   explica o motivo (CT-COB-03c e 03d). O boleto não é entregue; o botão desabilitado seria mais claro.
3. **Notificação repetida não duplica (CT-COB-05)** e **o Asaas recusa o cancelamento (CT-COB-04 E2)**: não dá
   para provocar pela tela. Ficam só no teste automatizado.

## O que mudou na homologação e no sandbox

- Aluno "Teste Visual CAD-01" (CPF fictício 544.324.240-79) e funcionário "Teste Visual CAD-02" (inativo desde 16/11) criados.
- Cobrança "Teste M03 cancelar" (Carlos Eduardo) cancelada aqui e removida no sandbox, com o boleto obtido antes.
- Saída "Teste Visual FZ-02" de R$ 5,00 gravada pela divergência e estornada.
- Uma sincronização das cobranças de novembro e uma da "Teste M02 Vencida" (nenhuma mudança).
- Envios recusados, sem gravação: CPF repetido, contrato com término anterior, movimentações com data futura e
  valor zero, três cobranças avulsas, pagamento manual sem justificativa, categoria repetida, parâmetros
  inválidos, aluno com CPF e e-mail inválidos.

## Casos sem print

CT-ADM-01, CT-NF-02, CT-NF-03, CT-NF-05 e CT-NF-06 não têm print nesta pasta. O resultado deles está no
`RESULTADOS.md` da pasta `2026-11-14-2dfae9b`.

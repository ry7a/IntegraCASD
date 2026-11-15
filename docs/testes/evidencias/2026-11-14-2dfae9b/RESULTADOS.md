# Resultados do Plano de Testes v1.1

Gerado por `pnpm evidencias` em 2026-11-15 17:08:33 (UTC-03:00). Não edite à mão: rode `pnpm evidencias -- --fechar 2026-11-14-2dfae9b`.
Como cada evidência foi produzida: `docs/testes/roteiro-de-execucao.md`.

| | |
|---|---|
| Commit testado | `2dfae9b10b823f6b8d042d1a0d54c72b2562d77a` (merge: coleta automática das evidências do plano de testes) |
| Data do commit | 2026-11-14 08:51:40 -0300 |
| Publicado no GitHub | sim (origin/main) |
| Executado por | Ryaj |
| Início e fim das fases automáticas | 2026-11-14 08:57:57 (UTC-03:00) a 2026-11-14 09:12:48 (UTC-03:00) |
| Ambiente | `E00-ambiente.txt` |

## Critério de aceite

O MVP pode ser entregue quando todos os casos de requisitos essenciais passam. Falha em requisito importante
ou desejável só é aceita com decisão registrada da equipe (Seção 6.1 do plano).

**INCOMPLETO: 1 caso(s) ainda dependem de verificação manual.**

- Casos de requisito essencial: 22 de 23 passaram.
- Casos de requisito importante ou desejável que não passaram: CT-COB-03 (falhou).
- Casos pendentes de verificação manual: CT-CAD-01.

## Resumo por nível

| Resultado | Unidade | Integração | Sistema | Total |
|---|---|---|---|---|
| Passou | 7 | 14 | 10 | 31 |
| Falhou | 0 | 1 | 0 | 1 |
| Bloqueado | 0 | 0 | 0 | 0 |
| Pendente | 0 | 1 | 0 | 1 |
| **Total** | 7 | 16 | 10 | 33 |

## Fases automáticas

| Evidência | O que é | Resultado |
|---|---|---|
| E00 | Preparação e ambiente | código 0, 4 s |
| E01 | Lint | código 0, 12 s |
| E02 | Testes de unidade e de arquitetura | código 0, 24 s; 75 arquivos; 599 testes: 599 passaram, 0 falharam |
| E03 | Cobertura dos testes de unidade | código 0, 38 s; instruções 66,2% (2463/3720), ramos 67,64% (1595/2358), funções 52,5% (462/880), linhas 66,74% (2238/3353) |
| E04 | Funções de aptidão (migrações e cores) | código 0, 1 s |
| E05 | Build, bundle, dados fictícios e contrato | código 0, 49 s |
| E06 | CI no GitHub, mesmo commit | success: https://github.com/ry7a/IntegraCASD/actions/runs/43592468731 |
| E07 | Integração e sistema, PostgreSQL real | código 0, 751 s; 25 arquivos; 406 testes: 406 passaram, 0 falharam |

## Resultado por caso

| Caso | Nome | Requisitos | Prioridade | Nível | O que sustenta o resultado | Resultado |
|---|---|---|---|---|---|---|
| CT-CAD-01 | Cadastro de aluno | Cadastros.RF001 | Essencial | I | 4 de 4 testes passaram (E07); H00: passou; M02 pendente | **Pendente** |
| CT-CAD-02 | Cadastro de funcionário | Cadastros.RF002 | Essencial | I | 4 de 4 testes passaram (E07) | Passou |
| CT-CAD-03 | Contratos | Cadastros.RF004 | Importante | U | 8 de 8 testes passaram (E02) | Passou |
| CT-CAD-04 | Projetos | Cadastros.RF005 | Importante | I | 4 de 4 testes passaram (E07) | Passou |
| CT-COB-01 | Geração recorrente | Cobranças.RF001 | Essencial | I | 4 de 4 testes passaram (E07) | Passou |
| CT-COB-02 | Emissão avulsa | Cobranças.RF002 | Essencial | I | 6 de 6 testes passaram (E07) | Passou |
| CT-COB-03 | Boleto | Cobranças.RF003 | Importante | I | 5 de 5 testes passaram (E07); defeito D2 em aberto: "reenviar o boleto por e-mail" não existe (issue \#29) | **Falhou** |
| CT-COB-04 | Cancelamento | Cobranças.RF004 | Importante | I | 8 de 8 testes passaram (E07) | Passou |
| CT-COB-05 | Webhook e baixa | Cobranças.RF005 | Essencial | S | 3 de 3 testes passaram (E07); H00: passou; H03: passou | Passou |
| CT-COB-06 | Pagamento manual | Cobranças.RF006 | Importante | I | 5 de 5 testes passaram (E07) | Passou |
| CT-COB-07 | Sincronização | Cobranças.RF007 | Importante | I | 5 de 5 testes passaram (E07) | Passou |
| CT-COB-08 | Consulta de cobranças | Cobranças.RF008 | Essencial | S | 6 de 6 testes passaram (E07) | Passou |
| CT-MOV-01 | Registro de movimentação | Movimentações.RF001 | Essencial | I | 5 de 5 testes passaram (E07) | Passou |
| CT-MOV-02 | Estorno | Movimentações.RF002 | Importante | I | 6 de 6 testes passaram (E07) | Passou |
| CT-MOV-03 | Consulta de movimentações | Movimentações.RF003 | Essencial | S | 6 de 6 testes passaram (E07) | Passou |
| CT-IND-01 | Painel de indicadores | Indicadores.RF001 | Essencial | U | 4 de 4 testes passaram (E02) | Passou |
| CT-IND-02 | Inadimplência | Indicadores.RF002 | Essencial | U | 7 de 7 testes passaram (E02) | Passou |
| CT-IND-03 | Gastos por categoria | Indicadores.RF003 | Importante | U | 3 de 3 testes passaram (E02) | Passou |
| CT-ADM-01 | Usuários e permissões | Administração.RF001 | Essencial | S | 7 de 7 testes passaram (E07) | Passou |
| CT-ADM-02 | Categorias | Administração.RF002 | Essencial | U | 4 de 4 testes passaram (E02) | Passou |
| CT-ADM-03 | Parâmetros de cobrança | Administração.RF003 | Essencial | U | 13 de 13 testes passaram (E02 + E07) | Passou |
| CT-ADM-04 | Chave do Asaas | Administração.RF004 | Essencial | I | 4 de 4 testes passaram (E07) | Passou |
| CT-ADM-05 | Trilha de auditoria | Administração.RF005 | Desejável | S | 5 de 5 testes passaram (E07) | Passou |
| CT-SIS-01 | Ponta a ponta no sandbox | Cobranças.RF002, Cobranças.RF005, Indicadores.RF001 | Essencial | S | H00: passou; M01: passou | Passou |
| CT-NF-01 | Usabilidade nas telas | Usabilidade.NF001, Usabilidade.NF003, Usabilidade.NF004 | Essencial | S | H00: passou; M03: passou | Passou |
| CT-NF-02 | Falha injetada desfaz a baixa | Confiabilidade.NF004, Hardware e software.NF005 | Essencial | I | 4 de 4 testes passaram (E07) | Passou |
| CT-NF-03 | Tempo de resposta do webhook | Confiabilidade.NF001, Desempenho.NF001 | Essencial | S | 1 de 1 testes passaram (E07); H00: passou; H01: passou | Passou |
| CT-NF-04 | Alerta de webhook parado | Confiabilidade.NF002 | Essencial | I | 3 de 3 testes passaram (E07) | Passou |
| CT-NF-05 | 1.000 alunos com 429 do Asaas | Desempenho.NF004, Desempenho.NF005 | Importante | I | 1 de 1 testes passaram (E07) | Passou |
| CT-NF-06 | Autenticação e bloqueio | Segurança.NF001, Segurança.NF005, Segurança.NF007 | Essencial | I | 14 de 14 testes passaram (E02 + E07) | Passou |
| CT-NF-07 | Funções de aptidão e ganchos | Segurança.NF003, Segurança.NF006, Padrões.NF001, Padrões.NF003 | Essencial | U | 37 de 37 testes passaram (E02); E04 com código 0; I02: passou | Passou |
| CT-FZ-01 | Fuzzing do webhook | Cobranças.RF005, Segurança.NF002, Confiabilidade.NF003 | Essencial | S | 88 de 88 testes passaram (E07) | Passou |
| CT-FZ-02 | Fuzzing de formulários e filtros | Cadastros.RF001, Cobranças.RF002, Movimentações.RF001, Usabilidade.NF002 | Essencial | S | 206 de 206 testes passaram (E07) | Passou |

## Verificações manuais e de homologação

Anotadas em `verificacoes-manuais.json`. Só contam com o resultado anotado e ao menos um arquivo cujo nome começa pelo id.

| Id | O que é | Casos | Arquivos | Resultado | Responsável | Data | Observação |
|---|---|---|---|---|---|---|---|
| H00 | A homologação (app e worker) roda o commit testado | CT-CAD-01, CT-COB-05, CT-SIS-01, CT-NF-01, CT-NF-03 | H00-app.png, H00-worker.png | Passou | Ryaj | 2026-11-15 | app e worker com a implantação ativa no commit 2dfae9b (H00-app.png, H00-worker.png) |
| H01 | Tempo de resposta do webhook na homologação | CT-NF-03 | H01-medir-webhook.txt | Passou | Ryaj | 2026-11-15 | 100/100 respostas 200; média 243 ms, p95 345 ms, máx. 911 ms (limite 5000 ms) — H01-medir-webhook.txt |
| H02 | Segurança do ambiente de homologação \[Segurança.NF004\] | fora dos 33 casos | H02-console.png, H02-cookie.png, H02-seguranca.txt, H02-tls.txt | Passou | Ryaj | 2026-11-15 | /api/docs 404; HSTS e CSP presentes; TLS 1.2 aceito e TLS 1.1 recusado (alerta 70); cookie integracasd\_sessao Secure/HttpOnly/SameSite Strict; console sem erro de CSP; sessão do print encerrada com Sair. O valor do cookie de sessão foi tarjado em H02-cookie.png antes da publicação (o repositório é público); os atributos continuam visíveis |
| H03 | Webhook com token errado na homologação responde 401 | CT-COB-05 | H03-webhook-401.txt | Passou | Ryaj | 2026-11-15 | POST /api/webhooks/asaas com token errado: 401 (H03-webhook-401.txt) |
| M01 | Ponta a ponta com o Asaas sandbox | CT-SIS-01 | M01a-emitida.png, M01a-sandbox-emitida.png, M01b-sandbox-pago.png, M01c-paga.png, M01d-entrada.png, M01e-painel.png | Passou | Ryaj | 2026-11-15 | Cobrança avulsa "Teste M01" (Ana Clara Ribeiro, R$ 120,00) emitida às 15:33 (M01a-emitida.png, M01a-sandbox-emitida.png); pagamento confirmado no sandbox às 15:35 (M01b); às 15:36 já Paga no IntegraCASD sem ação manual, pelo webhook (M01c); entrada de R$ 120,00 em Movimentações, forma Asaas, origem conciliação automática (M01d), e no painel de Indicadores (M01e). Uma tentativa anterior de emissão, para outro aluno, foi recusada pelo Asaas com 400 invalid\_value (campo valor) e nada foi gravado; o sistema só valida valor maior que zero e mostra mensagem genérica (achado de usabilidade, não bloqueia). |
| M02 | Inativar aluno com débito vencido e com débito aberto | CT-CAD-01 | M02-confirmacao-aberta.png, M02a-sandbox-vencida.png | Pendente | Ryaj |  | Parte "aberta" feita em 15/11 (M02-confirmacao-aberta.png): Júlia Nogueira Prado só com cobrança aberta e não vencida (Teste M02, R$ 50,00, vencimento 05/12/2026); o diálogo de inativação mostra "Este aluno tem débito: R$ 50,00 em aberto, ainda sem cobrança vencida" e pede confirmação (D3 corrigido); inativação não confirmada. FALTA a parte "vencida". O "Forçar vencimento" do sandbox (M02a-sandbox-vencida.png) não muda a situação no IntegraCASD: Vencida é calculada pela data (decisão do MER, docs/arquitetura/mer-financeiro.md). |
| M03 | Usabilidade nas telas | CT-NF-01 | M03-confirma-cancelamento.png, M03-confirma-estorno.png, M03-emitir-cobranca.png, M03-graficos-tabela.png, M03-lancar-movimentacao.png, M03-localizar-aluno-interacao-0.png, M03-localizar-aluno-interacao-1.png, M03-localizar-aluno-interacao-2.png, M03-localizar-aluno-interacao-3.png, M03-selos.png | Passou | Ryaj | 2026-11-15 | Localizar aluno: 3 interações a partir da tela inicial (Cadastros, campo de busca, digitar o nome; M03-localizar-aluno-interacao-0 a 3). Lançar movimentação: 1 (botão Nova movimentação da barra superior). Emitir cobrança avulsa: 1 (botão Nova cobrança). Estorno de movimentação e cancelamento de cobrança mostram resumo, avisam que não pode ser desfeito e pedem motivo e confirmação (não confirmados). Situações em selos com texto e ícone: Aberta, Vencida, Paga, Paga com registro manual, Cancelada, Estornada (M03-selos.png). Gráfico Entradas e saídas: Ver os dados em tabela mostra os mesmos valores das barras (novembro R$ 1.187,03). Gastos por categoria não avaliado na tela: não houve saída em novembro e o bloco ficou vazio. |
| I01 | Backup e restauração \[Confiabilidade.NF006\] | fora dos 33 casos | I01-backup.txt, I01-conferencia.txt, I01-restauracao.txt | Passou | Ryaj (conferência: Claude) | 2026-11-15 | Backup do banco local (Docker) com fazer-backup.ps1 (I01-backup.txt) e restauração no banco separado integracasd\_restaurado com restaurar-backup.ps1 (I01-restauracao.txt). Conferências do playbook (I01-conferencia.txt): contagens idênticas na origem e no restaurado (18 migrações, 1 usuário, 890 alunos, 1098 cobranças, 0 movimentações, 3097 registros da trilha, mesmo último registro) e mesma soma dos valores das cobranças; UPDATE na trilha do restaurado recusado (só inclusão). Não refeito agora: API subindo sobre o restaurado (feito em 26/10, registrado no playbook). Restaurar um backup da homologação baixado do R2 segue pendente (playbook, \#52). |
| I02 | O gancho do git barra merge com teste falhando | CT-NF-07 | I02-gancho.txt | Passou | Ryaj | 2026-11-15 | Branch teste/gancho-bloqueia com uma quebra proposital em datas.spec.ts (commit 4f89d4c, 16:49). git merge --no-ff na main: o pre-merge-commit rodou lint e testes, 1 teste falhou (598 passaram) e o merge não foi concluído ("Merge bloqueado", "Not committing merge") — I02-gancho.txt. Depois: git merge --abort, branch apagada, main de volta em 2dfae9b sem alterações. Uma primeira tentativa às 16:45 não executou o teste (a branch ficou sem commit e o merge respondeu "Already up to date"); foi refeita. |

## Defeitos em aberto

- D2 (CT-COB-03): "reenviar o boleto por e-mail" não existe. Issue #29.

Todo teste que falhar nesta execução vira issue no GitHub, citando o caso e o requisito (Seção 8 do roteiro).

## Anexo: os testes de cada caso

Nome de cada teste, sem o `describe` que cita o caso; busque o nome no `E02-unidade.txt` ou no `E07-integracao.txt`.
✓ passou, ✗ falhou, – não rodou.

### CT-CAD-01: Cadastro de aluno

- ✓ (E07) R1 (fluxo FP): aluno válido é gravado ativo e a inclusão fica na trilha de auditoria
- ✓ (E07) R2 (fluxo E1): CPF de outro cadastro ativo é recusado e nada é gravado
- ✓ (E07) R3 (fluxo E1): CPF que só existe num cadastro inativo não impede a inclusão
- ✓ (E07) R4 (fluxo E2): inativar aluno com débito informa o débito antes e, confirmada, mantém as cobranças

### CT-CAD-02: Cadastro de funcionário

- ✓ (E07) fluxo FP: funcionário válido é gravado ativo, com a inclusão na trilha
- ✓ (E07) fluxo A1 (valor-limite): desligamento 'ontem' deixa o funcionário ativo = false e mantém o histórico de pagamentos
- ✓ (E07) fluxo A1 (valor-limite): desligamento 'hoje' deixa o funcionário ativo = false e mantém o histórico de pagamentos
- ✓ (E07) fluxo A1 (valor-limite): desligamento 'amanhã' deixa o funcionário ativo = true e mantém o histórico de pagamentos

### CT-CAD-03: Contratos

- ✓ (E02) lê e normaliza um contrato válido; sem término, o prazo é indeterminado
- ✓ (E02) recusa término antes do início (fluxo E1), inclusive na alteração
- ✓ (E02) recusa caractere nulo nos textos, citando o campo, em vez de virar erro 500 no banco
- ✓ (E02) data com ano antes de 1900 é recusada pela regra comum de data, citando o campo
- ✓ (E02) recusa periodicidade desconhecida e valor fracionado
- ✓ (E02) situação: vigente, vence em breve (até 60 dias), encerrado pelo término ou pelo usuário
- ✓ (E02) encerramento exige justificativa e data a partir do início (fluxo A1)
- ✓ (E02) código no formato da planilha: ano + C + sequência (MER, regra 7)

### CT-CAD-04: Projetos

- ✓ (E07) fluxo FP: projeto válido é gravado com o código gerado e a inclusão na trilha
- ✓ (E07) contraste do fluxo E1: em projeto em andamento a movimentação é aceita sem aviso
- ✓ (E07) fluxo E1: movimentação em projeto encerrado (EXECUTADO) é aceita, gravada no projeto e sinalizada com aviso
- ✓ (E07) fluxo E1: movimentação em projeto encerrado (CANCELADO) é aceita, gravada no projeto e sinalizada com aviso

### CT-COB-01: Geração recorrente

- ✓ (E07) FP: cria uma cobrança Aberta por aluno ativo, primeiro no Asaas e depois aqui; o aluno inativo não é cobrado
- ✓ (E07) A2: aluno sem e-mail ou com CPF inválido vai para a lista de falhas, com o campo que falta, e não chega ao Asaas
- ✓ (E07) \[Confiabilidade.NF007\] a execução fica registrada com início, fim, totais e falhas, e a API a mostra
- ✓ (E07) A1: rodar de novo não duplica: quem já tem a mensalidade do mês é pulado e o Asaas não é chamado de novo

### CT-COB-02: Emissão avulsa

- ✓ (E07) R1: aluno ativo com e-mail e CPF válidos, vencimento futuro e Asaas no ar: cria a cobrança Aberta com o id do Asaas \[Confiabilidade.NF005\]
- ✓ (E07) R2: aluno inativo: recusa a emissão, sem chamar o Asaas e sem gravar nada
- ✓ (E07) R3: aluno sem e-mail: recusa e aponta o e-mail como o campo pendente (fluxo A1)
- ✓ (E07) R3: aluno com CPF inválido: recusa e aponta o CPF como o campo pendente (fluxo A1)
- ✓ (E07) R4: vencimento no passado é recusado (fluxo E2): ontem não é aceito, hoje é
- ✓ (E07) R5: Asaas fora do ar: nada é gravado nem enfileirado, e a mensagem orienta nova tentativa (fluxo E1) \[Confiabilidade.NF005\] \[Usabilidade.NF002\]

### CT-COB-03: Boleto

- ✓ (E07) FP: cobrança Aberta entrega o link do boleto e o histórico registra a obtenção, com autor, data e hora
- ✓ (E07) FP: cobrança Vencida (aberta com o vencimento passado) também entrega o boleto
- ✓ (E07) E1: cobrança Paga não oferece o boleto e informa a situação
- ✓ (E07) E1: cobrança Paga com registro manual não oferece o boleto e informa a situação
- ✓ (E07) E1: cobrança Cancelada não oferece o boleto e informa a situação

### CT-COB-04: Cancelamento

- ✓ (E07) FP: cobrança Aberta é cancelada no Asaas e, confirmado lá, fica Cancelada aqui com motivo, autor, data e hora
- ✓ (E07) FP: cobrança Vencida (aberta com o vencimento passado) também é cancelada
- ✓ (E07) E1: cobrança Paga não é cancelada, nem chega ao Asaas; a resposta diz que a devolução é pelo estorno do Asaas
- ✓ (E07) E1: cobrança Paga com registro manual também não é cancelada, nem chega ao Asaas
- ✓ (E07) transição proibida: cobrança já Cancelada não é cancelada de novo, nem chega outra vez ao Asaas
- ✓ (E07) E2: o Asaas não responde: nada muda aqui e a mensagem orienta nova tentativa \[Usabilidade.NF002\]
- ✓ (E07) motivo com caractere nulo: recusa com 400 citando o motivo, sem chegar ao Asaas \[Usabilidade.NF002\]
- ✓ (E07) E2: o Asaas recusa o cancelamento: nada muda aqui e a falha é informada

### CT-COB-05: Webhook e baixa

- ✓ (E07) token errado, quase igual ou ausente é recusado com 401, nada é gravado e a tentativa fica no log (fluxo E2) \[Segurança.NF002\]
- ✓ (E07) com o token certo, grava o evento, enfileira e responde 200 sem processar na requisição
- ✓ (E07) o worker deixa a cobrança Paga e cria a entrada; a notificação repetida não duplica nada \[Confiabilidade.NF003\]

### CT-COB-06: Pagamento manual

- ✓ (E07) FP: cobrança Aberta fica Paga com registro manual e a entrada vai para a conta e a categoria dos parâmetros, na mesma operação \[Confiabilidade.NF004\]
- ✓ (E07) FP: cobrança Vencida de mensalidade também aceita o registro, e a entrada vai para a categoria de mensalidade
- ✓ (E07) E1: sem justificativa escrita o registro é recusado e nada muda
- ✓ (E07) transição proibida: registrar pagamento numa cobrança Cancelada é recusado e não cria entrada
- ✓ (E07) transição proibida: registrar de novo numa cobrança já Paga com registro manual é recusado, sem segunda entrada

### CT-COB-07: Sincronização

- ✓ (E07) FP: adota a situação do Asaas (recebida lá vira Paga aqui) e cria a entrada que faltava
- ✓ (E07) FP: cobrança sem divergência (pendente lá, aberta aqui) não muda nem ganha entrada, mas fica marcada como conferida
- ✓ (E07) A4: cobrança Paga com registro manual não é sobrescrita: vai para a fila de pendências, sem segunda entrada
- ✓ (E07) a resolução da pendência com caractere nulo é recusada com 400 citando a resolução, e a pendência continua aberta
- ✓ (E07) \[Confiabilidade.NF007\] a execução fica registrada com início, fim, autor e o resumo do que mudou, que a resposta também mostra

### CT-COB-08: Consulta de cobranças

- ✓ (E07) FP: sem nenhum filtro, mostra só as abertas e as vencidas, ordenadas por vencimento, e não altera nada
- ✓ (E07) FP: filtro por aluno, sem escolher a situação: só as abertas e vencidas dele, por vencimento, com os dias de atraso
- ✓ (E07) FP: filtro por aluno e situação: cada situação escolhida traz só as cobranças nela
- ✓ (E07) FP: filtro só por situação: todas as cobranças do banco nessa situação, e nenhuma outra
- ✓ (E07) FP: filtro por período de vencimento, com os dois limites incluídos
- ✓ (E07) FA: busca com %, \_ ou \\ procura o caractere como texto, e não como curinga do LIKE

### CT-MOV-01: Registro de movimentação

- ✓ (E07) fluxo FP: movimentação válida é gravada como lançamento manual, com o autor e a trilha
- ✓ (E07) fluxo E1 (valor-limite): data de 'hoje' responde 201
- ✓ (E07) fluxo E1 (valor-limite): data de 'amanhã' responde 400
- ✓ (E07) fluxo E2 (valor-limite): valor de '1 centavo' responde 201
- ✓ (E07) fluxo E2 (valor-limite): valor de 'zero' responde 400

### CT-MOV-02: Estorno

- ✓ (E07) R1 (fluxo FP): estorno de lançamento manual cria o espelho de sinal contrário e zera o efeito no resultado
- ✓ (E07) R2 (fluxo E2): movimentação já estornada não ganha outro espelho
- ✓ (E07) R3 (fluxo E1): movimentação do registro manual de pagamento de cobrança não pode ser estornada
- ✓ (E07) R4 (fluxo E1): movimentação da conciliação automática não pode ser estornada
- ✓ (E07) R5: o próprio espelho (origem ESTORNO) não pode ser estornado
- ✓ (E07) motivo com caractere nulo: recusa com 400 citando o motivo e não cria o espelho \[Usabilidade.NF002\]

### CT-MOV-03: Consulta de movimentações

- ✓ (E07) fluxo FP, passo 2: sem filtro, mostra as movimentações do mês corrente
- ✓ (E07) fluxo FP, passos 3 e 4: período (mês corrente) e categoria, com totais de entrada, saída e resultado
- ✓ (E07) fluxo FP, passos 3 e 4: outro período (mês anterior) na mesma categoria traz só o lançamento daquele mês
- ✓ (E07) fluxo FP, passos 3 e 4: outra categoria no mesmo período, e categoria combinada com tipo
- ✓ (E07) fluxo FP: a consulta não altera o estado do sistema
- ✓ (E07) saída do caso de uso: a estornada aparece sinalizada junto ao espelho, e o par sai dos totais

### CT-IND-01: Painel de indicadores

- ✓ (E02) resultado do mês e variação sobre o anterior; aguardando liberação separado (fluxo A2)
- ✓ (E02) mês sem movimentação: zeros e aviso, sem erro (fluxo A1); sem base, variação nula
- ✓ (E02) mês em formato inválido: 400
- ✓ (E02) evolução: os 6 meses até o de referência, do mais antigo ao mais recente, virando o ano

### CT-IND-02: Inadimplência

- ✓ (E02) atraso de 30 dias entra na faixa 'ate30Dias'
- ✓ (E02) atraso de 31 dias entra na faixa 'de31a60Dias'
- ✓ (E02) atraso de 60 dias entra na faixa 'de31a60Dias'
- ✓ (E02) atraso de 61 dias entra na faixa 'acimaDe60Dias'
- ✓ (E02) agrupa por aluno, soma os valores originais e ordena os devedores por valor
- ✓ (E02) cada aluno entra na faixa do atraso da cobrança mais antiga
- ✓ (E02) sem cobranças vencidas, tudo zerado; a relação tem no máximo 10 devedores

### CT-IND-03: Gastos por categoria

- ✓ (E02) ordena por valor, com a participação de cada uma (uma casa decimal)
- ✓ (E02) compara com o mês anterior (fluxo A1); categoria só do mês anterior aparece com zero
- ✓ (E02) mês sem saídas: total zero e lista vazia

### CT-ADM-01: Usuários e permissões

- ✓ (E07) fluxo FP: a diretoria cria um usuário, que entra com a senha inicial; a inclusão vai para a trilha
- ✓ (E07) caractere nulo no nome ou no e-mail: 400 citando o campo, na inclusão e na alteração, sem gravar \[Usabilidade.NF002\]
- ✓ (E07) partição ADMINISTRATIVO: 403 em todas as rotas de Administração, sem efeito no banco \[Segurança.NF001\]
- ✓ (E07) partição DIRETORIA: acessa a Administração e tudo o que o administrativo acessa \[Segurança.NF001\]
- ✓ (E07) partição sem sessão: 401 nas rotas de Administração e nas demais \[Segurança.NF001\]
- ✓ (E07) fluxo FP: rebaixar um diretor vale a partir do próximo acesso
- ✓ (E07) fluxo A1: com dois diretores ativos um inativa o outro; o último diretor ativo não pode ser rebaixado nem inativado

### CT-ADM-02: Categorias

- ✓ (E02) grava o nome normalizado e o tipo
- ✓ (E02) recusa nome igual ao de outra categoria ativa (fluxo E1) com 409
- ✓ (E02) recusa dados inválidos com 400
- ✓ (E02) recusa com 400 o nome com caractere nulo, citando o nome da categoria, sem gravar

### CT-ADM-03: Parâmetros de cobrança

- ✓ (E02) antes do primeiro cadastro, não há vigentes nem conferência
- ✓ (E02) a conferência usa os alunos cobráveis e a próxima geração
- ✓ (E02) com a trava GERACAO\_A\_PARTIR\_DE, a conferência anuncia o primeiro mês liberado
- ✓ (E02) grava parâmetros válidos e recusa geração depois do vencimento com 400 (fluxo E1)
- ✓ (E02) aceita parâmetros válidos
- ✓ (E02) recusa geração no dia do vencimento ou depois (fluxo E1)
- ✓ (E02) dias de 1 a 28, para existirem em todo mês
- ✓ (E02) multa até 2% e juros até 1% ao mês
- ✓ (E02) valor em centavos, inteiro e positivo
- ✓ (E07) FP: a mensalidade nova sai com o valor novo, e as cobranças que já existiam ficam com o antigo
- ✓ (E07) valor-limite do dia de geração, 'um dia antes do vencimento: aceito'
- ✓ (E07) valor-limite do dia de geração, 'no dia do vencimento: recusado (E1)'
- ✓ (E07) valor-limite do dia de geração, 'depois do vencimento: recusado (E1)'

### CT-ADM-04: Chave do Asaas

- ✓ (E07) fluxo FP: a chave nova é testada no Asaas antes de ser guardada, e é guardada cifrada
- ✓ (E07) fluxo E1: quando 'a chave é recusada pelo Asaas', a chave não é salva e a vigente continua valendo
- ✓ (E07) fluxo E1: quando 'o Asaas está fora do ar', a chave não é salva e a vigente continua valendo
- ✓ (E07) fluxo E2: nenhuma resposta da API, linha da trilha ou log contém a chave \[Segurança.NF003\]

### CT-ADM-05: Trilha de auditoria

- ✓ (E07) fluxo FP: por usuário, no período padrão (mês corrente), mostra só as operações daquela pessoa
- ✓ (E07) fluxo FP: por período, o mesmo usuário mostra só o que ocorreu entre as datas, do mais recente ao mais antigo
- ✓ (E07) fluxo FP: a consulta não altera o estado do sistema
- ✓ (E07) fluxo E1: não existe rota que altere ou exclua a trilha, nem para a diretoria \[Segurança.NF006\]
- ✓ (E07) fluxo E1: o próprio banco recusa UPDATE, DELETE e TRUNCATE na trilha \[Segurança.NF006\]

### CT-SIS-01: Ponta a ponta no sandbox

Só verificação manual.

### CT-NF-01: Usabilidade nas telas

Só verificação manual.

### CT-NF-02: Falha injetada desfaz a baixa

- ✓ (E07) conciliação: o worker falha ao criar a entrada; a cobrança continua aberta e o evento continua pendente
- ✓ (E07) registro manual: a requisição falha e nada fica gravado
- ✓ (E07) sincronização: o Asaas diz que foi paga, a entrada falha e a cobrança continua aberta
- ✓ (E07) sem a falha, a mesma conciliação conclui: a falha anterior não deixou nada que impeça a nova tentativa

### CT-NF-03: Tempo de resposta do webhook

- ✓ (E07) 100 notificações seguidas: todas com 200 em menos de 5 s, gravadas e nenhuma processada

### CT-NF-04: Alerta de webhook parado

- ✓ (E07) exatamente no fim do prazo: ainda não há alerta nem e-mail
- ✓ (E07) um minuto depois do prazo: abre o alerta e avisa a diretoria por e-mail
- ✓ (E07) a próxima verificação não repete o e-mail, e o alerta fecha quando as notificações voltam

### CT-NF-05: 1.000 alunos com 429 do Asaas

- ✓ (E07) gera uma mensalidade para cada um dos 1.000 alunos, repete os 429 sem perder ninguém, em até 30 min e até 2.500 requisições

### CT-NF-06: Autenticação e bloqueio

- ✓ (E02) quatro senhas incorretas nao bloqueiam: a quinta tentativa ainda confere a senha
- ✓ (E02) bloqueia por 15 minutos depois de cinco senhas incorretas e audita a ocorrencia
- ✓ (E07) sem sessão, /api/alunos devolve 401
- ✓ (E07) sem sessão, /api/cobrancas devolve 401
- ✓ (E07) sem sessão, /api/movimentacoes devolve 401
- ✓ (E07) sem sessão, /api/indicadores/resumo devolve 401
- ✓ (E07) sem sessão, /api/admin/usuarios devolve 401
- ✓ (E07) sem sessão, /api/auth/sessao devolve 401
- ✓ (E07) com um cookie de sessão forjado também devolve 401
- ✓ (E07) a senha fica só como resumo argon2id com sal: a mesma senha gera resumos diferentes e nenhum contém a senha
- ✓ (E07) quatro senhas erradas não bloqueiam: a senha certa ainda entra e zera o contador
- ✓ (E07) cinco senhas erradas bloqueiam por 15 minutos, até a senha certa é recusada, e o bloqueio fica na trilha
- ✓ (E07) e-mail com caractere nulo é credencial inválida (401), como outra qualquer, sem contar falha nem bloquear
- ✓ (E07) a sessão de quem entrou funciona até o logout; depois dele, 401

### CT-NF-07: Funções de aptidão e ganchos

- ✓ (E02) acesso/dominio não importa infra, api, aplicacao
- ✓ (E02) acesso/api não importa infra
- ✓ (E02) acesso/aplicacao não importa api
- ✓ (E02) administracao/dominio não importa infra, api, aplicacao
- ✓ (E02) administracao/api não importa infra
- ✓ (E02) administracao/aplicacao não importa api
- ✓ (E02) cadastros/dominio não importa infra, api, aplicacao
- ✓ (E02) cadastros/api não importa infra
- ✓ (E02) cadastros/aplicacao não importa api
- ✓ (E02) cobrancas/dominio não importa infra, api, aplicacao
- ✓ (E02) cobrancas/api não importa infra
- ✓ (E02) cobrancas/aplicacao não importa api
- ✓ (E02) indicadores/dominio não importa infra, api, aplicacao
- ✓ (E02) indicadores/api não importa infra
- ✓ (E02) indicadores/aplicacao não importa api
- ✓ (E02) movimentacoes/dominio não importa infra, api, aplicacao
- ✓ (E02) movimentacoes/api não importa infra
- ✓ (E02) movimentacoes/aplicacao não importa api
- ✓ (E02) o código não chama .delete( nem .deleteMany(
- ✓ (E02) as migrações não têm DELETE FROM nem DROP TABLE
- ✓ (E02) todo módulo tem um index.ts como ponto de entrada público
- ✓ (E02) ninguém importa arquivos internos de outro módulo (só modulos/\<nome\>/index)
- ✓ (E02) compartilhado/ não depende de nenhum módulo
- ✓ (E02) não usa forwardRef (sinal de dependência circular entre módulos)
- ✓ (E02) não há ciclo de imports entre módulos
- ✓ (E02) .githooks/pre-merge-commit roda lint, testes e arquitetura e sai com erro se algo falhar
- ✓ (E02) .githooks/pre-push roda lint, testes e arquitetura e sai com erro se algo falhar
- ✓ (E02) o pnpm install liga os ganchos (script prepare aponta o core.hooksPath para .githooks)
- ✓ (E02) nenhum arquivo .env está versionado (só o .env.example)
- ✓ (E02) nenhum arquivo versionado contém o prefixo de chave do Asaas
- ✓ (E02) só o ponto central grava na trilha
- ✓ (E02) nem o ponto central altera ou apaga registros da trilha
- ✓ (E02) existe uma migração com o gatilho que recusa UPDATE, DELETE e TRUNCATE na trilha
- ✓ (E02) encontra as chamadas a registrarNaTrilha (a varredura não está cega)
- ✓ (E02) nenhuma chamada monta o detalhe com nome, e-mail, CPF, telefone ou outro campo de pessoa
- ✓ (E02) nenhuma chamada serializa um objeto inteiro com JSON.stringify
- ✓ (E02) a regra pega o jeito errado (confere a própria varredura)

### CT-FZ-01: Fuzzing do webhook

- ✓ (E07) json-truncado: JSON cortado no meio do valor do id (esperado: recusa)
- ✓ (E07) json-truncado: JSON sem a chave de fechamento (esperado: recusa)
- ✓ (E07) json-truncado: JSON cortado no meio do valor do pagamento (esperado: recusa)
- ✓ (E07) json-truncado: só a chave de abertura (esperado: recusa)
- ✓ (E07) json-truncado: vírgula sobrando depois do último campo (esperado: recusa)
- ✓ (E07) json-truncado: aspas simples no lugar de aspas duplas (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: corpo é o literal null (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: corpo é um texto JSON (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: corpo é um número (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: lista com dois eventos válidos (o Asaas manda um por vez) (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: objeto vazio (esperado: recusa)
- ✓ (E07) corpo-nao-objeto: sem corpo nenhum (esperado: recusa)
- ✓ (E07) campo-faltando: sem o campo id (esperado: recusa)
- ✓ (E07) campo-faltando: sem o campo event (esperado: recusa)
- ✓ (E07) campo-faltando: só o pagamento, sem id nem event (esperado: recusa)
- ✓ (E07) campo-faltando: id vazio (esperado: recusa)
- ✓ (E07) campo-faltando: event vazio (esperado: recusa)
- ✓ (E07) campo-faltando: evento de pagamento sem o objeto payment (aceito; o worker não tem o que baixar) (esperado: aceito)
- ✓ (E07) tipo-trocado: id numérico (esperado: recusa)
- ✓ (E07) tipo-trocado: id booleano (esperado: recusa)
- ✓ (E07) tipo-trocado: id como lista (esperado: recusa)
- ✓ (E07) tipo-trocado: id como objeto de consulta (injeção ao estilo NoSQL) (esperado: recusa)
- ✓ (E07) tipo-trocado: id nulo (esperado: recusa)
- ✓ (E07) tipo-trocado: event numérico (esperado: recusa)
- ✓ (E07) tipo-trocado: event como objeto (esperado: recusa)
- ✓ (E07) tipo-trocado: payment como texto (aceito; o worker ignora o pagamento) (esperado: aceito)
- ✓ (E07) tipo-trocado: payment.id numérico (aceito; o worker não acha cobrança) (esperado: aceito)
- ✓ (E07) tipo-trocado: valor em texto com vírgula, como na tela (aceito; o worker usa o valor da cobrança) (esperado: aceito)
- ✓ (E07) tipo-trocado: valor negativo (aceito; o worker usa o valor da cobrança) (esperado: aceito)
- ✓ (E07) valor-absurdo: valor de um trilhão de reais (esperado: aceito)
- ✓ (E07) valor-absurdo: valor de um décimo de centavo (arredonda para zero) (esperado: aceito)
- ✓ (E07) valor-absurdo: valor 1e999 (o JSON.parse vira Infinity) (esperado: aceito)
- ✓ (E07) data-inexistente: data de pagamento com mês 13 e dia 45 (esperado: aceito)
- ✓ (E07) data-inexistente: data de pagamento 30 de fevereiro (esperado: aceito)
- ✓ (E07) data-inexistente: data de pagamento escrita por extenso (esperado: aceito)
- ✓ (E07) evento-desconhecido: tipo de evento que o Asaas não tem (esperado: aceito)
- ✓ (E07) evento-desconhecido: tipo conhecido em minúsculas (esperado: aceito)
- ✓ (E07) evento-desconhecido: evento de outra área do Asaas (transferência), sem payment (esperado: aceito)
- ✓ (E07) evento-desconhecido: tipo de evento com 5000 caracteres (esperado: recusa-ou-aceito)
- ✓ (E07) evento-desconhecido: estorno de cobrança que ainda está aberta (vira pendência para conferência) (esperado: aceito)
- ✓ (E07) evento-desconhecido: remoção no painel de cobrança aberta (cancela aqui) (esperado: aceito)
- ✓ (E07) evento-desconhecido: pagamento de cobrança que não existe aqui (vira pendência) (esperado: aceito)
- ✓ (E07) id-repetido: pagamento da cobrança compartilhada, enviado três vezes seguidas (esperado: aceito)
- ✓ (E07) id-repetido: mesmo evento enviado cinco vezes ao mesmo tempo (esperado: aceito)
- ✓ (E07) id-repetido: id já recebido, agora com outro tipo de evento (fica o primeiro) (esperado: aceito)
- ✓ (E07) id-repetido: outro id pagando a mesma cobrança com outro valor (não pode criar segunda entrada) (esperado: aceito)
- ✓ (E07) id-repetido: id igual a um já recebido, só que em maiúsculas (é outro evento) (esperado: aceito)
- ✓ (E07) corpo-grande: corpo de 2 MB (acima do limite do servidor) (esperado: recusa)
- ✓ (E07) corpo-grande: corpo de 90 KB (abaixo do limite) (esperado: recusa-ou-aceito)
- ✓ (E07) corpo-grande: payment com 5000 listas aninhadas (esperado: recusa-ou-aceito)
- ✓ (E07) corpo-grande: payment com 20000 listas aninhadas (esperado: recusa-ou-aceito)
- ✓ (E07) texto-estranho: id com 6000 caracteres que não se comprimem (esperado: recusa-ou-aceito)
- ✓ (E07) texto-estranho: id com comando SQL (esperado: aceito)
- ✓ (E07) texto-estranho: id com HTML e script (esperado: aceito)
- ✓ (E07) texto-estranho: id com acento, emoji e quebra de linha (esperado: aceito)
- ✓ (E07) texto-estranho: id só com espaços (esperado: recusa-ou-aceito)
- ✓ (E07) texto-estranho: id com byte nulo no meio (esperado: recusa-ou-aceito)
- ✓ (E07) texto-estranho: byte nulo num campo do pagamento (esperado: recusa-ou-aceito)
- ✓ (E07) texto-estranho: id do pagamento com comando SQL (vira pendência com o texto literal) (esperado: aceito)
- ✓ (E07) texto-estranho: chave \_\_proto\_\_ no corpo (tentativa de poluir o protótipo) (esperado: aceito)
- ✓ (E07) texto-estranho: constructor.prototype no pagamento (tentativa de poluir o protótipo) (esperado: aceito)
- ✓ (E07) texto-estranho: chave id repetida no JSON (vale a última) (esperado: aceito)
- ✓ (E07) tipo-de-conteudo: JSON válido enviado como text/plain (esperado: recusa)
- ✓ (E07) tipo-de-conteudo: formulário (x-www-form-urlencoded) com id e event (esperado: recusa-ou-aceito)
- ✓ (E07) tipo-de-conteudo: formulário com id em forma de objeto (id\[$ne\]=) (esperado: recusa)
- ✓ (E07) tipo-de-conteudo: XML no lugar de JSON (esperado: recusa)
- ✓ (E07) token: sem o cabeçalho do token (esperado: recusa)
- ✓ (E07) token: token vazio (esperado: recusa)
- ✓ (E07) token: token sem a última letra (esperado: recusa)
- ✓ (E07) token: token com uma letra a mais (esperado: recusa)
- ✓ (E07) token: token com uma letra trocada (esperado: recusa)
- ✓ (E07) token: token todo em maiúsculas (esperado: recusa)
- ✓ (E07) token: token com só a primeira letra maiúscula (esperado: recusa)
- ✓ (E07) token: token com uma letra acentuada parecida (ó no lugar de o) (esperado: recusa)
- ✓ (E07) token: token certo com o prefixo Bearer (esperado: recusa)
- ✓ (E07) token: token certo repetido duas vezes, separado por vírgula (esperado: recusa)
- ✓ (E07) token: valor de exemplo do .env.example (esperado: recusa)
- ✓ (E07) token: token certo repetido 300 vezes (9 mil caracteres) (esperado: recusa)
- ✓ (E07) token: token certo no cabeçalho Authorization em vez de asaas-access-token (esperado: recusa)
- ✓ (E07) token: token certo na URL em vez do cabeçalho (esperado: recusa)
- ✓ (E07) token: token errado com corpo truncado (o token não pode ser ignorado por causa do erro do corpo) (esperado: recusa)
- ✓ (E07) texto-estranho: payment.id com 6000 caracteres que não se comprimem (revisão da spec \#57: virava pendência que estoura o índice e repetia para sempre) (esperado: recusa)
- ✓ (E07) texto-estranho: metade de um emoji (surrogate \\ud800 sem par) num campo do pagamento (revisão da spec \#57: o jsonb recusa e dava 500) (esperado: recusa)
- ✓ (E07) texto-estranho: surrogate \\udc00 sem par no nome de uma chave (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) nenhuma entrada poluiu o protótipo dos objetos do servidor
- ✓ (E07) depois, o worker processa os eventos aceitos › nenhuma cobrança fica paga sem a entrada, e nenhuma ganha entrada duplicada \[Confiabilidade.NF003\]
- ✓ (E07) depois, o worker processa os eventos aceitos › a data da baixa é a que o Asaas informou, ou hoje quando o aviso não traz uma data válida
- ✓ (E07) depois, o worker processa os eventos aceitos › todo evento aceito termina processado, com ou sem pendência para conferência

### CT-FZ-02: Fuzzing de formulários e filtros

- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF com 10 dígitos (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF com 12 dígitos (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF só com letras (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF com todos os dígitos iguais (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF com dígito verificador errado (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF vazio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF ausente (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: CPF como número (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: CPF nulo (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: CPF dentro de uma lista (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: CPF com injeção de SQL (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: CPF válido seguido de comando SQL (o sistema só guarda os dígitos) (esperado: recusa-ou-aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › cpf-malformado: CPF de outro aluno ativo (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail sem arroba (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail só com o domínio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail sem domínio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail sem ponto no domínio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail com espaço (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail com dois arrobas (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › email-malformado: e-mail vazio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: e-mail como número (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: e-mail com comando SQL (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: e-mail com aspas simples (válido, gravado como veio) (esperado: aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: nome vazio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: nome com duas letras (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: nome só com espaços (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-longo: nome com 121 caracteres (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-longo: nome com 50 mil caracteres (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: nome como número (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: nome como objeto (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: nome com comando SQL (gravado como veio) (esperado: aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: nome com curingas do LIKE (gravado como veio) (esperado: aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-estranho: nome com HTML e script (gravado como veio) (esperado: aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-estranho: nome com acentos e emoji (gravado como veio) (esperado: aceito)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-estranho: nome com byte nulo no meio (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: celular com letras (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: celular com três dígitos (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: celular com 15 dígitos (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › numero-invalido: matrícula negativa (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › numero-invalido: matrícula com casas decimais (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › numero-invalido: matrícula em texto (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › numero-extremo: matrícula acima do inteiro do banco (2^31) (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › numero-extremo: matrícula 1e300 (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-invalido: turma fora do formato T28 (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › sql: turma com comando SQL (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › lista-fechada: curso que não existe (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › lista-fechada: curso em minúsculas (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › lista-fechada: posto que não existe (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › tipo-trocado: alojamento como texto (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › campo-faltando: alojamento só com o bloco (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › texto-longo: bloco do alojamento com 11 caracteres (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › corpo-invalido: corpo é uma lista vazia (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › corpo-invalido: JSON truncado (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › corpo-invalido: corpo é o literal null (esperado: recusa)
- ✓ (E07) formulário: cadastro de aluno (POST /api/alunos) › campos-a-mais: campos que o formulário não tem (ativo falso, id escolhido, data de criação): ignorados (esperado: aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › campo-faltando: sem o aluno (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › id-invalido: aluno com id que não é uuid (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › sql: aluno com injeção de SQL (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › id-invalido: aluno com uuid que não existe (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › tipo-trocado: aluno como número (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › regra-de-negocio: aluno inativo (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › regra-de-negocio: aluno sem e-mail (cadastro incompleto) (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor negativo (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor zero (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor com casas decimais (fração de centavo) (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor em texto (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor em reais com vírgula, como na tela (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor nulo (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor dentro de uma lista (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › valor-invalido: valor como objeto de consulta (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › numero-extremo: valor acima do inteiro do banco (2^31 centavos) (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › numero-extremo: valor 1e21 centavos (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › numero-extremo: valor no limite do inteiro do banco (2^31 - 1) (esperado: recusa-ou-aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › numero-extremo: valor de um centavo (esperado: recusa-ou-aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-invalida: vencimento no formato brasileiro (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-invalida: vencimento sem o zero à esquerda (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-invalida: vencimento ontem (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-inexistente: vencimento em 30 de fevereiro (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-inexistente: vencimento em 31 de abril (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-inexistente: vencimento no mês 13 (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-inexistente: vencimento no mês 00 (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-invalida: vencimento com hora (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-invalida: vencimento como número (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › sql: vencimento com comando SQL (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › data-extrema: vencimento em 31/12/9999 (esperado: recusa-ou-aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-invalido: descrição vazia (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-invalido: descrição com duas letras (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-invalido: descrição só com espaços (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-longo: descrição com 201 caracteres (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › tipo-trocado: descrição como número (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › sql: descrição com comando SQL (gravada como veio) (esperado: aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › sql: descrição com curingas do LIKE (gravada como veio) (esperado: aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-estranho: descrição com HTML (gravada como veio) (esperado: aceito)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › texto-estranho: descrição com byte nulo no meio (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › id-invalido: renegociação de id que não é uuid (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › id-invalido: renegociação de cobrança que não existe (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › corpo-invalido: JSON truncado (esperado: recusa)
- ✓ (E07) formulário: cobrança avulsa (POST /api/cobrancas) › corpo-invalido: corpo é uma lista vazia (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › campo-faltando: sem a conta (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: conta com id que não é uuid (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: conta com uuid que não existe (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › sql: conta com injeção de SQL (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › lista-fechada: tipo em minúsculas (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › lista-fechada: tipo que não existe (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › campo-faltando: sem o tipo (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › valor-invalido: valor negativo (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › valor-invalido: valor zero (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › valor-invalido: valor com casas decimais (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › valor-invalido: valor em texto (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › valor-invalido: valor em reais formatado (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › numero-extremo: valor acima do inteiro do banco (2^31 centavos) (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › numero-extremo: valor 1e21 centavos (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › numero-extremo: valor no limite do inteiro do banco (2^31 - 1) (esperado: recusa-ou-aceito)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-invalida: data amanhã (movimentação registra fato ocorrido) (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-invalida: data no formato brasileiro (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-inexistente: data em 30 de fevereiro (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-inexistente: data em 31 de abril (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-inexistente: data no mês 13 (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-inexistente: data 0000-00-00 (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-invalida: data com hora (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › data-invalida: data como número (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › sql: data com injeção de SQL (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › regra-de-negocio: categoria só de entrada numa saída (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: categoria com uuid que não existe (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: categoria com id que não é uuid (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › lista-fechada: forma ASAAS (só a conciliação usa) (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › lista-fechada: forma que não existe (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › lista-fechada: forma em minúsculas (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › texto-invalido: descrição vazia (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › texto-longo: descrição com 201 caracteres (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › sql: descrição com comando SQL (gravada como veio) (esperado: aceito)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › texto-estranho: descrição com HTML (gravada como veio) (esperado: aceito)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › texto-estranho: descrição com byte nulo no meio (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › regra-de-negocio: vinculada a contrato e a projeto ao mesmo tempo (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: contrato com id que não é uuid (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › id-invalido: contrato com uuid que não existe (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › sql: funcionário com injeção de SQL (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › campos-a-mais: campos que tentam mudar a origem e o autor (ignorados: fica MANUAL) (esperado: aceito)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › corpo-invalido: JSON truncado (esperado: recusa)
- ✓ (E07) formulário: movimentação (POST /api/movimentacoes) › corpo-invalido: corpo é uma lista vazia (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: alunos: situação com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › lista-fechada: alunos: situação em maiúsculas (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › parametro-repetido: alunos: situação repetida (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › texto-invalido: alunos: situação vazia (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: aluno: id na URL com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: aluno: id na URL com comando SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › id-invalido: aluno: uuid que não existe (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: situação com comentário de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › lista-fechada: cobranças: situação em minúsculas (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › lista-fechada: cobranças: só vírgulas na situação (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca com injeção de SQL (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca com comando SQL (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca só com o curinga % do LIKE (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca só com o curinga \_ do LIKE (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca com barra invertida (escape do LIKE) (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › texto-longo: cobranças: busca com 5000 caracteres (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › byte-nulo: cobranças: busca só com o caractere nulo, ?busca=%00 (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › byte-nulo: cobranças: busca com caractere nulo no meio (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: busca com dígitos e SQL (procura também no CPF) (esperado: lista)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: aluno com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › periodo-invertido: cobranças: vencimento de dezembro até janeiro (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › data-inexistente: cobranças: vencimento a partir do mês 13, dia 45 (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-inexistente: cobranças: vencimento até o mês 00 (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-inexistente: cobranças: período de 30 de fevereiro (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › data-invalida: cobranças: vencimento por extenso (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: cobranças: vencimento com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: cobranças: valor mínimo negativo (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: cobranças: valor mínimo em texto (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: cobranças: valor máximo com casas decimais (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: cobranças: valor máximo 1e20 (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: cobranças: valor mínimo acima do inteiro do banco (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › periodo-invertido: cobranças: valor mínimo maior que o máximo (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: cobranças: página 1e20 (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: cobranças: página negativa (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: cobranças: tamanho de página em texto (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: cobranças: tamanho de página de um milhão (limitado a 200) (esperado: lista)
- ✓ (E07) consultas (GET com filtros) › lista-fechada: movimentações: mês 13 (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-invalida: movimentações: mês sem o zero (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: movimentações: mês com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-extrema: movimentações: ano 0000 (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › data-extrema: movimentações: dezembro de 9999 (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › data-extrema: indicadores: resumo do ano 0000 (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-extrema: indicadores: evolução até o ano 0000 (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-extrema: indicadores: gastos por categoria do ano 0000 (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › lista-fechada: movimentações: tipo em minúsculas (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › parametro-repetido: movimentações: tipo repetido (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: movimentações: categoria com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: movimentações: forma com comentário de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: movimentações: contrato com comando SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › id-invalido: movimentações: projeto com id que não é uuid (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › texto-invalido: movimentações: ocultarEstornos com valor estranho (vale falso) (esperado: lista)
- ✓ (E07) consultas (GET com filtros) › periodo-invertido: trilha: data inicial depois da final (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-inexistente: trilha: período no mês 13 (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-invalida: trilha: data no formato brasileiro (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › data-inexistente: trilha: 30 de fevereiro (esperado: recusa-ou-aceito)
- ✓ (E07) consultas (GET com filtros) › sql: trilha: usuário com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: trilha: operação com comando SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: trilha: tipo de registro com injeção de SQL (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › sql: trilha: registro com injeção de SQL (esperado: lista-vazia)
- ✓ (E07) consultas (GET com filtros) › texto-longo: trilha: registro com 65 caracteres (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › byte-nulo: trilha: registro com caractere nulo (revisão da spec \#57) (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › valor-invalido: trilha: página zero (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: trilha: página 10001 (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: trilha: 201 registros por página (esperado: recusa)
- ✓ (E07) consultas (GET com filtros) › numero-extremo: trilha: tamanho de página em notação científica (1e2 = 100) (esperado: lista)
- ✓ (E07) nenhuma entrada poluiu o protótipo dos objetos do servidor


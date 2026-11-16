# Roteiro das evidências visuais dos 33 casos

Na pasta `docs/testes/evidencias/2026-11-14-2dfae9b`, cada caso do Plano de Testes v1.3 é provado pela saída dos
testes automatizados (E02, E07). Só três casos têm print: CT-CAD-01 (M02), CT-SIS-01 (M01) e CT-NF-01 (M03).
Este roteiro acrescenta um print a cada caso em que isso é possível. O print pode vir da tela da homologação, do
painel do Asaas *sandbox*, do CI do GitHub ou do terminal.

Os prints **ilustram** o caso. O resultado oficial continua o do `RESULTADOS.md`; nenhum Passou ou Falhou muda
por causa deles. Se um print mostrar algo diferente do esperado, vale a Seção 8 do `roteiro-de-execucao.md`
(vira issue).

## Situação em 16/11/2026

- **Parte do Claude:** feita das 18:35 às 19:40, com 54 prints. O que cada um mostra, a URL e a hora estão no
  `registro.md` da pasta.
- **Inadimplência e gastos por categoria:** prints `CT-IND-02a` e `CT-IND-03a`, de 19:39 e 19:40.
- **Divergência:** no CT-FZ-02, a tela de movimentação gravou "-5,00" como saída de R$ 5,00, em vez de recusar.
  Defeito D10, issue #67, corrigido (detalhes no `registro.md`).
- **Sem print:** CT-ADM-01, CT-NF-02, CT-NF-03, CT-NF-05 e CT-NF-06. No Resultado de Testes, aparecem como
  "Realizado".

---

## 1. Onde e como

- **Pasta nova:** `docs/testes/evidencias/2026-11-16-4eb497b-telas/`. A pasta `2026-11-14-2dfae9b` não muda,
  porque o manifesto dela já foi publicado (o hash está na issue #66 e na capa do Resultado de Testes). Um
  arquivo a mais faria a conferência acusar `A MAIS`.
- **Código:** a homologação roda o `4eb497b` desde 16/11/2026 (app e worker). Do `2dfae9b` para o `4eb497b`
  nada mudou no código da aplicação. Para conferir:
  `git diff --name-only 2dfae9b 4eb497b -- apps/api/src apps/api/prisma apps/web packages` não lista nada. O
  print V00 registra o commit no ar.
- **Nome do arquivo:** começa pelo id do caso, como em `CT-COB-04a-cancelada.png`. Um print que serve a vários
  casos começa por `CI-` ou `V00-`.
- **Quem faz:** **C** é o Claude, pelo Claude in Chrome, e **U** é você.
- **Prints do Claude:** pegam só a área da página, sem a barra de endereço e sem o relógio do Windows. Para
  compensar, cada um ganha uma linha no `registro.md` da pasta, com a URL, a data e a hora da captura.
- **Seus prints:** `Win + Shift + S`, tela cheia, como no roteiro principal (Regra 4).
- **Só dados fictícios ([Padrões.NF001]):** os alunos de `dados-ficticios` (Ana Clara Ribeiro, Júlia Nogueira
  Prado, Carlos Eduardo Vasconcelos...) e os da carga anonimizada. Os registros novos levam "Teste Visual" no
  nome e e-mail `@exemplo.com`.
- **Dados reais do CASD:** a carga anonimizada das movimentações troca só o que identifica pessoas. Valores,
  contratos, projetos e os totais que saem deles continuam reais, e o repositório é público. Por isso, o print
  fica só com registros fictícios: recorte a tela ou cubra de preto o total, e anote o ajuste no `registro.md`.
  Isso vale para os cartões de Movimentações, a inadimplência e os gráficos do painel, os contratos e projetos da
  carga, o total de vencidas em Cobranças e o "Total previsto" dos parâmetros.
- **Formato:** os prints do Claude saem em `.jpg` (captura inteira) ou `.png` (recortado ou tarjado).
- **O Claude não digita senha nem chave.** O login, a senha inicial de usuário e a chave do Asaas ficam com
  você.

## 2. Antes de começar (U)

1. Entre no Chrome na homologação (`https://integracasd-homolog.up.railway.app`) com o usuário da diretoria e
   no sandbox do Asaas (`https://sandbox.asaas.com`). Se quiser que o Claude faça o V00, entre também na Railway.
2. Para os prints de terminal (Seção 4), rode `docker compose up -d` na raiz.

## 3. Os prints, caso a caso

A coluna "Fica só no teste" lista o que a tela não consegue mostrar. Esses itens continuam provados pelo E02 ou
pelo E07.

### Ambiente

| Arquivo | O que o print mostra | Quem | Muda dados |
|---|---|---|---|
| `V00-railway.png` | Implantações ativas do `app` e do `worker` na homologação, no commit `4eb497b` | C | não |

### Cadastros

| Caso | Arquivo | O que o print mostra | Quem | Muda dados | Fica só no teste |
|---|---|---|---|---|---|
| CT-CAD-01 | `CT-CAD-01a-cpf-repetido.png` | Novo aluno com o CPF de Ana Clara Ribeiro (526.018.159-06): recusado, com a mensagem no campo | C | não (recusado) | |
| | `CT-CAD-01b-aluno-gravado.png` | Novo aluno "Teste Visual CAD-01", com CPF fictício válido e e-mail `@exemplo.com`, já na lista | C | **sim: 1 aluno** | |
| | `CT-CAD-01c-trilha.png` | Administração › Trilha mostra a inclusão desse aluno, com o usuário e a hora | C | não | |
| | (`M02-*` da pasta 2dfae9b) | Inativar aluno com débito pede confirmação | já existe | | |
| CT-CAD-02 | `CT-CAD-02a-desligamento.png` | Novo funcionário "Teste Visual CAD-02" com desligamento hoje: aparece inativo | C | **sim: 1 funcionário** | |
| CT-CAD-03 | `CT-CAD-03a-termino-anterior.png` | Novo contrato com término antes do início: recusado, com a mensagem no campo | C | não (recusado) | |
| | `CT-CAD-03b-contratos.png` | Aba Contratos com os contratos gravados. Se a lista estiver vazia, o Claude cadastra 1 contrato fictício antes | C | só se vazia | |
| CT-CAD-04 | `CT-CAD-04a-aviso-projeto.png` | Nova movimentação ligada a um projeto encerrado: o formulário mostra o aviso e deixa registrar. O print é tirado antes de salvar. Se não houver projeto encerrado, o Claude cadastra 1 projeto fictício executado | C | só se não houver projeto | a gravação (D1) |

### Cobranças

| Caso | Arquivo | O que o print mostra | Quem | Muda dados | Fica só no teste |
|---|---|---|---|---|---|
| CT-COB-01 | `CT-COB-01a-parametros.png` | Administração › Parâmetros: dia da geração, vencimento e valor | C | não | rodar de novo não duplica |
| | `CT-COB-01b-pendencias.png` | Cobranças › Pendências: alunos que ficaram fora da geração por falta de e-mail, se a geração já rodou na homologação. Se não rodou, vale a resposta de `GET /api/cobrancas/geracao-recorrente/execucoes` aberta no navegador | C | não | |
| CT-COB-02 | (`M01a-emitida.png` da pasta 2dfae9b) | R1: cobrança válida criada no Asaas e gravada | já existe | | |
| | `CT-COB-02a-vencimento-passado.png` | Nova cobrança com vencimento ontem: recusada (R4) | C | não (recusado) | R5: Asaas fora do ar |
| | `CT-COB-02b-cpf-invalido.png` | Nova cobrança para um aluno da carga com CPF inválido: recusada, apontando o campo (R3) | C | não (recusado) | |
| | `CT-COB-02c-aluno-inativo.png` | Aluno inativo não pode receber cobrança (R2) | C | não | |
| CT-COB-03 | `CT-COB-03a-boleto.png` | Cobrança Aberta de Júlia ("Teste M02", R$ 50,00): Abrir o boleto mostra o boleto do sandbox | C | registra a obtenção no histórico | |
| | `CT-COB-03b-historico.png` | O histórico da cobrança com a obtenção do boleto | C | não | |
| | `CT-COB-03c-paga-sem-boleto.png` | Cobrança Paga ("Teste M01"): não oferece boleto nem cancelamento (vale também para o CT-COB-04) | C | não | |
| CT-COB-04 | `CT-COB-04a-cancelada.png` | Cancelar "Teste M03 cancelar" (Carlos Eduardo, R$ 1.000,00) com motivo: a cobrança fica Cancelada | C | **sim: cancela 1 cobrança aqui e no sandbox** | E2: o Asaas recusa e nada muda |
| | `CT-COB-04b-sandbox.png` | A mesma cobrança no sandbox, cancelada | C | não | |
| CT-COB-05 | `CT-COB-05a-webhooks-sandbox.png` | Sandbox › Integrações › Webhooks: as notificações enviadas à homologação com resposta 200, inclusive a do M01 | C | não | notificação repetida não duplica; o 401 está no `H03` (texto) |
| | (`M01c-paga.png` da pasta 2dfae9b) | A baixa acontece sem ninguém clicar | já existe | | |
| CT-COB-06 | `CT-COB-06a-sem-justificativa.png` | Registrar pagamento manual da cobrança de Júlia sem justificativa: recusado | C | não (recusado) | |
| | `CT-COB-06b-paga-manual.png` | Com justificativa, a cobrança fica "Paga com registro manual" | C | **sim: 1 pagamento manual** | |
| | `CT-COB-06c-entrada.png` | Movimentações mostra a entrada criada | C | não | |
| CT-COB-07 | `CT-COB-07a-sincronizacao.png` | Cobranças › Sincronizar com o Asaas: o resultado (consultadas, atualizadas, entradas criadas) | C | **sim: adota a situação do Asaas** | criar a entrada que falta |
| | `CT-COB-07b-manual-mantido.png` | Depois da sincronização, a cobrança de Júlia continua "Paga com registro manual" | C | não | |
| CT-COB-08 | `CT-COB-08a-padrao.png` | Cobranças sem filtro: só abertas e vencidas, por vencimento | C | não | |
| | `CT-COB-08b-filtros.png` | Filtros por aluno, situação e período | C | não | |

Ordem: o CT-COB-03 vem antes do CT-COB-06 (as duas usam a cobrança de Júlia), e o CT-COB-07 vem depois do
CT-COB-06.

### Movimentações

| Caso | Arquivo | O que o print mostra | Quem | Muda dados | Fica só no teste |
|---|---|---|---|---|---|
| CT-MOV-01 | `CT-MOV-01a-data-amanha.png` | Nova movimentação com data de amanhã: recusada | C | não (recusado) | |
| | `CT-MOV-01b-valor-zero.png` | Valor R$ 0,00: recusado | C | não (recusado) | |
| | (`M03-lancar-movimentacao.png` da pasta 2dfae9b) | Movimentação válida | já existe | | |
| CT-MOV-02 | `CT-MOV-02a-estorno.png` | Estornar "Teste M03" (+R$ 400,00) com motivo: a original fica com o selo Estornada e aparece a saída de R$ 400,00 | C | **sim: 1 estorno** | |
| | `CT-MOV-02b-origem-cobranca.png` | A entrada do M01 (conciliação automática) não oferece estorno | C | não | |
| CT-MOV-03 | `CT-MOV-03a-filtros.png` | Movimentações de um mês e de uma categoria, com os totais de entrada, saída e resultado | C | não | |

### Indicadores

| Caso | Arquivo | O que o print mostra | Quem | Muda dados |
|---|---|---|---|---|
| CT-IND-01 | `CT-IND-01a-painel.png` | Painel de um mês com movimentação: entradas, saídas e resultado | C | não |
| | `CT-IND-01b-mes-vazio.png` | Um mês sem movimentação: tudo zero | C | não |
| CT-IND-02 | `CT-IND-02a-inadimplencia.png` | Bloco de inadimplência: alunos, valor em aberto e faixas de atraso | C | não |
| CT-IND-03 | `CT-IND-03a-gastos.png` | Um mês com saídas (da carga das movimentações): gastos por categoria com valor e percentual, comparados com o mês anterior | C | não |

Os limites de 30, 31, 60 e 61 dias ficam só no teste. Os testes de unidade destes casos aparecem também no
print `CI-unidade.png`.

### Administração

| Caso | Arquivo | O que o print mostra | Quem | Muda dados | Fica só no teste |
|---|---|---|---|---|---|
| CT-ADM-01 | `CT-ADM-01a-novo-usuario.png` | Usuários › novo usuário "Administrativo Teste" (`administrativo.teste@exemplo.com`), perfil Administrativo. Você digita a senha inicial. Também serve reativar o "Usuario de Teste" (`usuarioteste@exemplo.com`, administrativo, hoje inativo) com uma senha nova. A lista de usuários mostra o seu e-mail pessoal: recorte ou tarje antes de salvar | U | **sim: 1 usuário** | |
| | `CT-ADM-01b-sem-administracao.png` | Logado como ele, numa janela anônima: o menu não tem Administração, e `/administracao` mostra que não há permissão | U | não | 403 nas 9 rotas; inativar o último diretor |
| CT-ADM-02 | `CT-ADM-02a-nome-repetido.png` | Nova categoria com o nome de uma categoria ativa: recusada | C | não (recusado) | |
| CT-ADM-03 | `CT-ADM-03a-dia-invalido.png` | Parâmetros com o dia da geração depois do vencimento: recusado. O print também mostra o aviso de que os parâmetros valem só para as próximas cobranças | C | não (recusado) | |
| CT-ADM-04 | `CT-ADM-04a-chave-oculta.png` | Integração Asaas: a chave nunca aparece; a tela mostra só quando e por quem ela foi cadastrada | C | não | |
| | `CT-ADM-04b-chave-invalida.png` | Substituir chave por uma chave inválida inventada, com 20 caracteres ou mais: recusada, e a chave vigente continua | U | não (recusado) | |
| | `CT-ADM-04c-api-sem-chave.png` | `GET /api/admin/integracao-asaas` aberto no navegador: a resposta não contém a chave | C | não | |
| CT-ADM-05 | `CT-ADM-05a-filtros.png` | Trilha filtrada por período e usuário, sem botão de editar nem de excluir | C | não | nenhuma rota altera a trilha |

Não tente inativar o último diretor na homologação. Se a regra falhasse, a diretoria ficaria sem acesso. Esse
cenário fica só no teste.

### Ponta a ponta, não funcionais e fuzzing

| Caso | Arquivo | O que o print mostra | Quem | Muda dados |
|---|---|---|---|---|
| CT-SIS-01 | (`M01a` a `M01e` da pasta 2dfae9b) | Já existe | | |
| CT-NF-01 | (`M03-*` da pasta 2dfae9b) | Já existe | | |
| CT-NF-02 | `CT-NF-02-terminal.png` | Os 4 testes da falha injetada passando (Seção 4) | U | não |
| CT-NF-03 | `CT-NF-03-terminal.png` | `pnpm medir:webhook -- --alvo homologacao`: 100 respostas, com o p95 e "Resultado: PASSOU" | U | não |
| CT-NF-04 | `CT-NF-04a-prazo.png` | Integração Asaas: o prazo do alerta de webhook parado | C | não |
| | `CT-NF-04b-trilha.png` | Trilha filtrada por "Alerta de webhook parado", se o alerta já disparou na homologação | C | não |
| | `CT-NF-04c-terminal.png` | Os 3 testes passando | U | não |
| CT-NF-05 | `CT-NF-05-terminal.png` | Geração para 1.000 alunos com 429: o teste passando | U | não |
| CT-NF-06 | `CT-NF-06a-senha-errada.png` | Login do "Administrativo Teste" com senha errada: mensagem de erro | U | não |
| | `CT-NF-06b-bloqueado.png` | Depois da 5ª senha errada: acesso bloqueado | U | bloqueia o usuário de teste por 15 min |
| | `CT-NF-06c-trilha.png` | Trilha com o "Bloqueio de acesso" desse usuário | C | não |
| | `CT-NF-06d-sem-sessao.png` | Janela anônima: `/api/cobrancas` responde 401 | U | não |
| CT-NF-07 | `CI-unidade.png` | CI do GitHub no commit `2dfae9b` (execução 43592468731): lint, testes de unidade e de arquitetura verdes | C | não |
| | `CT-NF-07a-ci-arquitetura.png` | O log do CI com os arquivos de `test/arquitetura` passando | C | não |
| CT-FZ-01 | `CT-FZ-01a-terminal.png` | Os 88 testes do fuzzing do webhook passando | U | não |
| | `CT-FZ-01b-entradas.png` | GitHub: a pasta `test/sistema/fuzzing/entradas` com as entradas geradas pelo LLM | C | não |
| CT-FZ-02 | `CT-FZ-02a-cpf-email.png` | Novo aluno com CPF e e-mail malformados: recusa apontando os dois campos | C | não (recusado) |
| | `CT-FZ-02b-valor-negativo.png` | Nova movimentação com valor negativo: recusada | C | não (recusado) |
| | `CT-FZ-02c-busca-sql.png` | Busca de cobranças com `' OR 1=1 --` e com `%`: lista vazia, sem erro (D9) | C | não |
| | `CT-FZ-02e-terminal.png` | Os 206 testes passando | U | não |

O CT-NF-06 usa o usuário criado no CT-ADM-01. Assim, o bloqueio nunca atinge a sua conta.

## 4. Prints de terminal (U)

Abra o PowerShell maximizado na raiz do repositório, no commit `4eb497b`. Os arquivos de teste destes casos são
iguais aos do `2dfae9b`. Antes de cada comando, rode o cabeçalho, para o print mostrar o commit e a hora:

```powershell
git log -1 --format="commit %h  %s"; Get-Date
```

| Arquivo | Comando |
|---|---|
| `CT-NF-02-terminal.png` | `pnpm --filter api exec vitest run --config vitest.integracao.config.ts --reporter=verbose test/integracao/nao-funcionais/ct-nf-02-falha-injetada.spec.ts` |
| `CT-NF-03-terminal.png` | `pnpm medir:webhook -- --alvo homologacao` (precisa do `.env.homologacao`) |
| `CT-NF-04c-terminal.png` | `pnpm --filter api exec vitest run --config vitest.integracao.config.ts --reporter=verbose test/integracao/nao-funcionais/ct-nf-04-alerta-de-webhook-parado.spec.ts` |
| `CT-NF-05-terminal.png` | `pnpm --filter api exec vitest run --config vitest.integracao.config.ts --reporter=verbose test/integracao/nao-funcionais/ct-nf-05-geracao-de-1000-alunos.spec.ts` |
| `CT-FZ-01a-terminal.png` | `pnpm --filter api exec vitest run --config vitest.integracao.config.ts test/sistema/fuzzing/ct-fz-01-webhook.spec.ts` |
| `CT-FZ-02e-terminal.png` | `pnpm --filter api exec vitest run --config vitest.integracao.config.ts test/sistema/fuzzing/ct-fz-02-formularios-e-filtros.spec.ts` |

Os dois de fuzzing ficam sem `--reporter=verbose`, porque 88 e 206 linhas não cabem na tela. Nesses, o print
mostra o resumo com o número de testes. Se a saída não couber, tire dois prints (`...-1.png`, `...-2.png`).

## 5. O que muda na homologação e no sandbox

Tudo com dados fictícios:

- 1 aluno ("Teste Visual CAD-01") e 1 funcionário ("Teste Visual CAD-02") novos.
- 1 contrato e 1 projeto fictícios, mas só se não houver nenhum para o print.
- A cobrança "Teste M03 cancelar" (Carlos Eduardo) é cancelada aqui e no sandbox.
- A cobrança "Teste M02" (Júlia) recebe o registro da obtenção do boleto e depois um pagamento manual. Isso
  cria uma entrada de R$ 50,00.
- Uma sincronização com o Asaas.
- A movimentação "Teste M03" (+R$ 400,00) é estornada.
- 1 usuário "Administrativo Teste" (U), que fica bloqueado por 15 minutos depois das 5 senhas erradas.
- Vários envios que **devem ser recusados** (CPF repetido, datas e valores inválidos, nome repetido, chave
  inválida). Se algum for aceito, é defeito: anote e abra issue.

Nada é gerado em massa: o "Gerar pendentes agora" **não** é usado, porque criaria cobranças no sandbox para
centenas de alunos da carga.

## 6. Fechar

1. O `registro.md` da pasta tem uma linha por print: arquivo, caso, o que mostra, URL, data e hora, quem
   capturou e se deu o esperado. O Claude preenche as linhas dele; você acrescenta as suas.
2. Confira que nenhum print mostra dado real, token ou chave (o Claude confere os dele antes de salvar).
3. Grave o manifesto (Git Bash):
   `cd docs/testes/evidencias/2026-11-16-4eb497b-telas; sha256sum *.png *.jpg registro.md > MANIFESTO-sha256.txt`.
4. Branch `docs/evidencias-visuais`, commit, `git merge --no-ff`, `git push`, `git branch -d`.
5. Se quiser, os prints entram depois no Resultado de Testes (v1.3) e na apresentação.

Tempo estimado: a parte do Claude leva de 1h30 a 2h; a sua, uns 40 minutos (10 no CT-ADM-01 e no CT-NF-06, 2
no CT-ADM-04 e o resto nos prints de terminal).

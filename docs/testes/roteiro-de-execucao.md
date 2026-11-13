# Roteiro de execução do Plano de Testes v1.1

Este roteiro diz **como** executar os 33 casos do `IntegraCASD_PlanoDeTestes_v1.1.pdf` e **que evidência**
guardar de cada um, para o relatório final em PDF poder ser auditado. Qualquer pessoa deve conseguir pegar
o relatório, achar a evidência de cada caso e repetir a execução no mesmo commit.

A versão 1.1 do plano corrige a 1.0: a Seção 5.2 anunciava 8 casos não funcionais, mas listava 7 (o
CT-NF-08, citado só no Apêndice A, nunca foi definido). O total passou de 34 para 33 casos.

---

## 0. Regras que tornam o relatório auditável

1. **Um commit só.** Todos os testes rodam sobre o mesmo commit, e o hash dele vai na capa do PDF.
   Se alguém fizer merge na `main` no meio da execução, recomece no commit novo.
2. **Toda evidência é um arquivo** em `docs/testes/evidencias/`, com nome `<ID>-<descricao>.<ext>`
   (ex.: `E02-unidade.json`, `H01-medir-webhook.txt`, `M01-cobranca-paga.png`). O ID é o que vai na coluna
   "Evidência" da planilha.
3. **Saída de comando é salva em arquivo, não só em print.** O texto mostra o comando, o resultado e o código
   de saída. Print serve para o que só existe na tela.
4. **Print de tela mostra a barra de endereço e o relógio do Windows** (`Win + Shift + S`, tela cheia).
5. **Só dados fictícios** ([Padrões.NF001]). A homologação usa dados fictícios. Nenhum print, saída ou dump com
   dado real de aluno entra nas evidências.
6. **No fim, um manifesto SHA-256** de todas as evidências entra no PDF (Seção 9). Prova que nenhum arquivo
   foi trocado depois.
7. **Resultado com três valores (Seção 6.2 do plano):**
   - **Passou:** cada item do "Cenário e resultado esperado" tem evidência de que deu o esperado.
   - **Falhou:** algum item foi executado e o resultado foi diferente do esperado.
   - **Bloqueado:** algum item não pôde ser executado.

   Todo Falhou ou Bloqueado vira *issue* no GitHub, citando o caso e o requisito (Seção 8).

### Colunas da planilha

| Caso | Requisito | Data e hora | Responsável | Commit | Resultado | Evidência (IDs) | Observação | Issue |
|---|---|---|---|---|---|---|---|---|

---

## 1. Preparação (≈10 min)

PowerShell, na raiz do repositório:

```powershell
git switch main
git pull
git status            # nada modificado
$ev = "docs\testes\evidencias"
New-Item -ItemType Directory -Force $ev | Out-Null

# E00: o que foi testado e com quê
git log -1 --format="commit %H%nautor  %an%ndata   %ci%nassunto %s" | Out-File -Encoding utf8 "$ev\E00-ambiente.txt"
"node $(node -v)"     | Out-File -Encoding utf8 -Append "$ev\E00-ambiente.txt"
"pnpm $(pnpm -v)"     | Out-File -Encoding utf8 -Append "$ev\E00-ambiente.txt"
docker version --format "docker {{.Server.Version}}" | Out-File -Encoding utf8 -Append "$ev\E00-ambiente.txt"
Get-Content "$ev\E00-ambiente.txt"

pnpm install --frozen-lockfile
```

---

## 2. Fase 1: unidade e funções de aptidão (≈10 min)

São os testes que também rodam nos ganchos do git e no CI.

```powershell
# E01: lint
pnpm lint | Tee-Object -FilePath "$ev\E01-lint.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E01-lint.txt" -Append

# E02: testes de unidade e de arquitetura, com o nome de cada teste (txt) e em formato de máquina (json)
pnpm --filter api exec vitest run --reporter=verbose --reporter=json "--outputFile.json=$PWD\$ev\E02-unidade.json" | Tee-Object -FilePath "$ev\E02-unidade.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E02-unidade.txt" -Append

# E03: cobertura (caixa branca, Seção 3.2 do plano)
pnpm cobertura | Tee-Object -FilePath "$ev\E03-cobertura.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E03-cobertura.txt" -Append
start apps\api\coverage\index.html     # no navegador: Ctrl+P → Salvar como PDF → E03-cobertura.pdf

# E04: migrações imutáveis e cores
pnpm verificar:arquitetura | Tee-Object -FilePath "$ev\E04-arquitetura.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E04-arquitetura.txt" -Append

# E05: build, orçamento do bundle, dados fictícios no bundle e contrato OpenAPI × cliente
pnpm build | Out-Null
pnpm verificar:build | Tee-Object -FilePath "$ev\E05-build-e-contrato.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E05-build-e-contrato.txt" -Append
pnpm verificar:contrato | Tee-Object -FilePath "$ev\E05-build-e-contrato.txt" -Append
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E05-build-e-contrato.txt" -Append
git status --short     # nada em packages/api-client pode ter mudado
```

**E06: CI.** A execução do CI tem de ser do mesmo commit do E00:

```powershell
gh run list --workflow CI --branch main --limit 3
gh run view <id> --json headSha,conclusion,url,createdAt | Out-File -Encoding utf8 "$ev\E06-ci.json"
gh run view <id> --log | Out-File -Encoding utf8 "$ev\E06-ci-log.txt"
```

Abra o link, expanda o job "Lint, testes e build" e salve a página em PDF (`E06-ci.pdf`): o GitHub apaga os
logs depois de 90 dias.

**Conferir:** todos os códigos de saída são `0`. O `E02-unidade.txt` termina com `Test Files 72 passed` e
`Tests 474 passed` (ou mais).

---

## 3. Fase 2: integração e sistema automatizados, com banco real (≈10 min)

Precisam do PostgreSQL e por isso **não** rodam no CI nem nos ganchos. O banco `integracasd_integracao` é
apagado e recriado a cada execução; o seu banco de desenvolvimento não é tocado.

```powershell
docker compose up -d
# E07: integração e sistema (o CT-NF-05 sozinho leva uns 6 minutos: ritmo real de produção para 1.000 alunos)
pnpm --filter api exec vitest run --config vitest.integracao.config.ts --reporter=verbose --reporter=json "--outputFile.json=$PWD\$ev\E07-integracao.json" | Tee-Object -FilePath "$ev\E07-integracao.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\E07-integracao.txt" -Append
```

O `E07-integracao.txt` mostra o nome de cada teste (com o caso, ex.: `CT-COB-05`) e os números medidos:

- **CT-NF-03:** `respostas 200: 100 de 100` e `mínimo | média | p95 | máximo`;
- **CT-NF-05:** `criadas 1000 | falhas 0`, `requisições ao Asaas N (limite 2500)`, `respostas 429` e `duração`.

**Não defina `PULAR_CT_NF_05`** na execução que vale como evidência.

Resultado conhecido, enquanto os defeitos da Seção 8 não forem corrigidos: **34 testes falham**, todos por
defeito da aplicação, nunca por erro do teste. São 1 do CT-CAD-04 (D1) e 33 do fuzzing (D4 a D9). O código de
saída será `1`. Isso **é** a evidência do Falhou desses casos: o nome de cada teste que falha diz a entrada
e o que se esperava.

---

## 4. Mapa caso → evidência

Caminhos relativos a `apps/api/`. O nome do teste começa (ou termina) com o requisito e o caso, então dá para
achar cada um no `E02-unidade.txt` ou no `E07-integracao.txt` buscando o ID do caso.

### Requisitos funcionais

| Caso | Nível | Arquivo de teste | Evidência | Observação |
|---|---|---|---|---|
| CT-CAD-01 | I | `test/integracao/cadastros/ct-cad-01-aluno.spec.ts` | E07 + M02 | A API passa; a confirmação é só da tela (M02). **Provável Falhou: D3** |
| CT-CAD-02 | I | `test/integracao/cadastros/ct-cad-02-funcionario.spec.ts` | E07 | Limites ontem/hoje/amanhã |
| CT-CAD-03 | U | `src/modulos/cadastros/dominio/contrato.spec.ts` | E02 | |
| CT-CAD-04 | I | `test/integracao/cadastros/ct-cad-04-projeto.spec.ts` | E07 | **Falhou: defeito D1** |
| CT-COB-01 | I | `test/integracao/cobrancas/ct-cob-01-geracao-recorrente.spec.ts` | E07 | |
| CT-COB-02 | I | `test/integracao/cobrancas/ct-cob-02-emissao-avulsa.spec.ts` | E07 | Tabela de decisão R1 a R5 |
| CT-COB-03 | I | `test/integracao/cobrancas/ct-cob-03-boleto.spec.ts` | E07 | **Falhou no "reenviar": defeito D2** |
| CT-COB-04 | I | `test/integracao/cobrancas/ct-cob-04-cancelamento.spec.ts` | E07 | |
| CT-COB-05 | S | `test/sistema/cobrancas/ct-cob-05-webhook.spec.ts` | E07 + H03 | |
| CT-COB-06 | I | `test/integracao/cobrancas/ct-cob-06-pagamento-manual.spec.ts` | E07 | |
| CT-COB-07 | I | `test/integracao/cobrancas/ct-cob-07-sincronizacao.spec.ts` | E07 | |
| CT-COB-08 | S | `test/sistema/cobrancas/ct-cob-08-consulta.spec.ts` | E07 | |
| CT-MOV-01 | I | `test/integracao/movimentacoes/ct-mov-01-registro.spec.ts` | E07 | |
| CT-MOV-02 | I | `test/integracao/movimentacoes/ct-mov-02-estorno.spec.ts` | E07 | |
| CT-MOV-03 | S | `test/sistema/movimentacoes/ct-mov-03-consulta.spec.ts` | E07 | O período é o mês (`?mes=AAAA-MM`), como na tela |
| CT-IND-01 | U | `src/modulos/indicadores/aplicacao/consultar-painel.spec.ts` | E02 | |
| CT-IND-02 | U | `src/modulos/indicadores/dominio/inadimplencia.spec.ts` | E02 | 30, 31, 60 e 61 dias |
| CT-IND-03 | U | `src/modulos/indicadores/dominio/gastos-por-categoria.spec.ts` | E02 | Fluxo A2 no Apêndice A do plano |
| CT-ADM-01 | S | `test/sistema/administracao/ct-adm-01-usuarios.spec.ts` | E07 | 403 em 9 rotas de Administração |
| CT-ADM-02 | U | `src/modulos/administracao/aplicacao/categorias.spec.ts` | E02 | |
| CT-ADM-03 | U | `src/modulos/administracao/dominio/parametros-de-cobranca.spec.ts` e `test/integracao/administracao/ct-adm-03-parametros.spec.ts` | E02 + E07 | "Valem só para as futuras" está no de integração |
| CT-ADM-04 | I | `test/integracao/administracao/ct-adm-04-chave-asaas.spec.ts` | E07 | |
| CT-ADM-05 | S | `test/sistema/administracao/ct-adm-05-trilha.spec.ts` | E07 | |
| CT-SIS-01 | S | manual | M01 | Na homologação, com o sandbox |

### Requisitos não funcionais e fuzzing

| Caso | Nível | Arquivo de teste | Evidência | Observação |
|---|---|---|---|---|
| CT-NF-01 | S | manual | M03 | |
| CT-NF-02 | I | `test/integracao/nao-funcionais/ct-nf-02-falha-injetada.spec.ts` | E07 | Falha injetada por gatilho no PostgreSQL |
| CT-NF-03 | S | `test/sistema/nao-funcionais/ct-nf-03-tempo-de-resposta-do-webhook.spec.ts` e `scripts/testes/medir-webhook.mjs` | E07 + H01 | Local e na Railway |
| CT-NF-04 | I | `test/integracao/nao-funcionais/ct-nf-04-alerta-de-webhook-parado.spec.ts` | E07 | |
| CT-NF-05 | I | `test/integracao/nao-funcionais/ct-nf-05-geracao-de-1000-alunos.spec.ts` | E07 | |
| CT-NF-06 | I | `test/integracao/nao-funcionais/ct-nf-06-autenticacao-e-bloqueio.spec.ts` e `src/modulos/acesso/aplicacao/autenticar.spec.ts` | E02 + E07 | |
| CT-NF-07 | U | `test/arquitetura/*.spec.ts` (B1, B2, B6, B11, B13, B14, G7) e `pnpm verificar:arquitetura` | E02 + E04 + I02 | |
| CT-FZ-01 | S | `test/sistema/fuzzing/ct-fz-01-webhook.spec.ts` | E07 | 81 entradas em `test/sistema/fuzzing/entradas/`. **Falhou: D4 a D8** |
| CT-FZ-02 | S | `test/sistema/fuzzing/ct-fz-02-formularios-e-filtros.spec.ts` | E07 | 199 entradas. **Falhou: D4, D5, D6 e D9** |

---

## 5. Fase 3: homologação na Railway (≈1 h)

Antes, confira (playbook `docs/playbooks/implantacao.md`, itens 3.3 e 3.4): chave do sandbox cadastrada em
Administração › Integração Asaas, webhook do sandbox apontando para `https://<homologação>/api/webhooks/asaas`
com o token da homologação, e **o worker ligado** na Railway (sem ele a baixa não acontece).

Crie na raiz o arquivo `.env.homologacao` (o `.gitignore` já ignora `.env.*`):

```
HOMOLOGACAO_URL=https://<endereço da homologação>
ASAAS_WEBHOOK_TOKEN=<token do webhook da homologação>
```

### H01: tempo de resposta do webhook na Railway (CT-NF-03)

```powershell
pnpm medir:webhook -- --alvo homologacao | Tee-Object -FilePath "$ev\H01-medir-webhook.txt"
"código de saída: $LASTEXITCODE" | Tee-Object -FilePath "$ev\H01-medir-webhook.txt" -Append
```

O script mostra o aquecimento (a homologação dorme quando ninguém usa; a primeira resposta não entra na conta)
e, para 100 notificações seguidas: respostas 200, mínimo, média, p95, máximo e `Resultado: PASSOU`.
As notificações são `PAYMENT_UPDATED` sem cobrança, com id `evt_medicao_...`: o worker as marca como
processadas sem efeito.

### H02: segurança do ambiente (itens 3.5.2 a 3.5.8 do playbook)

```powershell
$h = "https://<endereço da homologação>"
"GET /api/docs (tem de ser 404): " + (curl.exe -s -o NUL -w "%{http_code}" "$h/api/docs") | Tee-Object -FilePath "$ev\H02-seguranca.txt"
"GET /cobrancas direto (tem de ser 200): " + (curl.exe -s -o NUL -w "%{http_code}" "$h/cobrancas") | Tee-Object -FilePath "$ev\H02-seguranca.txt" -Append
curl.exe -sI "$h/" | Tee-Object -FilePath "$ev\H02-seguranca.txt" -Append        # cabeçalhos: HSTS, CSP...
docker run --rm alpine/openssl:3.5.4 s_client -connect <endereço sem https://>:443 -tls1_2 -brief 2>&1 | Tee-Object -FilePath "$ev\H02-tls.txt"
docker run --rm alpine/openssl:3.5.4 s_client -connect <endereço sem https://>:443 -tls1_1 -cipher 'DEFAULT@SECLEVEL=0' -brief 2>&1 | Tee-Object -FilePath "$ev\H02-tls.txt" -Append
```

Esperado: `/api/docs` com 404; TLS 1.2 conecta (`Protocol version: TLSv1.2`); TLS 1.1 é recusado pelo servidor
(`alert protocol version` ou `handshake failure`, [Segurança.NF004]). No navegador, depois de entrar: F12 ›
Application › Cookies › `integracasd_sessao` com **Secure**, **HttpOnly** e **SameSite Strict** (`H02-cookie.png`)
e o console sem erro de CSP (`H02-console.png`).

### H03: webhook com token errado na Railway (CT-COB-05, [Segurança.NF002])

```powershell
"token errado (tem de ser 401): " + (curl.exe -s -o NUL -w "%{http_code}" -X POST "$h/api/webhooks/asaas" -H "asaas-access-token: errado" -H "content-type: application/json" -d "{}") | Tee-Object -FilePath "$ev\H03-webhook-401.txt"
```

---

## 6. Fase 4: roteiros manuais nas telas da homologação (≈1 h)

Para cada passo: print de tela inteira com a URL e o relógio visíveis.

### M01: ponta a ponta com o Asaas sandbox (CT-SIS-01)

a. Emita uma cobrança avulsa para um aluno fictício com e-mail, vencimento hoje (`M01a-emitida.png`).
b. No painel do sandbox, ache a cobrança e confirme o pagamento (`M01b-sandbox-pago.png`).
c. Espere o webhook (segundos). No IntegraCASD a cobrança fica **Paga**, sem clicar em nada (`M01c-paga.png`).
   Se não ficar, o worker está desligado ou o webhook do sandbox não está configurado: é Bloqueado.
d. Em Movimentações aparece a entrada daquela cobrança (`M01d-entrada.png`); o painel de Indicadores mostra a
   entrada no mês (`M01e-painel.png`).

### M02: inativar aluno com débito (CT-CAD-01, fluxo E2)

Com um aluno fictício que tenha cobrança **vencida**: inativar mostra o débito e pede confirmação
(`M02-confirmacao-vencida.png`). Depois, com um aluno que tenha só cobrança **aberta, ainda não vencida**: anote
se o aviso de débito aparece (`M02-confirmacao-aberta.png`). Pelo agente que revisou o código, hoje ele **não**
aparece nesse caso (defeito D3). Confirme na tela.

### M03: usabilidade (CT-NF-01)

| Tarefa | Limite | Evidência |
|---|---|---|
| Localizar um aluno | 3 interações | `M03-localizar-aluno.png` + nº de interações |
| Lançar uma movimentação | 3 | `M03-lancar-movimentacao.png` |
| Emitir cobrança avulsa | 3 | `M03-emitir-cobranca.png` |
| Estornar movimentação: mostra resumo e pede confirmação | — | `M03-confirma-estorno.png` |
| Cancelar cobrança: mostra resumo e pede confirmação | — | `M03-confirma-cancelamento.png` |
| Situações aparecem como selo com texto (não só cor) | — | `M03-selos.png` |
| Cada gráfico do painel tem tabela equivalente | — | `M03-graficos-tabela.png` |

Gravar a tela (`Win + Alt + R`) também vale como evidência.

---

## 7. Fase 5: inspeção (≈30 min)

### I01: backup e restauração ([Confiabilidade.NF006])

Siga `docs/playbooks/backup-e-restauracao.md` (`.\scripts\backup\fazer-backup.ps1` e
`.\scripts\backup\restaurar-backup.ps1 -Arquivo <dump>`). Guarde só a saída dos scripts (`I01-backup.txt`,
`I01-restauracao.txt`). **O `.dump` não entra nas evidências.**

### I02: o gancho barra merge com teste falhando (CT-NF-07)

O G7 (`test/arquitetura/ganchos.spec.ts`) confere o gancho no E02. A demonstração de ponta a ponta:

```powershell
git switch -c teste/gancho-bloqueia
# quebre de propósito um expect em apps/api/src/compartilhado/datas.spec.ts
git commit -am "teste: quebra proposital para demonstrar o gancho"
git switch main
git merge --no-ff teste/gancho-bloqueia 2>&1 | Tee-Object -FilePath "$ev\I02-gancho.txt"
git merge --abort
git branch -D teste/gancho-bloqueia
git status       # tem de estar como antes
```

Esperado: o `pre-merge-commit` roda os testes, um falha e o merge **não** acontece. Nunca use `--no-verify`.

---

## 8. Defeitos encontrados na preparação (viram issue)

| Id | Caso | O que acontece | Onde | Severidade |
|---|---|---|---|---|
| D1 | CT-CAD-04 ([Cadastros.RF005] E1, [Movimentações.RF001] A2) | Movimentação num projeto **cancelado** é aceita sem aviso. O sistema considera cancelado como "encerrado" (`GET /api/projetos` responde `encerrado: true`), mas o aviso só sai para EXECUTADO | `apps/api/src/modulos/movimentacoes/infra/movimentacoes.repositorio.ts:162` | Baixa: a tela não oferece projeto cancelado, mas a API aceita |
| D2 | CT-COB-03 ([Cobranças.RF003] passo 3 e A2) | "Reenviar boleto por e-mail" não existe: o backend só tem "baixar"; o botão da tela está desabilitado | `cobrancas.controller.ts:164-171`; issue #29 já aberta (a API v3 do Asaas não reenvia) | Requisito importante: precisa de decisão da equipe |
| D3 | CT-CAD-01 ([Cadastros.RF001] E2) | O diálogo de inativação só mostra o débito quando há cobrança **vencida**; o caso de uso fala em "Aberta ou Vencida" | `apps/web/src/features/cadastro/DialogoInativarAluno.tsx:24` | **Alta: [Cadastros.RF001] é essencial** |
| D4 | CT-FZ-02, CT-FZ-01 | **Data no formato certo, mas inexistente** (30/02, 31/04, mês 13 ou 00) não é recusada fora de Cadastros. Cobrança avulsa com 30/02 vai ao Asaas como 30/02 e é gravada aqui como 02/03 (divergência); com mês 13, a resposta é 500 **depois** de criar a cobrança no Asaas (cobrança só no Asaas). Movimentação, filtros de cobranças e da trilha e `mes=0000-01` dão 500 ou gravam a data errada. No worker, `paymentDate` 30/02 baixa com 02/03, e 13/45 trava o evento | `cobrancas/dominio/cobranca.ts:51-58` e `:146-152`, `movimentacoes/dominio/movimentacao.ts:45` e `:127-132`, `administracao/dominio/trilha.ts:47-53`, `cobrancas/dominio/conciliacao.ts:23-25`. A função certa já existe: `lerData` em `cadastros/dominio/comum.ts` | Alta: cobrança divergente do Asaas ([Confiabilidade.NF005]) |
| D5 | CT-FZ-02, CT-FZ-01 | **Inteiro acima do limite da coluna** (2.147.483.647) passa na validação e dá 500: matrícula, valor da cobrança avulsa (500 depois de criar no Asaas), valor da movimentação, filtros de valor e página das cobranças; no worker, `payment.value` enorme trava o evento | `cadastros/dominio/aluno.ts:57-64`, `cobranca.ts:47-50` e `:154-159`, `movimentacao.ts:122-126`, `conciliacao.ts:34-38` | Média |
| D6 | CT-FZ-02, CT-FZ-01 | **Byte nulo** (`\u0000`) em texto dá 500 (o PostgreSQL recusa). Na descrição da cobrança avulsa, o erro vem **depois** de criar no Asaas | `texto()` em `cadastros/dominio/comum.ts:34` e equivalentes; `lerEvento` no webhook | Média |
| D7 | CT-FZ-01 | **Webhook sem limite** no tamanho do id (6.000 caracteres estoura o índice: 500) e na profundidade do JSON (5.000 listas aninhadas: 500). Nada é gravado | `cobrancas/api/webhook-asaas.controller.ts` (`lerEvento`) | Média: o requisito é nunca responder 500 ao Asaas |
| D8 | CT-FZ-01 | **Valor pago que arredonda para zero** (0,001) passa no `valor > 0` antes de arredondar; a entrada de 0 centavos viola o CHECK e o evento fica em nova tentativa para sempre, com a cobrança aberta e sem pendência | `cobrancas/dominio/conciliacao.ts:38` | Baixa: o Asaas não manda esse valor |
| D9 | CT-FZ-02 | **Busca de cobranças com `%` ou `_`** devolve todas as abertas, em vez de tratar o caractere como texto | `cobrancas/infra/cobrancas.repositorio.ts:376-385` | Baixa |

Para cada caso Falhou ou Bloqueado (Seção 6.2 do plano):

```powershell
gh issue create --title "CT-CAD-04: movimentação em projeto cancelado aceita sem aviso" --body "Caso CT-CAD-04 do Plano de Testes v1.1, [Cadastros.RF005] fluxo E1. Esperado: ... Observado: ... Evidência: E07 (teste ct-cad-04-projeto.spec.ts). Commit <hash>."
```

---

## 9. Fechar as evidências e montar o PDF

### 9.1 Manifesto

```powershell
Get-ChildItem $ev -File | Where-Object Name -ne "MANIFESTO-sha256.csv" |
  Get-FileHash -Algorithm SHA256 |
  Select-Object @{ n = 'Arquivo'; e = { Split-Path $_.Path -Leaf } }, Hash |
  Export-Csv -Encoding UTF8 -NoTypeInformation "$ev\MANIFESTO-sha256.csv"
```

Antes de versionar, confira que nada em `$ev` tem dado real, senha, token ou chave. Depois, numa branch
`docs/resultados-testes`, commite `docs/testes/evidencias/` e a planilha exportada e integre na `main`. O hash
desse commit também vai no PDF.

### 9.2 Estrutura do PDF

1. **Capa:** sistema, versão do plano (1.1), data da execução, executores, commit testado, commit das evidências.
2. **Ambiente:** `E00-ambiente.txt`, endereço da homologação, ambiente sandbox do Asaas.
3. **Resumo:** dos 33 casos, quantos passaram, falharam ou ficaram bloqueados, por nível (como a Tabela 5.3 do
   plano). Mais: testes de unidade (E02), de integração e sistema (E07), cobertura (E03) e link do CI (E06).
4. **Resultados por caso:** a planilha.
5. **Defeitos:** a Seção 8, com o link de cada issue.
6. **Critério de aceite (Seção 6.1 do plano):** algum caso de requisito **essencial** falhou ou ficou bloqueado?
   D2 é de requisito importante ([Cobranças.RF003] é "importante"): pela Seção 6.1, só pode ser aceito com
   decisão registrada da equipe.
7. **Anexos:** prints e PDFs das evidências, na ordem dos IDs, e o `MANIFESTO-sha256.csv`.

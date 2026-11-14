# Roteiro de execução do Plano de Testes v1.1

Este roteiro diz **como** executar os 33 casos do `IntegraCASD_PlanoDeTestes_v1.1.pdf` e **que evidência**
guardar de cada um, para o relatório final em PDF poder ser auditado. Qualquer pessoa deve conseguir pegar
o relatório, achar a evidência de cada caso e repetir a execução no mesmo commit.

O caminho todo, em quatro passos:

1. `pnpm evidencias` roda as fases automáticas e guarda cada saída numa pasta nova de `docs/testes/evidencias/`
   (Seção 2).
2. A equipe faz as verificações na homologação e nas telas, salva prints e saídas na mesma pasta e anota o
   resultado em `verificacoes-manuais.json` (Seções 4 a 7).
3. `pnpm evidencias -- --fechar <pasta>` monta o `RESULTADOS.md` com os 33 casos e o critério de aceite, procura
   segredos e grava o manifesto SHA-256 (Seção 9).
4. A pasta vai para o GitHub, e o PDF é montado a partir dela (Seção 9).

A versão 1.1 do plano corrige a 1.0: a Seção 5.2 anunciava 8 casos não funcionais, mas listava 7 (o
CT-NF-08, citado só no Apêndice A, nunca foi definido). O total passou de 34 para 33 casos.

---

## 0. Como o relatório prova que os testes foram feitos

Cada pergunta de quem audita tem uma resposta que não depende de acreditar na equipe:

| Pergunta | O que responde |
|---|---|
| Que código foi testado? | O hash do commit, no cabeçalho de toda evidência, no `execucao.json` e no `RESULTADOS.md`. O commit está no GitHub. |
| Os testes rodaram mesmo? | A saída inteira de cada comando, com início, fim, duração e código de saída (`E01` a `E07`), e os relatórios JSON do Vitest com o nome e a situação de cada teste (`E02-unidade.json`, `E07-integracao.json`). |
| Alguém de fora confirma? | O `E06`: a execução do CI no GitHub para o **mesmo commit** (lint, unidade, arquitetura, build e contrato). Esse registro é do GitHub, não da nossa máquina. |
| Dá para repetir? | Sim: `git switch --detach <commit>` e `pnpm evidencias` têm de dar os mesmos resultados. Os testes usam só dados fictícios e um banco recriado a cada execução. |
| Algum arquivo foi trocado depois? | O `MANIFESTO-sha256.txt` tem o hash de cada arquivo. O hash do próprio manifesto vai na capa do PDF e num comentário da issue #66, com a data registrada pelo GitHub. `pnpm evidencias -- --conferir <pasta>` confere tudo. |
| E o que só existe na tela? | Print de tela inteira com a barra de endereço e o relógio (ou gravação de tela), e o resultado anotado em `verificacoes-manuais.json`, com quem conferiu e quando. O `H00` mostra que a homologação rodava o commit testado. |

---

## 1. Regras

1. **Um commit só, publicado.** Todos os testes rodam sobre o mesmo commit da `main`, já com `git push` e com o CI
   terminado. O `pnpm evidencias` recusa rodar com arquivo versionado modificado. Se alguém fizer merge na `main`
   no meio da execução, recomece no commit novo.
2. **Toda evidência é um arquivo** na pasta da execução, `docs/testes/evidencias/<AAAA-MM-DD>-<commit>/`, com nome
   começando pelo ID (ex.: `E02-unidade.txt`, `H01-medir-webhook.txt`, `M01a-emitida.png`).
3. **Saída de comando é salva em arquivo, não só em print.** O texto mostra o comando, o resultado e o código
   de saída. Print serve para o que só existe na tela.
4. **Print de tela mostra a barra de endereço e o relógio do Windows** (`Win + Shift + S`, tela cheia).
5. **Só dados fictícios** ([Padrões.NF001]). A homologação usa dados fictícios. Nenhum print, saída ou dump com
   dado real de aluno entra nas evidências.
6. **Nada de `.csv`, `.xlsx` ou `.dump` na pasta:** o `.gitignore` barra esses tipos (LGPD), e o arquivo ficaria fora
   do commit. Por isso o manifesto é `.txt` e a "planilha" de resultados é o `RESULTADOS.md`. O `--fechar` avisa.
7. **Resultado com três valores (Seção 6.2 do plano):**
   - **Passou:** cada item do "Cenário e resultado esperado" tem evidência de que deu o esperado.
   - **Falhou:** algum item foi executado e o resultado foi diferente do esperado.
   - **Bloqueado:** algum item não pôde ser executado.

   Enquanto falta uma verificação manual, o `RESULTADOS.md` mostra o caso como **Pendente**. O relatório final não
   pode ter caso pendente. Todo Falhou ou Bloqueado vira *issue* no GitHub, citando o caso e o requisito (Seção 8).

---

## 2. Fases 1 e 2: automáticas, num comando só (≈20 min)

Antes: Docker Desktop ligado. PowerShell, na raiz do repositório:

```powershell
git switch main
git pull
git status            # nada modificado
gh run list --workflow CI --branch main --limit 1     # o CI do último commit terminou com sucesso?
pnpm evidencias
```

O script cria a pasta `docs/testes/evidencias/<AAAA-MM-DD>-<commit>/` e roda, em ordem:

| ID | Arquivos | Comandos | O que conferir |
|---|---|---|---|
| E00 | `E00-ambiente.txt` | `pnpm install --frozen-lockfile`, `docker compose up -d`; versões do Windows, Node, pnpm, Vitest, Docker e PostgreSQL | Código 0; nenhuma mudança local |
| E01 | `E01-lint.txt` | `pnpm lint` | Código 0 |
| E02 | `E02-unidade.txt` e `.json` | Vitest dos testes de unidade e de arquitetura, com o nome de cada teste | `Tests 599 passed` (ou mais) |
| E03 | `E03-cobertura.txt` | `pnpm cobertura` (caixa branca, Seção 3.2 do plano) | O resumo de cobertura no fim |
| E04 | `E04-arquitetura.txt` | `pnpm verificar:arquitetura` (migrações imutáveis e cores) | Código 0 |
| E05 | `E05-build-e-contrato.txt` | `pnpm build`, `pnpm verificar:build`, `pnpm verificar:contrato` e a conferência de que nenhum arquivo versionado mudou | Código 0 |
| E06 | `E06-ci.json` e `E06-ci-log.txt` | Consulta ao GitHub (`gh run list --commit`): a execução do CI desse commit e o log dela | `"conclusion": "success"` |
| E07 | `E07-integracao.txt` e `.json` | Vitest dos testes de integração e de sistema, com PostgreSQL real | `Tests 406 passed` (ou mais) |

No fim, o script grava `execucao.json` (commit, quem executou, horários e código de cada etapa), cria o modelo de
`verificacoes-manuais.json`, monta o `RESULTADOS.md` e grava o manifesto. O terminal mostra a linha
`$ev = "docs\testes\evidencias\..."`: copie e rode no PowerShell, porque as Seções 4 a 6 salvam os arquivos em `$ev`.

Observações:

- **CT-NF-05 sempre roda** (uns 6 minutos: ritmo real de produção para 1.000 alunos). O script ignora a variável
  `PULAR_CT_NF_05`.
- O `E07-integracao.txt` mostra os números medidos: no CT-NF-03, `respostas 200: 100 de 100` e
  `mínimo | média | p95 | máximo`; no CT-NF-05, `criadas 1000 | falhas 0`, `requisições ao Asaas N (limite 2500)`,
  `respostas 429` e `duração`.
- O relatório HTML da cobertura fica em `apps/api/coverage/index.html`. Se quiser anexá-lo, salve em PDF
  (`Ctrl+P`) como `$ev\E03-cobertura.pdf`.
- **Para experimentar** com mudanças não commitadas: `pnpm evidencias -- --rascunho`. A pasta termina em
  `-rascunho`, o git a ignora e o `RESULTADOS.md` avisa que não vale como evidência. Com `$env:PULAR_CT_NF_05='1'`
  antes, o rascunho pula o CT-NF-05.

Resultado conhecido no commit `4df48b4` (D1 e D3 a D9 corrigidos, Seção 8): `Test Files 75 passed` e
`Tests 599 passed` no E02; `Test Files 25 passed` e `Tests 406 passed` no E07; nenhum teste falhando. Um teste que
falhe agora é defeito novo (ou a volta de um antigo) e vira issue (Seção 8): o nome do teste diz a entrada e o que
se esperava.

---

## 3. Mapa caso → evidência

Caminhos relativos a `apps/api/`. O `describe` de cada teste cita o requisito e o caso (ex.: `[Cadastros.RF001]
CT-CAD-01`): é assim que o `RESULTADOS.md` junta os testes de cada caso, e o anexo dele lista todos pelo nome.

### Requisitos funcionais

| Caso | Nível | Arquivo de teste | Evidência | Observação |
|---|---|---|---|---|
| CT-CAD-01 | I | `test/integracao/cadastros/ct-cad-01-aluno.spec.ts` | E07 + M02 | D3 corrigido (Seção 8); a M02 confirma na tela |
| CT-CAD-02 | I | `test/integracao/cadastros/ct-cad-02-funcionario.spec.ts` | E07 | Limites ontem/hoje/amanhã |
| CT-CAD-03 | U | `src/modulos/cadastros/dominio/contrato.spec.ts` | E02 | |
| CT-CAD-04 | I | `test/integracao/cadastros/ct-cad-04-projeto.spec.ts` | E07 | D1 corrigido (Seção 8) |
| CT-COB-01 | I | `test/integracao/cobrancas/ct-cob-01-geracao-recorrente.spec.ts` | E07 | |
| CT-COB-02 | I | `test/integracao/cobrancas/ct-cob-02-emissao-avulsa.spec.ts` | E07 | Tabela de decisão R1 a R5 |
| CT-COB-03 | I | `test/integracao/cobrancas/ct-cob-03-boleto.spec.ts` | E07 | **Falha no "reenviar": defeito D2 em aberto (issue #29)**. O script marca o caso como Falhou até o D2 ser corrigido |
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
| CT-FZ-01 | S | `test/sistema/fuzzing/ct-fz-01-webhook.spec.ts` | E07 | 84 entradas em `test/sistema/fuzzing/entradas/`. D4 a D8 corrigidos (Seção 8) |
| CT-FZ-02 | S | `test/sistema/fuzzing/ct-fz-02-formularios-e-filtros.spec.ts` | E07 | 205 entradas. D4, D5, D6 e D9 corrigidos (Seção 8) |

Os casos com verificação na homologação ou nas telas (H01, H03, M01, M02, M03) também dependem do H00.

---

## 4. Fase 3: homologação na Railway (≈1 h)

Antes, confira (playbook `docs/playbooks/implantacao.md`, itens 3.3 e 3.4): chave do sandbox cadastrada em
Administração › Integração Asaas, webhook do sandbox apontando para `https://<homologação>/api/webhooks/asaas`
com o token da homologação, e **o worker ligado** na Railway (sem ele a baixa não acontece).

Crie na raiz o arquivo `.env.homologacao` (o `.gitignore` já ignora `.env.*`):

```
HOMOLOGACAO_URL=https://<endereço da homologação>
ASAAS_WEBHOOK_TOKEN=<token do webhook da homologação>
```

### H00: a homologação roda o commit testado

No painel da Railway, projeto de homologação: abra a implantação ativa do serviço `app` e a do `worker` e tire um
print de cada uma mostrando o commit (`H00-app.png`, `H00-worker.png`). O commit tem de ser o mesmo do
`execucao.json`. Se não for, as verificações H e M não valem: implante o commit testado ou recomece a Seção 2 no
commit que está no ar.

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

## 5. Fase 4: roteiros manuais nas telas da homologação (≈1 h)

Para cada passo: print de tela inteira com a URL e o relógio visíveis, salvo em `$ev`.

### M01: ponta a ponta com o Asaas sandbox (CT-SIS-01)

a. Emita uma cobrança avulsa para um aluno fictício com e-mail, vencimento hoje (`M01a-emitida.png`).
b. No painel do sandbox, ache a cobrança e confirme o pagamento (`M01b-sandbox-pago.png`).
c. Espere o webhook (segundos). No IntegraCASD a cobrança fica **Paga**, sem clicar em nada (`M01c-paga.png`).
   Se não ficar, o worker está desligado ou o webhook do sandbox não está configurado: é Bloqueado.
d. Em Movimentações aparece a entrada daquela cobrança (`M01d-entrada.png`); o painel de Indicadores mostra a
   entrada no mês (`M01e-painel.png`).

### M02: inativar aluno com débito (CT-CAD-01, fluxo E2)

Com um aluno fictício que tenha cobrança **vencida**: inativar mostra o débito e pede confirmação
(`M02-confirmacao-vencida.png`). Depois, com um aluno que tenha só cobrança **aberta, ainda não vencida**: o aviso
de débito também aparece (`M02-confirmacao-aberta.png`). Era o defeito D3, corrigido (Seção 8). Repare também que o
botão "Inativar aluno" fica desabilitado até a consulta das cobranças terminar.

### M03: usabilidade (CT-NF-01)

| Tarefa | Limite | Evidência |
|---|---|---|
| Localizar um aluno | 3 interações | `M03-localizar-aluno.png` + nº de interações na observação |
| Lançar uma movimentação | 3 | `M03-lancar-movimentacao.png` |
| Emitir cobrança avulsa | 3 | `M03-emitir-cobranca.png` |
| Estornar movimentação: mostra resumo e pede confirmação | — | `M03-confirma-estorno.png` |
| Cancelar cobrança: mostra resumo e pede confirmação | — | `M03-confirma-cancelamento.png` |
| Situações aparecem como selo com texto (não só cor) | — | `M03-selos.png` |
| Cada gráfico do painel tem tabela equivalente | — | `M03-graficos-tabela.png` |

Gravar a tela (`Win + Alt + R`) também vale como evidência (`M03-gravacao.mp4`).

---

## 6. Fase 5: inspeção (≈30 min)

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

## 7. Anotar as verificações manuais

O `pnpm evidencias` cria na pasta o arquivo `verificacoes-manuais.json`, com uma entrada para cada verificação (H00 a
H03, M01 a M03, I01 e I02). Quem conferiu preenche, por exemplo:

```json
"M02": {
  "o_que_e": "Inativar aluno com débito vencido e com débito aberto",
  "resultado": "Passou",
  "responsavel": "<nome de quem conferiu>",
  "data": "2026-11-16",
  "observacao": "Aviso de débito aparece nos dois casos; o botão espera a consulta terminar."
}
```

`resultado` é `Passou`, `Falhou` ou `Bloqueado`. Uma verificação só conta com o resultado anotado **e** ao menos
um arquivo na pasta cujo nome começa pelo id dela; sem isso, os casos que dependem dela ficam Pendentes.

---

## 8. Defeitos encontrados na preparação (viram issue)

A coluna "Onde" aponta o código do commit em que o defeito foi achado. A coluna "Situação" dá o merge na branch
`fix/entradas-invalidas` (spec #57) que corrigiu o defeito e o ticket; o `a54dfa1` integra as correções da revisão
de código da spec, e o `4df48b4` leva tudo para a `main`.

| Id | Caso | O que acontece | Onde | Severidade | Situação |
|---|---|---|---|---|---|
| D1 | CT-CAD-04 ([Cadastros.RF005] E1, [Movimentações.RF001] A2) | Movimentação num projeto **cancelado** é aceita sem aviso. O sistema considera cancelado como "encerrado" (`GET /api/projetos` responde `encerrado: true`), mas o aviso só sai para EXECUTADO | `apps/api/src/modulos/movimentacoes/infra/movimentacoes.repositorio.ts:162` | Baixa: a tela não oferece projeto cancelado, mas a API aceita | **Corrigido:** merge `d24c0cc` (#59); revisão em `a54dfa1` (#57) |
| D2 | CT-COB-03 ([Cobranças.RF003] passo 3 e A2) | "Reenviar boleto por e-mail" não existe: o backend só tem "baixar"; o botão da tela está desabilitado | `cobrancas.controller.ts:164-171`; issue #29 já aberta (a API v3 do Asaas não reenvia) | Requisito importante: precisa de decisão da equipe | Em aberto (issue #29). Registrado em `DEFEITOS_EM_ABERTO` no `scripts/testes/coletar-evidencias.mjs`: ao corrigir, apague a linha |
| D3 | CT-CAD-01 ([Cadastros.RF001] E2) | O diálogo de inativação só mostra o débito quando há cobrança **vencida**; o caso de uso fala em "Aberta ou Vencida" | `apps/web/src/features/cadastro/DialogoInativarAluno.tsx:24` | **Alta: [Cadastros.RF001] é essencial** | **Corrigido:** merge `027c634` (#60); revisão em `a54dfa1` (#57). Falta a M02 na homologação |
| D4 | CT-FZ-02, CT-FZ-01 | **Data no formato certo, mas inexistente** (30/02, 31/04, mês 13 ou 00) não é recusada fora de Cadastros. Cobrança avulsa com 30/02 vai ao Asaas como 30/02 e é gravada aqui como 02/03 (divergência); com mês 13, a resposta é 500 **depois** de criar a cobrança no Asaas (cobrança só no Asaas). Movimentação, filtros de cobranças e da trilha e `mes=0000-01` dão 500 ou gravam a data errada. No worker, `paymentDate` 30/02 baixa com 02/03, e 13/45 trava o evento | `cobrancas/dominio/cobranca.ts:51-58` e `:146-152`, `movimentacoes/dominio/movimentacao.ts:45` e `:127-132`, `administracao/dominio/trilha.ts:47-53`, `cobrancas/dominio/conciliacao.ts:23-25`. A função certa já existe: `lerData` em `cadastros/dominio/comum.ts` | Alta: cobrança divergente do Asaas ([Confiabilidade.NF005]) | **Corrigido:** merges `916aae3` (#61), `e8064d3` (#62), `c3a097b` (#63) e `8b24259` (#65); revisão em `a54dfa1` (#57) |
| D5 | CT-FZ-02, CT-FZ-01 | **Inteiro acima do limite da coluna** (2.147.483.647) passa na validação e dá 500: matrícula, valor da cobrança avulsa (500 depois de criar no Asaas), valor da movimentação, filtros de valor e página das cobranças; no worker, `payment.value` enorme trava o evento | `cadastros/dominio/aluno.ts:57-64`, `cobranca.ts:47-50` e `:154-159`, `movimentacao.ts:122-126`, `conciliacao.ts:34-38` | Média | **Corrigido:** merges `93c59c0` (#58), `916aae3` (#61), `e8064d3` (#62), `c3a097b` (#63) e `8b24259` (#65) |
| D6 | CT-FZ-02, CT-FZ-01 | **Byte nulo** (`\u0000`) em texto dá 500 (o PostgreSQL recusa). Na descrição da cobrança avulsa, o erro vem **depois** de criar no Asaas | `texto()` em `cadastros/dominio/comum.ts:34` e equivalentes; `lerEvento` no webhook | Média | **Corrigido:** merges `93c59c0` (#58), `916aae3` (#61), `e8064d3` (#62) e `23807b5` (#64); demais campos de texto em `a54dfa1` (#57) |
| D7 | CT-FZ-01 | **Webhook sem limite** no tamanho do id (6.000 caracteres estoura o índice: 500) e na profundidade do JSON (5.000 listas aninhadas: 500). Nada é gravado | `cobrancas/api/webhook-asaas.controller.ts` (`lerEvento`) | Média: o requisito é nunca responder 500 ao Asaas | **Corrigido:** merge `23807b5` (#64); `payment.id` longo e surrogate sem par em `a54dfa1` (#57) |
| D8 | CT-FZ-01 | **Valor pago que arredonda para zero** (0,001) passa no `valor > 0` antes de arredondar; a entrada de 0 centavos viola o CHECK e o evento fica em nova tentativa para sempre, com a cobrança aberta e sem pendência | `cobrancas/dominio/conciliacao.ts:38` | Baixa: o Asaas não manda esse valor | **Corrigido:** merge `8b24259` (#65); motivo da pendência em `a54dfa1` (#57) |
| D9 | CT-FZ-02 | **Busca de cobranças com `%` ou `_`** devolve todas as abertas, em vez de tratar o caractere como texto | `cobrancas/infra/cobrancas.repositorio.ts:376-385` | Baixa | **Corrigido:** merge `c3a097b` (#63) |

Para cada caso Falhou ou Bloqueado na execução (Seção 6.2 do plano):

```powershell
gh issue create --title "CT-XXX-NN: <o que falhou>" --body "Caso CT-XXX-NN do Plano de Testes v1.1, [<requisito>]. Esperado: ... Observado: ... Evidência: <pasta>/<arquivo> (teste <nome do teste>). Commit <hash>."
```

---

## 9. Fechar, publicar e montar o PDF

### 9.1 Fechar a pasta

Depois de salvar os arquivos das Seções 4 a 6 e preencher o `verificacoes-manuais.json`:

```powershell
pnpm evidencias -- --fechar <AAAA-MM-DD>-<commit>
```

O `--fechar`:

1. busca de novo o CI (E06), se ele ainda não tinha terminado;
2. refaz o `RESULTADOS.md` (Seção 9.3);
3. procura problemas e **não grava o manifesto** se achar algum:
   - o prefixo de chave do Asaas ou o valor de algum token, chave ou senha do `.env` e do `.env.homologacao` num
     arquivo de texto (o valor nunca é impresso, só o nome da variável);
   - um arquivo que o git ignora (`.csv`, `.xlsx`, `.dump`...);
4. grava o `MANIFESTO-sha256.txt` (hash de cada arquivo da pasta) e mostra o SHA-256 do próprio manifesto.

O script não lê imagens: confira você que os prints só mostram dados fictícios e nenhum token. Mudou algum arquivo
depois? Rode o `--fechar` de novo.

### 9.2 Publicar

```powershell
git switch -c docs/resultados-testes-<AAAA-MM-DD>
git add docs/testes/evidencias/<pasta>
git commit -m "docs(testes): evidências da execução do plano v1.1 no commit <hash curto>"
git switch main
git merge --no-ff docs/resultados-testes-<AAAA-MM-DD>
git push
git branch -d docs/resultados-testes-<AAAA-MM-DD>
gh issue comment 66 --body "Evidências do Plano de Testes v1.1: docs/testes/evidencias/<pasta>, commit testado <hash>, SHA-256 do MANIFESTO-sha256.txt: <hash do manifesto>"
```

O comentário na issue é o carimbo de data: o GitHub registra quando ele foi feito, e qualquer edição posterior
fica marcada. O `.gitattributes` guarda os arquivos de `docs/testes/evidencias/` byte a byte, para o manifesto
bater depois de um clone em qualquer máquina.

### 9.3 Conferir (quem audita)

```powershell
git clone <repositório>; cd IntegraCASD
pnpm evidencias -- --conferir <AAAA-MM-DD>-<commit>
```

Mostra o SHA-256 do manifesto (para comparar com o da capa do PDF e o da issue #66) e diz se cada arquivo bate
(`ALTERADO`, `FALTA` ou `A MAIS` quando não bate). Sem Node, no Git Bash:
`cd docs/testes/evidencias/<pasta>; sha256sum -c MANIFESTO-sha256.txt`.

### 9.4 Estrutura do PDF

O `RESULTADOS.md` já traz as Seções 3 a 6 abaixo prontas: abra no GitHub ou no VS Code e copie, ou imprima em PDF.

1. **Capa:** sistema, versão do plano (1.1), data da execução, executores, commit testado, commit das evidências e
   SHA-256 do manifesto.
2. **Ambiente:** `E00-ambiente.txt`, endereço da homologação (`H00`), ambiente sandbox do Asaas.
3. **Critério de aceite (Seção 6.1 do plano):** o veredito do `RESULTADOS.md`. Todo caso de requisito essencial
   tem de passar. D2 é de requisito importante ([Cobranças.RF003]): pela Seção 6.1, só pode ser aceito com
   decisão registrada da equipe (cite a decisão e a issue #29).
4. **Resumo:** dos 33 casos, quantos passaram, falharam, ficaram bloqueados ou pendentes, por nível (como a
   Tabela 5.3 do plano), e as fases automáticas: lint, unidade (E02), cobertura (E03), CI (E06, com o link),
   integração e sistema (E07).
5. **Resultados por caso:** a tabela "Resultado por caso" e a de verificações manuais.
6. **Defeitos:** a Seção 8 deste roteiro, com o link de cada issue.
7. **Anexos:** o anexo do `RESULTADOS.md` (os testes de cada caso), os prints na ordem dos IDs e o
   `MANIFESTO-sha256.txt`.

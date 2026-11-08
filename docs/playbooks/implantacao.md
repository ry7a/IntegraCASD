# Implantação na Railway

Este playbook coloca o IntegraCASD no ar na Railway, do primeiro cadastro até a primeira cobrança real,
e depois descreve a rotina de implantar versões, voltar versão e reagir a incidentes. A decisão está no
[ADR-0006](../adr/0006-hospedagem-na-railway.md).

**Siga as fases na ordem.** Marque os itens conforme for fazendo.

Convenções:

- Comandos em blocos `powershell` rodam na **sua máquina**, na raiz do repositório.
- Os nomes de menus da Railway mudam de tempos em tempos. Se um caminho não bater, abra a busca do
  painel com **Ctrl+K** e digite o termo indicado.
- Todo segredo vai para o **cofre de senhas do CASD** (passo 0.4), nunca para o repositório, o chat do
  grupo ou um arquivo solto.

## Visão geral

```
Usuários ──┐
           ├── HTTPS ──► Railway (domínio *.up.railway.app; depois, financeiro.<domínio do CASD>)
Asaas ─────┘                    │
                                ▼
  Projeto integracasd-producao (região nos EUA)
  ├── app      NestJS: site + /api + webhook      ──┐
  ├── worker   NestJS + pg-boss (fila e rotinas)  ──┼──► Postgres 18 (volume)
  └── backup   cron diário: pg_dump ──────────────────────► Cloudflare R2 (cifrado, 35 dias)

  Projeto integracasd-homologacao: os mesmos serviços, Asaas sandbox, dados fictícios
```

| Peça | Onde | Custo estimado |
| --- | --- | --- |
| Produção (app, worker, Postgres, backup) | Railway Hobby | ~US$ 8 a 10/mês |
| Homologação (quase sempre desligada) | Railway Hobby | ~US$ 2 a 4/mês |
| Backups (até 10 GB) | Cloudflare R2 | US$ 0 |
| E-mail de alerta | Resend (gratuito) | US$ 0 |
| Monitores do site e do backup | UptimeRobot e Healthchecks.io | US$ 0 |
| Domínio `.org.br` (quando houver) | registro.br | ~R$ 40/ano |

O plano Hobby cobra US$ 5 por mês, e esse valor já conta como uso. Paga-se o que passar disso.

## Resumo das fases

- [ ] **Fase 0:** contas, cofre e decisões
- [ ] **Fase 1:** pré-requisitos no código
- [ ] **Fase 2:** projeto de homologação na Railway
- [ ] **Fase 3:** homologação no ar e testes
- [ ] **Fase 4:** backups e teste de restauração
- [ ] **Fase 5:** projeto de produção
- [ ] **Fase 6:** Asaas real e carga inicial
- [ ] **Fase 7:** domínio próprio (quando o CASD tiver)
- Depois do ar: rotina de implantação, volta de versão, operação e incidentes

---

## Fase 0: contas, cofre e decisões

- [ ] **0.1 Conta Asaas de produção** no CNPJ do CASD. A aprovação leva dias: comece já.
- [ ] **0.2 E-mail institucional** do CASD, lido por pelo menos duas pessoas. Todas as contas usam esse
  e-mail.
- [ ] **0.3 Contas** com o e-mail do 0.2 e 2FA ligado:
  - Railway (entrar com GitHub)
  - Cloudflare (só para o R2)
  - Resend
  - UptimeRobot
  - Healthchecks.io

  **Crie a conta do Resend com o e-mail que deve receber os alertas.** Sem domínio verificado, o Resend
  só entrega para o e-mail dono da conta (confira na tela do Resend).
- [ ] **0.4 Cofre de senhas** compartilhado: organização gratuita do Bitwarden (2 pessoas) ou um arquivo
  do KeePassXC no drive do CASD. Vão para lá:
  - as variáveis de cada projeto da Railway;
  - as credenciais do R2 e as senhas do rclone;
  - a chave do Resend.

  > **Perder a `CHAVE_DE_CIFRAGEM` deixa ilegível a chave do Asaas guardada no banco. Perder as senhas do
  > rclone deixa os backups inúteis.**
- [ ] **0.5 Aprovar o ADR-0006** com a equipe (status Aceita; fecha a #48).
- [ ] **0.6 Decisões da Fase 1:** Observe (1.7), trilha de auditoria (1.8) e mês de virada da cobrança
  (1.13). As duas últimas precisam estar decididas antes da carga real.

## Fase 1: pré-requisitos no código

Cada item é uma branch pequena, integrada à `main` como de costume. As Fases 2 e 3 precisam dos itens
1.1 a 1.12 na `main`.

### Ajustes da API e do worker

- [x] **1.1 API pronta para rodar atrás do proxy da Railway** (`apps/api/src/main.ts`):
  - `app.enableShutdownHooks()`;
  - Swagger só quando `NODE_ENV !== 'production'`;
  - `trust proxy` ligado e `x-powered-by` desligado.
- [x] **1.2 Duas rotas públicas de saúde**, com `@Publico()`:
  - **`GET /api/saude`:** 200 se o banco responde (`SELECT 1`). A Railway usa essa rota para liberar
    cada implantação. Por isso ela não pode depender do worker: na primeira subida da produção o worker
    ainda está desligado.
  - **`GET /api/saude/completa`:** 200 se o banco responde **e** a rotina `vigilancia-do-asaas` rodou na
    última hora; 503 caso contrário. É a que o UptimeRobot vigia, porque revela um worker parado. A
    resposta é reaproveitada por 30 s.
- [x] **1.3 Validar a configuração na subida:** a API e o worker se recusam a subir sem `DATABASE_URL`,
  `CHAVE_DE_CIFRAGEM` com 32 bytes e, na API, `ASAAS_WEBHOOK_TOKEN`.
- [x] **1.4 pg-boss sem agendamento na API:** cron e manutenção da fila ficam só no worker.
- [x] **1.5 Timeout nas chamadas ao Asaas**, com teste.
- [x] **1.6 Trocar o perfil de um usuário revoga as sessões dele**, com teste.
- [x] **1.7 Decisão: remover `@nestjs/observe` e `@nestjs/mau`.** Hoje o Observe manda telemetria para um
  serviço externo, com credenciais de exemplo fixas no código. Recomendação: remover os dois, o script
  `deploy` e as entradas em `dependencias.json`.
- [x] **1.8 Decisão LGPD: nada de nomes e e-mails no `detalhe` da trilha.** A trilha é imutável
  (ADR-0004). A decisão vale para o backend e para `scripts/carga-inicial/carregar_alunos.py`.
- [x] **1.9 `.env.example`:** incluir `NODE_ENV`, `PORT` e `EMAIL_API_URL`; remover `SESSION_SECRET`.

### O `app` serve o site

- [x] **1.10 A API serve o build do Vite no mesmo endereço.** Usa `useStaticAssets` do
  `@nestjs/platform-express`, que já é dependência:
  - qualquer `GET` fora de `/api` que não seja arquivo devolve o `index.html`, para as rotas do React
    Router funcionarem ao recarregar;
  - `/assets/*` com `Cache-Control: public, max-age=31536000, immutable`, e o resto com `no-cache`;
  - um middleware simples, sem dependência nova, põe os cabeçalhos de segurança:
    `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
    `Strict-Transport-Security: max-age=15552000` e
    `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`.
  - O caminho do `dist` do web vem de uma variável com valor padrão. Em desenvolvimento nada muda: o Vite
    continua servindo o site com o proxy para `/api`.

### Imagem e backup

- [x] **1.11 `Dockerfile` e `.dockerignore` na raiz.** A Railway usa o `Dockerfile` da raiz sozinha.
  - **`Dockerfile`:**
    - `node:24.20.0-bookworm-slim`, mais o pacote `openssl` (sem ele o Prisma baixa o schema engine
      errado);
    - `npm i -g pnpm@11.28.5`;
    - `COPY . .`;
    - `pnpm install --frozen-lockfile`, **com** os scripts de instalação: eles baixam o schema engine do
      Prisma (usado pelo `migrate deploy`) e rodam o `prisma generate`. O `prepare` da raiz
      (`git config core.hooksPath .githooks || exit 0`) só ativa os ganchos onde há git; na imagem, que
      não tem git, ele segue em frente;
    - `pnpm --filter web build` e `pnpm --filter api build`;
    - `ENV NODE_ENV=production` só depois do install (antes, o pnpm pularia as devDependencies);
    - `WORKDIR /repo/apps/api`, `USER node` (o processo não roda como root) e `CMD ["node", "dist/main.js"]`.

    É uma imagem "gorda", de propósito: leva a CLI do Prisma para o `migrate deploy`.
  - **`.dockerignore`:** `.env*`, `**/node_modules`, `**/dist`, `data/`, `scripts/carga-inicial/`,
    `backups/`, `*.dump`, `*.xlsx`, `*.xls`, `*.csv`, `*.tsbuildinfo`, `apps/api/src/generated`,
    `coverage`, `.git`, `.claude`, `docs/` e o `dados-ficticios.sql`.
  - Para testar na sua máquina: `docker build -t integracasd .`
- [x] **1.12 Serviço de backup:**
  - **`scripts/backup/Dockerfile`:** a partir de `postgres:18.6`, com `rclone` (1.60, do Debian; o
    provider `Cloudflare` existe desde a 1.59) e `curl` instalados. O contexto do build é a raiz:
    `docker build -f scripts/backup/Dockerfile .`
  - **`scripts/backup/backup-railway.sh`**, commitado com permissão de execução
    (`git update-index --chmod=+x`) e fim de linha LF (`*.sh text eol=lf` no `.gitattributes`). Ele:
    - exige `AMBIENTE` (`homologacao` ou `producao`) e `DATABASE_URL`;
    - roda `pg_dump "$DATABASE_URL" -Fc` para `/tmp/integracasd-<AMBIENTE>-<AAAAMMDD-HHMMSS>.dump`
      (horário UTC) e confere que o arquivo não está vazio;
    - envia com `rclone copy` para `r2cifrado:$AMBIENTE/`. O rclone é configurado só por variáveis
      `RCLONE_CONFIG_*` (passo 4.6). No bucket o arquivo fica com o sufixo `.bin` do rclone crypt; o
      `rclone copy r2cifrado:...` do 4.8 decifra e tira o sufixo;
    - no sucesso, faz `curl "$BACKUP_PING_URL"`, se a variável estiver preenchida;
    - em qualquer falha, sai com erro e não faz o ping. Nunca imprime a URL do banco nem segredos.

### Decisão da carga

- [ ] **1.13 Decisão: mês de virada da cobrança.** A geração recorrente cobra sempre o mês corrente,
  quando chega o dia de geração. Ela não volta para meses atrasados nem pula meses. A carga traz da
  planilha os meses não pagos já vencidos.

  O `--hoje` da carga, o dia em que o worker liga e o dia de geração cadastrado decidem qual mês fica
  com a planilha e qual com o sistema. Há dois riscos:
  - **cobrança em dobro** para quem pagou na planilha um mês que o sistema também gera;
  - **um mês sem cobrança**, se a implantação escorregar.

  A equipe e a diretoria escolhem o mês de virada e simulam a sequência na homologação.

## Fase 2: projeto de homologação na Railway

A homologação vem primeiro. Ela usa o Asaas **sandbox** e dados fictícios.

- [ ] **2.1 Plano e limite de gasto:**
  1. Railway: [[Workspace › Settings › Plans]] → **Hobby**, com o cartão do CASD.
  2. Depois, em [[Workspace › Settings › Usage]], configure:
     - **alerta por e-mail em US$ 12;**
     - **limite rígido em US$ 30.**

  O limite rígido **desliga os serviços** quando é atingido. Por isso fica bem acima do gasto esperado:
  serve só contra um susto.
- [ ] **2.2 Dar à Railway acesso ao repositório.** Ao criar o primeiro serviço a partir do GitHub, a
  Railway pede para instalar o app dela no GitHub. Libere o repositório `ry7a/IntegraCASD`. Quem faz isso
  é o dono do repositório.
- [ ] **2.3 Criar o projeto:** [[New Project › Empty project]]. Em [[Settings]], mude o nome para
  `integracasd-homologacao`.
- [ ] **2.4 Banco:** [[+ Create › Database › PostgreSQL]].
  - Confira em [[Postgres › Settings › Source]] se a imagem é da **versão 18**. Se não for, troque a tag
    para a 18 **antes** de qualquer dado entrar.
  - Em [[Settings › Deploy › Region]], escolha a região mais próxima do Brasil (hoje, uma dos EUA, de
    preferência a leste). **Todos os serviços do projeto ficam na mesma região.**
- [ ] **2.5 Serviço `app`:** [[+ Create › GitHub Repo › ry7a/IntegraCASD]].
  1. Clique no serviço › [[Settings]] › nome **`app`**.
  2. [[Settings › Source]]:
     - Branch **`main`**;
     - ligue **Wait for CI**, para só implantar commit com o CI verde.
  3. [[Settings › Build]]: Builder **Dockerfile**. A Railway detecta o da raiz.
  4. [[Settings › Deploy]]:
     - Pre-deploy command: `pnpm exec prisma migrate deploy`;
     - Healthcheck path: `/api/saude`;
     - Restart policy: **Always**;
     - Region: a mesma do Postgres;
     - **Serverless: ligado**, só na homologação. Ele "dorme" quando ninguém usa e economiza.
  5. [[Variables › Raw Editor]]: cole o bloco abaixo. **Gere os segredos antes, com os comandos do 2.7.**
     ```
     NODE_ENV=production
     PORT=3000
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     CHAVE_DE_CIFRAGEM=<gerada no 2.7>
     ASAAS_WEBHOOK_TOKEN=<gerado no 2.7>
     ```
     O ambiente do Asaas (sandbox ou produção) **não** vem daqui: é escolhido na tela de Administração (3.3).
     A primeira implantação, disparada assim que o serviço é criado, falha por falta destas variáveis. É
     esperado: depois de colar, aplique as mudanças e use [[Deployments › Deploy]].
  6. [[Settings › Networking › Generate Domain]], porta **3000**. Edite o nome para algo como
     `integracasd-homolog` e anote o endereço `https://integracasd-homolog.up.railway.app`.
- [ ] **2.6 Serviço `worker`:** [[+ Create › GitHub Repo › ry7a/IntegraCASD]] de novo.
  1. Nome: **`worker`**.
  2. Source: branch `main`, Wait for CI ligado.
  3. Deploy:
     - Custom start command: `node dist/main-worker.js`;
     - **sem** pre-deploy;
     - **sem** healthcheck;
     - Restart policy **Always**;
     - **Serverless desligado**;
     - mesma região.
  4. **Não gere domínio.**
  5. Variáveis:
     ```
     NODE_ENV=production
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     CHAVE_DE_CIFRAGEM=<a MESMA do app>
     EMAIL_API_KEY=<chave do Resend>
     EMAIL_REMETENTE=IntegraCASD HOMOLOGACAO <onboarding@resend.dev>
     EMAIL_ALERTAS_PARA=<o e-mail do 0.2, o mesmo da conta do Resend>
     ```
     O "HOMOLOGACAO" no remetente separa os alertas de teste dos reais, que chegam no mesmo e-mail. A
     homologação costuma passar dias sem pagamentos e vai mandar "webhook parado" de vez em quando: é esperado.
     Na produção (5.2), o remetente é só `IntegraCASD <onboarding@resend.dev>`.
     Sem domínio próprio, o remetente é o de testes do Resend, que **só entrega para o e-mail dono da
     conta** e recusa o envio inteiro se houver outro destinatário. Por isso, enquanto não houver domínio,
     `EMAIL_ALERTAS_PARA` manda os alertas só para esse e-mail, em vez de para toda a diretoria. Ao ter
     domínio, troque o remetente e apague `EMAIL_ALERTAS_PARA` (Fase 7).
- [ ] **2.7 Gerar os segredos** (PowerShell, um valor por vez, direto para o cofre):
  ```powershell
  $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)          # CHAVE_DE_CIFRAGEM
  $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''   # ASAAS_WEBHOOK_TOKEN
  ```
  Cada projeto (homologação e produção) tem **seus próprios** segredos. Nunca reaproveite. Ao colar na
  Railway, cuidado para não levar espaço nem quebra de linha junto: a API se recusa a subir com o
  `ASAAS_WEBHOOK_TOKEN` assim, porque o Asaas mandaria o token sem eles e todo webhook seria recusado.
- [ ] **2.8 Esconder os valores:** em cada variável secreta (`CHAVE_DE_CIFRAGEM`, `ASAAS_WEBHOOK_TOKEN`,
  `EMAIL_API_KEY`), use o menu [[⋮ › Seal]] para que ninguém consiga mais ler o valor no painel. Antes,
  confira que o valor está no cofre. Faça o mesmo com as variáveis secretas do serviço `backup` (4.6 e 5.6).

## Fase 3: homologação no ar e testes

- [ ] **3.1 Primeira implantação.** Com os itens da Fase 1 na `main`, o `app` e o `worker` implantam
  sozinhos (ou use [[Deployments › Deploy]]). Em [[Deployments › View logs]]:
  - o pre-deploy aplica as migrações;
  - a saúde fica verde;
  - o worker mostra os consumidores ligados.
- [ ] **3.2 Dados fictícios e primeiro usuário.** Use o endereço público do banco, que fica em
  [[Postgres › Variables › DATABASE_PUBLIC_URL]]. A senha e o endereço são digitados sem ficar no
  histórico do PowerShell:
  ```powershell
  $env:DATABASE_URL = Read-Host "Cole a DATABASE_PUBLIC_URL da homologação"
  pnpm --filter api dados-ficticios
  $env:ADMIN_INICIAL_NOME = Read-Host "Nome"
  $env:ADMIN_INICIAL_EMAIL = Read-Host "E-mail"
  $s = Read-Host "Senha (mín. 12)" -AsSecureString
  $env:ADMIN_INICIAL_SENHA = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
  pnpm --filter api admin-inicial
  Remove-Item Env:DATABASE_URL, Env:ADMIN_INICIAL_NOME, Env:ADMIN_INICIAL_EMAIL, Env:ADMIN_INICIAL_SENHA
  ```
  A variável definida no PowerShell vale mais que o `.env` local, então os comandos vão para o banco da
  Railway. Confirme entrando no site com o usuário criado.

  Depois, **feche o banco para fora**: [[Postgres › Settings › Networking › TCP Proxy]] → remover. O app e
  o worker usam a rede privada e não precisam dele. Reabra só quando precisar rodar algo direto no banco.
- [ ] **3.3 Asaas sandbox:**
  1. Em sandbox.asaas.com: [[Integrações › Chaves de API › Gerar chave]].
  2. No sistema: [[Administração › Integração Asaas]], cole a chave e escolha **Sandbox**.
  3. A faixa de ambiente de testes aparece.
- [ ] **3.4 Webhook do sandbox:** [[Integrações › Webhooks › Adicionar]].
  - URL: `https://<domínio da homologação>/api/webhooks/asaas`.
  - Token de autenticação: o `ASAAS_WEBHOOK_TOKEN` da homologação.
  - Fila ativa.
  - Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`,
    `PAYMENT_RESTORED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_CHARGEBACK_DISPUTE`.
- [ ] **3.5 Teste de ponta a ponta** (resultados na issue #49):
  1. Emitir uma cobrança, pagar no sandbox e ver a baixa e a movimentação aparecerem.
  2. Abrir `/cobrancas` direto e recarregar: carrega a tela.
  3. Cookie `integracasd_sessao` com Secure, HttpOnly e SameSite Strict (F12 › Application).
  4. Token errado no webhook dá 401:
     ```powershell
     curl.exe -s -o NUL -w "%{http_code}" -X POST https://<domínio da homologação>/api/webhooks/asaas -H "asaas-access-token: errado" -H "content-type: application/json" -d "{}"
     ```
  5. A documentação está fechada: `/api/docs` não abre.
  6. TLS antigo é recusado ([Segurança.NF004]). O `curl.exe` do Windows não serve para isso (o próprio
     Windows já recusa TLS 1.1), então o teste roda num contêiner. O OpenSSL novo também recusa TLS 1.1 por
     conta própria; o `@SECLEVEL=0` libera o cliente, para quem recusar ser **o servidor**. São dois comandos:
     ```powershell
     # Controle: TLS 1.2 tem de CONECTAR (aparece "Protocol version: TLSv1.2"; um aviso de verificação do
     # certificado não invalida o controle, porque a imagem pode não trazer as autoridades certificadoras).
     docker run --rm alpine/openssl:3.5.4 s_client -connect <domínio da homologação>:443 -tls1_2 -brief
     # O teste: TLS 1.1 tem de FALHAR com um alerta do servidor ("alert protocol version" ou "handshake failure").
     docker run --rm alpine/openssl:3.5.4 s_client -connect <domínio da homologação>:443 -tls1_1 -cipher 'DEFAULT@SECLEVEL=0' -brief
     ```
     Se o segundo falhar com "no protocols available", o problema é do cliente, e o teste não vale: confira
     o `-cipher`. Se a tag `3.5.4` da imagem não existir mais, use a mais recente de `alpine/openssl`.
  7. Bloqueio da conta depois de 5 senhas erradas, testado com um usuário de teste.
  8. Nenhum erro de CSP no console do navegador.
  9. Simulação do mês de virada (1.13).
  10. Alerta por e-mail: com o prazo do alerta em 12 h na tela de Administração, deixe a homologação 12 h
      sem pagamentos. O e-mail de webhook parado tem de chegar ao endereço de `EMAIL_ALERTAS_PARA`. Se não
      chegar, o log do worker diz o motivo.
- [ ] **3.6 Desligar a homologação entre validações.** O `app` já dorme sozinho (Serverless). Para o
  worker: [[worker › Deployments › ⋮ › Remove]]. Mantenha o deploy automático dele **ligado**: o próximo
  merge na `main` religa o worker sozinho, já no commit novo, junto com o `app`. É isso que garante que a
  diretoria valide o app e o worker da mesma versão. Depois da validação, remova a implantação de novo.

## Fase 4: backups e teste de restauração

- [ ] **4.1 Bucket R2:** Cloudflare › [[R2 Object Storage]] › ative o R2 (pede cartão; até 10 GB é
  grátis) › [[Create bucket]].
  - Nome `integracasd-backups`, Location Automatic, Standard.
  - Sem acesso público.
- [ ] **4.2 Apagar o que tiver mais de 35 dias:**
  [[integracasd-backups › Settings › Object lifecycle rules › Add rule]] → Delete objects after 35 days.
- [ ] **4.3 Credenciais:** [[R2 › Manage API tokens › Create API token]], duas vezes:
  - **"backup-railway": Object Read & Write**, só no bucket `integracasd-backups`. Vai só para o serviço
    `backup` da Railway.
  - **"restauracao": Object Read only**, só no mesmo bucket. É a que se usa no computador para restaurar
    (4.8). Assim, uma máquina comprometida não consegue apagar os backups.
  - Copie para o cofre, de cada uma: Access Key ID e Secret Access Key. Copie também o endpoint
    `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- [ ] **4.4 Monitores:** no Healthchecks.io, crie os checks "backup homologação" e "backup produção",
  com período de 1 dia e tolerância de 2 h. **Pause** o de produção até o 5.6.
- [ ] **4.5 Senhas do rclone.** Instale o rclone no Windows (`winget install Rclone.Rclone`). Os comandos
  abaixo geram a senha e o salt e mostram cada um junto da versão "obscurecida", que é a que vai para a
  Railway. Os valores ficam só em variáveis da sessão: **nada de senha escrita na linha de comando**, que
  ficaria gravada no histórico do PowerShell.
  ```powershell
  function NovoSegredo { $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join '' }
  $senha = NovoSegredo; $salt = NovoSegredo
  "senha (cofre):            $senha"
  "senha obscurecida (Railway): $($senha | rclone obscure -)"
  "salt (cofre):             $salt"
  "salt obscurecido (Railway):  $($salt | rclone obscure -)"
  Remove-Variable senha, salt
  ```
  Guarde **a senha e o salt originais** no cofre; as versões obscurecidas vão só para as variáveis do 4.6.
- [ ] **4.6 Serviço `backup` na homologação:** [[+ Create › GitHub Repo › ry7a/IntegraCASD]].
  1. Nome: **`backup`**.
  2. Build:
     - Dockerfile path `scripts/backup/Dockerfile` (ou a variável `RAILWAY_DOCKERFILE_PATH`);
     - Watch paths: `scripts/backup/**`.
  3. Deploy:
     - Cron Schedule `0 6 * * *` (a Railway usa UTC: 6h UTC = 3h em Brasília);
     - Restart policy **Never**;
     - mesma região.
  4. Variáveis:
     ```
     AMBIENTE=homologacao
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     BACKUP_PING_URL=<URL do check "backup homologação">
     RCLONE_CONFIG_R2_TYPE=s3
     RCLONE_CONFIG_R2_PROVIDER=Cloudflare
     RCLONE_CONFIG_R2_ACCESS_KEY_ID=<4.3>
     RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<4.3>
     RCLONE_CONFIG_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
     RCLONE_CONFIG_R2_ACL=private
     RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
     RCLONE_CONFIG_R2CIFRADO_TYPE=crypt
     RCLONE_CONFIG_R2CIFRADO_REMOTE=r2:integracasd-backups
     RCLONE_CONFIG_R2CIFRADO_FILENAME_ENCRYPTION=off
     RCLONE_CONFIG_R2CIFRADO_DIRECTORY_NAME_ENCRYPTION=false
     RCLONE_CONFIG_R2CIFRADO_PASSWORD=<senha obscurecida, 4.5>
     RCLONE_CONFIG_R2CIFRADO_PASSWORD2=<salt obscurecido, 4.5>
     ```
     As chaves aqui são as do token **backup-railway** (4.3).
  5. **Sele** (2.8) `RCLONE_CONFIG_R2_SECRET_ACCESS_KEY`, `RCLONE_CONFIG_R2CIFRADO_PASSWORD`,
     `RCLONE_CONFIG_R2CIFRADO_PASSWORD2` e `BACKUP_PING_URL`.
- [ ] **4.7 Testar agora:** rode o cron uma vez à mão, pelo botão de execução imediata do serviço cron
  (algo como **Run now**; se não houver, [[backup › Deployments › Deploy]]), e confira:
  - o arquivo aparece no bucket, em `homologacao/`;
  - o check do Healthchecks fica verde.
- [ ] **4.8 Teste de restauração** ([Confiabilidade.NF006], exigido antes da entrega). Com o Postgres
  local no ar (`docker compose up -d`), na raiz do repositório:
  1. Configure o rclone **só nesta janela do PowerShell**, com o token **só leitura** (4.3). Os valores são
     digitados sem aparecer e sem ir para o histórico, e nenhum arquivo de configuração é gravado no disco:
     ```powershell
     function Ler($texto) { $s = Read-Host $texto -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
     $env:RCLONE_CONFIG_R2_TYPE = 's3'
     $env:RCLONE_CONFIG_R2_PROVIDER = 'Cloudflare'
     $env:RCLONE_CONFIG_R2_NO_CHECK_BUCKET = 'true'
     $env:RCLONE_CONFIG_R2_ENDPOINT = Read-Host 'Endpoint do R2 (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)'
     $env:RCLONE_CONFIG_R2_ACCESS_KEY_ID = Read-Host 'Access Key ID do token "restauracao"'
     $env:RCLONE_CONFIG_R2_SECRET_ACCESS_KEY = Ler 'Secret Access Key do token "restauracao"'
     $env:RCLONE_CONFIG_R2CIFRADO_TYPE = 'crypt'
     $env:RCLONE_CONFIG_R2CIFRADO_REMOTE = 'r2:integracasd-backups'
     $env:RCLONE_CONFIG_R2CIFRADO_FILENAME_ENCRYPTION = 'off'
     $env:RCLONE_CONFIG_R2CIFRADO_DIRECTORY_NAME_ENCRYPTION = 'false'
     $env:RCLONE_CONFIG_R2CIFRADO_PASSWORD = (Ler 'Senha do rclone (a ORIGINAL, do cofre)') | rclone obscure -
     $env:RCLONE_CONFIG_R2CIFRADO_PASSWORD2 = (Ler 'Salt do rclone (o ORIGINAL, do cofre)') | rclone obscure -
     ```
  2. Veja os backups e baixe o mais recente. Ele chega decifrado e com o nome original:
     ```powershell
     rclone ls r2cifrado:homologacao
     rclone copy r2cifrado:homologacao/<arquivo>.dump .\backups\
     ```
  3. Restaure com `.\scripts\backup\restaurar-backup.ps1 -Arquivo .\backups\<arquivo>.dump`.
  4. Faça as três conferências de [backup-e-restauracao.md](backup-e-restauracao.md) e **registre na
     tabela de lá** (fecha a pendência da #52).
  5. **Limpe tudo.** O dump decifrado tem os dados do banco:
     ```powershell
     Remove-Item .\backups\integracasd-homologacao-*.dump, .\backups\integracasd-producao-*.dump
     docker compose exec -T db dropdb -U integracasd integracasd_restaurado
     Get-ChildItem Env:RCLONE_CONFIG_* | Remove-Item
     ```

## Fase 5: projeto de produção

Pré-requisito: a diretoria validou a homologação ([Hardware e software.NF004]).

- [ ] **5.1 Branch de produção.** A produção implanta só a branch `producao`, que aponta para o commit
  validado:
  ```powershell
  git fetch
  git push origin <sha validado>:refs/heads/producao
  ```
- [ ] **5.2 Projeto `integracasd-producao`:** repita a Fase 2 com estas diferenças:
  - **Banco novo.** Ele nunca recebe chave de sandbox: a tabela `clientes_asaas` não guarda o ambiente.
  - Branch **`producao`** no `app` e no `worker`. O Wait for CI pode ficar desligado, porque o commit
    já passou no CI na `main`.
  - **Serverless desligado** no `app`.
  - Segredos **novos** (2.7) e o domínio `integracasd.up.railway.app` (ou o nome que estiver livre).
  - No worker, `EMAIL_REMETENTE=IntegraCASD <onboarding@resend.dev>`, sem o "HOMOLOGACAO".
  - **Worker criado, mas sem implantação ativa** até o 6.7: depois de criar, use
    [[worker › Deployments › ⋮ › Remove]].
- [ ] **5.3 Primeiro usuário de produção:** o 3.2 **sem** a linha do `dados-ficticios`, com a
  `DATABASE_PUBLIC_URL` da produção. Entre no site e **troque a senha pela tela**. Em seguida, feche o
  banco para fora (5.7).
- [ ] **5.4 Teste de fumaça:**
  ```powershell
  curl.exe -s -o NUL -w "%{http_code} " https://<domínio da produção>/            # 200
  curl.exe -s -o NUL -w "%{http_code} " https://<domínio da produção>/cobrancas   # 200
  curl.exe -s https://<domínio da produção>/api/saude                               # 200
  curl.exe -s https://<domínio da produção>/api/saude/completa                      # 503 até o 6.7
  ```
- [ ] **5.5 Monitor de disponibilidade:** no UptimeRobot, crie um monitor HTTP(s) em
  `https://<domínio da produção>/api/saude/completa`, a cada 5 minutos, com alertas para o e-mail do 0.2
  e para a diretoria. Deixe **pausado** até o 6.7.
- [ ] **5.6 Backup da produção:** serviço `backup` como no 4.6, com estas diferenças:
  - branch **`producao`** em [[backup › Settings › Source]], para a imagem do backup também só mudar depois
    de validada;
  - `AMBIENTE=producao` e a URL do check "backup produção" (despause o check);
  - selar as variáveis secretas, como no 4.6.

  Rode uma vez à mão (como no 4.7) e confira o arquivo em `producao/`.
- [ ] **5.7 Fechar o banco para fora.** Logo depois do 5.3, remova o acesso público do banco em
  [[Postgres › Settings › Networking › TCP Proxy]]. Ele só é reaberto no 6.4, para a carga, e fechado logo
  depois dela. Se a conferência (6.5) pedir correção direto no banco, reabra só durante a correção.

## Fase 6: Asaas real e carga inicial

Siga junto o [`scripts/carga-inicial/README.md`](../../scripts/carga-inicial/README.md). Pré-requisito:
as decisões 1.8 e 1.13 tomadas e já implantadas.

> **Do 6.1 ao 6.7, o worker de produção fica desligado.** Com a chave e os parâmetros cadastrados,
> ligá-lo dispara cobranças reais antes da conferência. Nesse intervalo, **não avance a branch
> `producao`, não altere variáveis do `worker` e não clique em Deploy nele**: qualquer uma dessas ações
> cria uma implantação e liga o worker.

- [ ] **6.1 Chave de produção:**
  1. No Asaas real: [[Integrações › Chaves de API › Gerar chave]].
  2. No sistema: [[Administração › Integração Asaas]], **Produção**.
- [ ] **6.2 Webhook de produção:** como no 3.4, com a URL da produção e o `ASAAS_WEBHOOK_TOKEN` de
  produção. Teste o token errado (3.5, item 4): tem de dar 401.
- [ ] **6.3 Gerar o SQL da carga** na sua máquina, conforme o README. O `--hoje` tem de bater com o mês
  de virada.
- [ ] **6.4 Aplicar a carga** pelo endereço público do banco. Reabra o TCP Proxy (5.7) e copie a
  `DATABASE_PUBLIC_URL`, que muda a cada reabertura.

  Antes, confira que o `carga.sql` foi gerado **depois** da correção da trilha (item 1.8). Um arquivo
  antigo grava o nome de cada aluno na trilha, e isso não sai mais. O comando abaixo **não pode
  encontrar nada**; se encontrar, gere de novo (6.3):
  ```powershell
  Select-String -Path .\scripts\carga-inicial\dados\carga.sql -SimpleMatch 'Aluno "'
  ```
  O arquivo é montado no contêiner, o que evita problemas de acento no PowerShell:
  ```powershell
  $url = Read-Host "Cole a DATABASE_PUBLIC_URL da produção"
  docker run --rm -v "${PWD}\scripts\carga-inicial\dados:/dados" postgres:18.6 psql $url -v ON_ERROR_STOP=1 -f /dados/carga.sql
  Remove-Variable url
  ```
  O arquivo tem dados reais: apague-o depois da conferência. A carga pode ser repetida sem duplicar.
  Terminada a carga, **feche o TCP Proxy de novo** (5.7).
- [ ] **6.5 Conferência e aprovação** da área administrativa ([Distribuição.NF002]).
- [ ] **6.6 Parâmetros de cobrança**, com o dia de geração combinado no 1.13.
- [ ] **6.7 Ligar o worker:** [[worker › Deployments › Deploy]]. Confira os logs. Em até 30 min,
  `/api/saude/completa` responde 200. Então despause o monitor do UptimeRobot.
- [ ] **6.8 Backup logo após a carga:** rode o cron à mão (como no 4.7) e confira no R2.
- [ ] **6.9 Banco fechado:** confira que o TCP Proxy foi removido depois da carga (5.7).

## Fase 7: domínio próprio (quando o CASD tiver)

- [ ] **7.1 Registrar** `<nome>.org.br` no registro.br, no CNPJ do CASD (~R$ 40/ano). O `.org.br` exige
  CNPJ de entidade sem fins lucrativos; se der problema, use `.com.br`.
- [ ] **7.2 Domínio no `app` de produção:**
  1. [[app › Settings › Networking › Custom Domain]] → `financeiro.<domínio>`, porta 3000.
  2. A Railway mostra um **CNAME**, e às vezes também um TXT de verificação.
- [ ] **7.3 DNS no registro.br:**
  1. [[Painel › domínio › DNS › Editar zona]] (use os servidores DNS do próprio registro.br).
  2. Crie o CNAME `financeiro` apontando para o valor da Railway, e o TXT, se ela pediu.
  3. Espere a Railway mostrar o domínio como ativo, com certificado.
- [ ] **7.4 Atualizar o que usa o endereço:**
  - URL do webhook no Asaas (6.2);
  - monitor do UptimeRobot;
  - favoritos da diretoria.

  Os usuários precisam entrar de novo, porque o cookie é do endereço antigo.
- [ ] **7.5 E-mail com o domínio:** verifique o domínio no Resend (registros TXT/MX no registro.br),
  troque o `EMAIL_REMETENTE` do worker para `IntegraCASD <alertas@<domínio>>` e **apague
  `EMAIL_ALERTAS_PARA`**: a partir daí os alertas vão para todos os usuários ativos da diretoria.

## Depois do ar

### Implantar uma versão nova

1. Integre na `main` como sempre. A homologação implanta sozinha, `app` e `worker`, depois do CI verde.
   Antes de validar, confira em [[Deployments]] que os dois estão no mesmo commit (o hash aparece em cada
   implantação).
2. A diretoria valida na homologação.
3. Promova **o mesmo commit** para a produção:
   ```powershell
   git fetch
   git push origin <sha validado>:refs/heads/producao
   ```
4. Acompanhe em [[app › Deployments]]: pre-deploy (migrações), saúde verde. Depois confira os logs do
   worker. O worker implanta em paralelo com o app e não roda as migrações: num commit com migração nova,
   ele pode reiniciar uma ou duas vezes até o app terminar de migrar (a regra B7 garante que a migração
   só "expande"). Confira que ele estabilizou. Anote a versão na issue da entrega.

### Voltar para a versão anterior ([Distribuição.NF003]: até 30 min)

1. [[app › Deployments]] → no deployment anterior, [[⋮ › Rollback]]. Faça o mesmo no `worker`.
2. Depois, volte também a branch para o commit anterior, para a próxima implantação não desfazer o
   rollback:
   ```powershell
   git push --force-with-lease origin <sha anterior>:refs/heads/producao
   ```

Voltar o código não desfaz migração. Só é seguro se as migrações novas foram do tipo "expandir" (regra
B7). Senão, restaure o backup feito antes. Leia também as Consequências do ADR-0005.

### Operação

- **Toda semana:**
  - os dois checks do Healthchecks verdes;
  - o gasto em [[Workspace › Usage]];
  - os logs do worker sem erros repetidos.
- **Todo mês:**
  - teste de restauração do último backup de produção (4.8, com `producao` no lugar de `homologacao`),
    registrado em backup-e-restauracao.md, **incluindo a limpeza do passo 5**;
  - relatório do UptimeRobot (meta: 99%).
- **Nunca:**
  - trocar a `CHAVE_DE_CIFRAGEM` em uso;
  - deixar o TCP Proxy do banco aberto sem necessidade;
  - rodar `dados-ficticios` ou `migrate reset` em produção;
  - ligar Serverless no `app` ou no `worker` de produção.

### Incidentes

- **Site fora do ar:** veja [[app › Deployments › View logs]] e o status da Railway (status.railway.com).
  Se um deploy quebrou, faça o rollback.
- **Fila do Asaas pausada** (15 falhas seguidas):
  1. Corrija a causa.
  2. Reative em [[Integrações › Webhooks]].
  3. Rode [[Cobranças › Sincronizar]].
- **Banco perdido ou corrompido:**
  1. Crie um Postgres novo no projeto.
  2. Baixe o último dump como no 4.8 (passos 1 e 2, com `producao`) e restaure pelo endereço público do
     banco novo:
     ```powershell
     $url = Read-Host "Cole a DATABASE_PUBLIC_URL do banco novo"
     docker run --rm -v "${PWD}\backups:/dados" postgres:18.6 pg_restore --no-owner --exit-on-error -d $url /dados/<arquivo>.dump
     Remove-Variable url
     ```
     Depois, apague o dump e a configuração do rclone, e feche o TCP Proxy do banco novo:
     ```powershell
     Remove-Item .\backups\integracasd-producao-*.dump
     Get-ChildItem Env:RCLONE_CONFIG_* | Remove-Item
     ```
  3. Aponte `DATABASE_URL` do `app`, do `worker` e do `backup` para o novo
     (`${{<NomeDoNovo>.DATABASE_URL}}`).
  4. Reimplante.
  5. Rode a sincronização com o Asaas para o período desde o backup.
- **Gasto alto:** veja qual serviço em [[Workspace › Usage]]. A homologação esquecida ligada é o
  suspeito número um (3.6).

## Referências

- [ADR-0006: hospedagem na Railway](../adr/0006-hospedagem-na-railway.md)
- [Backup e restauração](backup-e-restauracao.md)
- [Documentação da Railway](https://docs.railway.com)
- [Asaas: webhooks](https://docs.asaas.com)

# ADR-0006: Hospedagem na Railway

- **Status:** Proposta
- **Data:** 2026-11-07
- **Decisores:** Ryaj (aguarda a equipe)
- **Requisitos relacionados:** [Hardware e software.NF001], [Hardware e software.NF002],
  [Hardware e software.NF004], [Segurança.NF004], [Confiabilidade.NF001], [Confiabilidade.NF006],
  [Distribuição.NF003], [Padrões.NF001]

## Contexto

O sistema precisa de um lugar para rodar em produção e em homologação (issues #48, #49 e #52). O
requisito [Hardware e software.NF001] deixou a escolha para um ADR. O texto cita o ADR-0003, mas esse
número acabou usado para as funções de aptidão, e este é o ADR da hospedagem.

O que a hospedagem precisa atender:

- **Processos sempre ligados.** A API recebe o webhook do Asaas a qualquer hora, e o worker do pg-boss
  roda a fila e as rotinas agendadas ([Confiabilidade.NF001]: 99% ao mês).
- **PostgreSQL 18** para dados e fila (ADR-0002), com backup diário retido por 30 dias
  ([Confiabilidade.NF006]).
- **Endereço público, estável e com HTTPS** para usuários e webhook ([Segurança.NF004]).
- **Mesma origem para o site e a API.** O frontend chama `/api/...` por caminho relativo, com
  `credentials: 'same-origin'`, e o cookie de sessão é `SameSite=Strict` com `path=/api`.
- **Contêineres** ([Hardware e software.NF002]) e uma homologação equivalente à produção
  ([Hardware e software.NF004]).
- **Custo baixo.** A gestão aceita cerca de R$ 50 a R$ 70 por mês.
- **Pouca operação.** São 4 alunos aprendendo TypeScript, com um MVP de 2 meses e uma gestão que muda
  todo ano. Ninguém deve precisar administrar servidor.
- **O CASD ainda não tem domínio próprio.**

## Decisão

Vamos hospedar tudo na **Railway**, no plano Hobby, com **dois projetos separados**:
`integracasd-homologacao` e `integracasd-producao`.

- **Serviços em cada projeto:**
  - `Postgres`: PostgreSQL 18, com volume persistente.
  - `app`: a API NestJS, que **também serve o site** (o build do Vite). Assim, site e API ficam no mesmo
    endereço sem precisar de um proxy à parte. Tem domínio público, verificação de saúde e
    `prisma migrate deploy` como comando de pré-implantação.
  - `worker`: a mesma imagem do `app`, com o comando `node dist/main-worker.js` e sem domínio.
  - `backup`: um cron diário que faz `pg_dump` e envia a cópia, cifrada, para fora da Railway.
- **Build pelo `Dockerfile` da raiz**, a partir do GitHub. A homologação implanta cada commit da
  `main` que passa no CI. A produção implanta a branch `producao`, que só avança para um commit já
  validado na homologação.
- **Endereço:** começamos no domínio gratuito da Railway (`*.up.railway.app`), com HTTPS. Quando o CASD
  registrar um domínio (`.org.br` no registro.br, no CNPJ do CASD), ele vira um subdomínio como
  `financeiro.<domínio>` apontado para a Railway.
- **Backup fora da Railway:** o cron envia o dump para um bucket do Cloudflare R2, gratuito até 10 GB,
  cifrado com rclone crypt e retido 35 dias. É a única peça fora da Railway, de propósito: um backup
  no mesmo provedor do banco não protege contra perder a conta ou o projeto.
- **Monitoramento externo e gratuito:** UptimeRobot vigia o site e Healthchecks.io vigia o backup.
  Quem vigia precisa estar fora de quem é vigiado.
- **Contas, cartão e domínio em nome do CASD**, com acesso de pelo menos duas pessoas.

O passo a passo está em [`docs/playbooks/implantacao.md`](../playbooks/implantacao.md).

## Alternativas consideradas

### Alternativa 1: VM gratuita da Oracle Cloud (Always Free) atrás da Cloudflare

- **Prós:** custo zero; dados em São Paulo.
- **Contras:**
  - Nós administramos o servidor: sistema, Docker, disco e backup.
  - A Oracle pode recuperar uma VM ociosa, e um sistema pequeno como o nosso se encaixa nisso.
  - Falta capacidade com frequência.
  - A primeira implantação leva 1 a 2 dias.
  - O Cloudflare Tunnel exige domínio próprio, que o CASD ainda não tem.
- **Por que não:** risco operacional e trabalho de servidor que a equipe e as próximas gestões teriam
  de carregar, para economizar cerca de R$ 50 por mês.

### Alternativa 2: VPS pago (Hostinger KVM 2 ou parecido)

- **Prós:** máquina garantida; data center em São Paulo.
- **Contras:** os mesmos de administrar servidor. Preço parecido com a Railway na promoção (cerca de
  R$ 43 por mês, pagos de uma vez por 24 meses), mas perto de R$ 78 por mês na renovação.
- **Por que não:** custa o mesmo ou mais e dá mais trabalho.

### Alternativa 3: tudo na Cloudflare, reescrevendo o backend (Workers, D1, Queues)

- **Prós:** cerca de US$ 5 por mês.
- **Contras:** troca NestJS, Prisma com PostgreSQL e pg-boss, fixados no `CLAUDE.md` e nos ADRs 0001 e
  0002. O D1 não tem transação interativa, e a baixa atômica depende disso.
- **Por que não:** semanas de reescrita no meio do MVP.

### Alternativa 4: máquina do CASD ou do ITA

- **Prós:** custo zero.
- **Contras:** depende de energia, rede e de ninguém desligar a máquina.
- **Por que não:** não sustenta os 99% de disponibilidade do webhook.

## Consequências

**Positivas:**

- Nenhum servidor para administrar. Cada implantação é um `git push`.
- Começa a funcionar sem domínio próprio.
- O código atual roda como está. Só faltam os ajustes de produção listados no playbook.
- Voltar para uma implantação anterior é um botão no painel da Railway ([Distribuição.NF003]).
- A Railway bloqueia SMTP nos planos baratos. Isso não nos afeta: o e-mail sai pela API HTTP do Resend
  (exceção B4).

**Negativas e riscos:**

- **Custo variável.** A estimativa é de US$ 8 a 10 por mês na produção, mais US$ 2 a 4 na homologação
  se ela ficar quase sempre desligada, cobrados em dólar no cartão do CASD. Mitigação: um alerta de
  gasto e um teto na conta da Railway.
- **Dados fora do Brasil.** As regiões da Railway ficam nos EUA, na Europa e na Ásia. Isso configura
  transferência internacional de dados pessoais ([Padrões.NF001]) e deve constar do registro de
  tratamento do CASD. A latência para o Brasil fica em torno de 120 a 200 ms, o que é aceitável para
  o uso interno e para o webhook.
- **Sem WAF nem limite por IP na frente.** A proteção contra força bruta é a da própria API: bloqueio
  da conta depois de 5 senhas erradas. Se o domínio próprio vier com a Cloudflare na frente, dá para
  somar as regras dela depois.
- **Dependência de um fornecedor.** Se a Railway mudar preço ou regras, a saída é o mesmo `Dockerfile`
  em outra plataforma, mais o backup no R2.

**Quando revisitar:**

- Se a conta mensal passar de R$ 100.
- Se a disponibilidade medida ficar abaixo de 99% num mês.
- Se a LGPD ou a diretoria exigirem dados hospedados no Brasil.

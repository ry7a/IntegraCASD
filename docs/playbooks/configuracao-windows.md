# IntegraCASD — Playbook de configuração (Windows)

> Última atualização: 21/10/2026. Se algo aqui estiver desatualizado, corrija no mesmo commit em que você descobriu.

Este guia leva uma máquina Windows do zero até o IntegraCASD rodando. Siga as etapas na ordem: cada uma termina com uma verificação, e só vale passar para a próxima quando ela der certo.

## 0. Antes de começar

Reserve cerca de uma hora e tenha à mão três coisas:

- **Permissão de administrador** no computador. Vários passos pedem o PowerShell aberto como administrador.
- **Acesso ao repositório** no GitHub. Peça o convite a quem administra o projeto.
- **Os valores do `.env`**: a chave do sandbox do Asaas (`ASAAS_API_KEY`) e o token do webhook (`ASAAS_WEBHOOK_TOKEN`). Peça a quem administra; eles nunca ficam no repositório. O `SESSION_SECRET` e a `CHAVE_DE_CIFRAGEM` você mesmo gera, na etapa 2.3.

Confira também se a **virtualização está ativa**, porque o Docker depende dela: abra o Gerenciador de Tarefas, vá em **Desempenho › CPU** e veja, no canto inferior direito, se aparece **Virtualização: Habilitado**. Se aparecer "Desabilitado", ela precisa ser ligada na BIOS do computador antes de seguir.

Todos os comandos deste guia são para o **PowerShell**. Para abri-lo, aperte a tecla Windows, digite "PowerShell" e dê Enter. Quando o passo pedir **como administrador**, clique com o botão direito no ícone e escolha "Executar como administrador".

## 1. Instalar as ferramentas

A ordem importa: Node antes do pnpm, e o pnpm só depois de reabrir o terminal.

### 1.1 Git e VS Code

```powershell
winget install --id Git.Git
winget install --id Microsoft.VisualStudioCode
```

Depois, configure seu nome e e-mail no Git (os mesmos da conta do GitHub):

```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

### 1.2 Node.js 24.20.0

Use exatamente esta versão; é a que a equipe toda usa.

```powershell
winget install --id OpenJS.NodeJS.LTS --version 24.20.0
```

Se você já tinha outro Node instalado, troque `install` por `upgrade`. **Feche e abra o PowerShell** e confira:

```powershell
node --version
Get-Command node | Select-Object Source
```

O primeiro deve mostrar `v24.20.0`. O segundo deve mostrar `C:\Program Files\nodejs\node.exe`. Se aparecer um caminho com `anaconda3` ou `miniconda3`, o Node do Anaconda está na frente; veja a seção de problemas comuns.

### 1.3 pnpm

O pnpm vem junto com o Node, por uma ferramenta chamada Corepack. Num PowerShell **como administrador**:

```powershell
corepack enable
corepack prepare pnpm@11.28.5 --activate
pnpm --version
```

Deve aparecer `11.28.5`. Nunca instale dependências do projeto com `npm`: use sempre `pnpm`.

### 1.4 Docker Desktop

```powershell
winget install --id Docker.DockerDesktop
```

1. **Reinicie o computador.**
2. Abra o **Docker Desktop** pelo menu Iniciar e aceite os termos. Na primeira vez, ele configura o WSL 2 (o subsistema Linux do Windows), o que pode levar alguns minutos.
3. Espere o ícone da baleia na barra de tarefas parar de se mexer.

Confira:

```powershell
docker --version
wsl --status
```

Se o `wsl --status` reclamar que o WSL não está instalado ou está desatualizado, rode `wsl --update` como administrador e reinicie de novo.

## 2. Preparar o projeto

### 2.1 Clonar o repositório

Escolha uma pasta sem espaços nem acentos no caminho, se possível, e clone:

```powershell
cd C:\Users\SEU_USUARIO\Projetos
git clone https://github.com/ry7a/IntegraCASD IntegraCASD
cd IntegraCASD
code .
```

O `code .` abre o projeto no VS Code. Daqui em diante, dá para usar o terminal integrado do VS Code (**Ctrl + '**), que já abre na raiz do projeto.

### 2.2 Instalar as dependências

Sempre na **raiz** do projeto, nunca dentro de `apps/api` ou `apps/web`:

```powershell
pnpm install
```

Esse comando instala as bibliotecas das duas aplicações de uma vez, exatamente nas versões do `pnpm-lock.yaml`.

### 2.3 Criar o `.env`

```powershell
Copy-Item .env.example .env
```

Abra o `.env` no VS Code e preencha com os valores que você pediu na etapa 0 (`ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`). **Nunca faça commit do `.env`**: o `.gitignore` já o protege, mas não force a inclusão.

O `SESSION_SECRET` é um valor aleatório longo que você inventa. Para gerar um, rode isto e cole o resultado no `.env`:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

A `CHAVE_DE_CIFRAGEM` protege a chave do Asaas que a diretoria cadastra na tela de Administração: ela é guardada cifrada no banco, e só esta chave a decifra. Precisa ter exatamente 32 bytes; gere com:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Se você trocar a `CHAVE_DE_CIFRAGEM` depois de cadastrar uma chave do Asaas na tela, a chave guardada deixa de ser lida e precisa ser cadastrada de novo. Enquanto não houver chave cadastrada na tela, o sistema usa a `ASAAS_API_KEY` do `.env` (é o normal no desenvolvimento).

### 2.4 Subir o banco de dados

Com o Docker Desktop aberto:

```powershell
docker compose up -d
docker compose ps
```

O serviço `db` deve aparecer como `running`. Para confirmar que o banco responde:

```powershell
docker compose exec db psql -U integracasd -c "SELECT version();"
```

Deve aparecer uma linha começando com `PostgreSQL 18.6`.

### 2.5 Criar as tabelas e carregar dados fictícios

O banco recém-criado está vazio. Aplique as migrações para criar as tabelas e, em seguida, carregue alguns alunos fictícios para a tela de alunos ter o que mostrar:

```powershell
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dados-ficticios
```

O primeiro comando lê o `DATABASE_URL` do `.env` e aplica as migrações de `apps/api/prisma/migrations`. O segundo pode ser repetido à vontade: o que já existe não é duplicado. Quando alguém adicionar uma migração nova, rode o primeiro de novo.

### 2.6 Rodar a API e o frontend

Abra **dois terminais** na raiz e rode um comando em cada:

```powershell
pnpm dev:api
```

```powershell
pnpm dev:web
```

- A API responde em `http://localhost:3000/api` (todas as rotas começam com `/api`). A documentação navegável fica em `http://localhost:3000/api/docs`.
- O frontend abre em `http://localhost:5173`.

Os dois recarregam sozinhos quando você salva um arquivo. Para parar, use **Ctrl + C** em cada terminal.

## 3. Extensões do VS Code

Instale pela aba de extensões (**Ctrl + Shift + X**), buscando pelo nome:

| Extensão                  | Para quê                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| ESLint                    | Mostra os avisos do linter direto no código, enquanto você digita     |
| Prettier - Code formatter | Formata o código ao salvar, todo mundo no mesmo padrão                |
| Prisma                    | Destaque de sintaxe e autocompletar no `schema.prisma`                |
| Tailwind CSS IntelliSense | Autocompletar das classes do Tailwind no frontend                     |
| Container Tools           | Ver e controlar os contêineres do Docker sem sair do editor           |
| Draw.io Integration       | Abrir e editar os diagramas de `docs/arquitetura/` no próprio VS Code |

Para formatar ao salvar, abra as configurações (**Ctrl + ,**), busque **Format On Save** e marque a opção.

## 4. Checklist final

Sua máquina está pronta quando todos os itens estiverem marcados:

- [ ] `node --version` mostra `v24.20.0`
- [ ] `pnpm --version` mostra `11.28.5`
- [ ] `docker compose ps` mostra o `db` como `running`
- [ ] `pnpm --filter api exec prisma migrate deploy` termina sem erro
- [ ] `http://localhost:3000/api` mostra `Hello World!` e `http://localhost:3000/api/alunos` lista os alunos fictícios em JSON
- [ ] `http://localhost:5173` abre o frontend e a lista de alunos mostra os alunos fictícios
- [ ] `pnpm lint`, `pnpm test` e `pnpm build` passam na raiz (hoje só a API tem testes; o frontend ainda não tem)
- [ ] Você criou uma branch de teste, fez um commit e enviou a branch ao GitHub (`git push -u origin <nome-da-branch>`)

O último item confirma que seu acesso ao repositório e sua configuração do Git estão certos. Depois, apague a branch de teste sem fazer merge.

Se algo deu errado e não está na próxima seção, anote o erro completo e a solução quando encontrar, e acrescente aqui. O próximo a configurar agradece.

## 5. Problemas comuns

Todos estes aconteceram de verdade na primeira configuração do projeto.

| Sintoma                                                               | Causa                                                               | Solução                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `winget` diz "Nenhuma versão correspondente foi encontrada"           | O catálogo do winget ainda não tem a versão pedida                  | Rode `winget show --id OpenJS.NodeJS.LTS --versions` e avise a equipe; todos devem usar a mesma versão                    |
| `node --version` mostra a versão antiga depois de atualizar           | O terminal ainda carrega o caminho antigo                           | Feche e abra o PowerShell                                                                                                 |
| `Get-Command node` aponta para `anaconda3`                            | O Node do Anaconda está na frente do oficial                        | Rode `conda remove nodejs` no ambiente `base` e reabra o terminal                                                         |
| `corepack enable` dá erro `EPERM`                                     | Falta permissão para criar arquivos na pasta do Node                | Rode o comando num PowerShell como administrador                                                                          |
| `pnpm` não é reconhecido depois do Corepack                           | Terminal aberto antes da ativação                                   | Feche e abra o PowerShell                                                                                                 |
| Docker: `error during connect` ou menção a `dockerDesktopLinuxEngine` | O Docker Desktop não está aberto                                    | Abra o Docker Desktop e espere a baleia parar de se mexer                                                                 |
| Docker não inicia ou fala de WSL ou virtualização                     | WSL 2 desatualizado ou virtualização desligada                      | `wsl --update` como administrador, reiniciar e conferir a virtualização (etapa 0)                                         |
| PostgreSQL: erro dizendo que há dados em `/var/lib/postgresql/data`   | Volume no caminho antigo; o PostgreSQL 18 usa `/var/lib/postgresql` | Corrija o volume no `docker-compose.yml` e rode `docker compose down -v` (apaga os dados locais) e `docker compose up -d` |
| `port is already allocated` na porta 5434                             | Outro programa já usa a porta 5434                                  | Troque a porta da esquerda em `"5434:5432"` no `docker-compose.yml` e ajuste a porta no `DATABASE_URL` do `.env`          |
| Prisma: `P1000 Authentication failed`                                 | Um PostgreSQL instalado no Windows responde na porta do `.env`      | O projeto usa a 5434 para fugir de 5432/5433; confira com `Get-NetTCPConnection -LocalPort 5434 -State Listen`            |
| pnpm diz que o manifesto deve se chamar `pnpm-workspace.yaml`         | Arquivo criado com a extensão `.yml`                                | Renomeie para `.yaml`                                                                                                     |
| Git mostra alterações em arquivos que ninguém mexeu                   | Quebras de linha do Windows (CRLF)                                  | Confira se o `.gitattributes` está na raiz e rode `git add --renormalize .`                                               |

## 6. Comandos do dia a dia

Todos na raiz do projeto.

| Quando                            | Comando                                        |
| --------------------------------- | ---------------------------------------------- |
| Começar o dia: atualizar a `main` | `git switch main`, `git pull` e `pnpm install` |
| Alguém adicionou uma biblioteca   | `pnpm install`                                 |
| Alguém adicionou uma migração     | `pnpm --filter api exec prisma migrate deploy` |
| Subir o banco                     | `docker compose up -d`                         |
| Rodar a API                       | `pnpm dev:api`                                 |
| Rodar o frontend                  | `pnpm dev:web`                                 |
| Começar uma tarefa                | `git switch -c feat/descricao-curta`           |
| Antes do merge na `main`          | `pnpm lint`, `pnpm test` e `pnpm build`        |
| Desligar o banco no fim do dia    | `docker compose stop`                          |

O fluxo completo de branches, commits e merge na `main` está no [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

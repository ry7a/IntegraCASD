# IntegraCASD

Sistema de gestão financeira e administrativa do **Centro Acadêmico Santos Dumont (CASD)**. Centraliza em um só lugar o que hoje vive em planilhas separadas: cadastro de alunos, contratos e projetos, emissão e conciliação automática de cobranças pelo Asaas, registro de movimentações e indicadores financeiros.

Projeto da disciplina CSI-28 do Departamento de Ciência da Computação do ITA.

## Stack

| Camada         | Tecnologia                                                |
| -------------- | --------------------------------------------------------- |
| Linguagem      | TypeScript 6.0.3 (frontend e backend)                     |
| Backend        | NestJS 12, Prisma 7.10.0, pg-boss 12                      |
| Banco de dados | PostgreSQL 18                                             |
| Frontend       | React 19, Vite 8, TanStack Query 5, shadcn/ui, Tailwind 4 |
| Integração     | Asaas (cobranças e webhooks)                              |
| Ferramentas    | Node.js 24.20.0, pnpm 11.28.5, Docker                     |

As justificativas de cada escolha estão em [`docs/adr/`](docs/adr/).

## Pré-requisitos (Windows)

Instale nesta ordem. Os comandos são para o PowerShell.

1. **Git** e **VS Code**.
2. **Node.js 24.20.0**:
   ```powershell
   winget install --id OpenJS.NodeJS.LTS --version 24.20.0
   ```
3. **pnpm**, num PowerShell aberto **como administrador**:
   ```powershell
   corepack enable
   corepack prepare pnpm@11.28.5 --activate
   ```
4. **Docker Desktop** (requer virtualização ativa e WSL 2). Depois de instalar, reinicie o computador e abra o Docker Desktop uma vez.

Confira tudo, num PowerShell novo:

```powershell
node --version     # v24.20.0
pnpm --version     # 11.28.5
docker --version
```

## Rodando o projeto

```powershell
git clone <url-do-repositorio>
cd IntegraCASD
pnpm install
Copy-Item .env.example .env      # depois preencha o .env
docker compose up -d             # sobe o PostgreSQL
```

Em dois terminais separados:

```powershell
pnpm dev:api     # http://localhost:3000
pnpm dev:web     # http://localhost:5173
```

## Estrutura

```
apps/
  api/                  backend NestJS (API e worker)
  web/                  frontend React
packages/
  api-client/           cliente da API gerado automaticamente
scripts/
  carga-inicial/        importação das planilhas (Python, roda uma vez)
docs/
  requisitos/           documento de requisitos
  adr/                  decisões de arquitetura
  arquitetura/          diagramas
```

## Problemas comuns

| Sintoma                                                                        | Solução                                                                                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `corepack enable` dá erro `EPERM`                                              | Abra o PowerShell como administrador.                                                                          |
| `node --version` mostra versão antiga depois de atualizar                      | Feche e abra o terminal. Se persistir, rode `Get-Command node` e confira se o Node não vem do Anaconda.        |
| Erro dizendo que o manifesto do workspace deve se chamar `pnpm-workspace.yaml` | O arquivo foi criado como `.yml`; renomeie para `.yaml`.                                                       |
| Docker não inicia                                                              | Confira em Gerenciador de Tarefas › Desempenho › CPU se a virtualização está habilitada e rode `wsl --status`. |
| Git mostra arquivos alterados que ninguém mexeu                                | Quebras de linha: confira se o `.gitattributes` está na raiz e rode `git add --renormalize .`                  |

## Regras importantes

- **Nunca coloque planilhas ou dados reais de alunos no repositório**. O `.gitignore` bloqueia planilhas; use só dados fictícios em testes.
- **Segredos ficam no `.env`**, que não é versionado. Use o `.env.example` como referência.
- **Instale dependências sempre pela raiz** com `pnpm`, nunca com `npm`.
- Toda mudança entra por pull request revisado por outra pessoa. Veja o [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Equipe

- João Gabriel de Magalhães Gonzaga
- Gabriel Negreiro Oliveira
- Marcello Ryaj de Almeida Santos
- Mateus Levi Morais Feitosa

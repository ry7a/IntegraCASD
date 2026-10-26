# IntegraCASD

Sistema de gestão financeira do Centro Acadêmico Santos Dumont (CASD): cadastros, cobranças de alunos via Asaas, conciliação automática de pagamentos, movimentações e indicadores. Projeto acadêmico de 4 alunos do ITA, com MVP em 2 meses.

## Como trabalhar com esta equipe

- Responda sempre em português.
- A equipe está **aprendendo TypeScript** (todos vêm de Python). Prefira código simples e explícito a soluções engenhosas. Ao introduzir um padrão novo, explique em uma ou duas frases o porquê.
- **Não adicione dependências novas** nem atualize versões sem perguntar antes.
- Faça mudanças pequenas e focadas. Uma tarefa por vez.
- O ambiente é **Windows com PowerShell**. Dê comandos compatíveis com PowerShell, não com bash.

## Stack (versões fixadas, não alterar)

- Node.js 24.20.0, pnpm 11.28.5 (monorepo com workspaces), TypeScript **6.0.3** (não usar o 7: quebra a CLI do NestJS).
- Backend: NestJS 12, Prisma **7.10.0**, PostgreSQL 18, pg-boss 12 (fila e agendamento dentro do PostgreSQL).
- Frontend: React 19, Vite 8, React Router 8, TanStack Query 5, React Hook Form + Zod 4, shadcn/ui + Tailwind 4.
- Contrato: OpenAPI gerado pelo NestJS; cliente do frontend gerado pelo orval.
- Testes: Vitest.

Atenção: ao instalar o Prisma, use sempre a versão explícita (`prisma@7.10.0`). A tag `latest` do pacote `prisma` aponta para uma versão RC.

## Estrutura

```
apps/api/            NestJS: API HTTP (main.ts) e worker (main-worker.ts), mesmo código
apps/web/            SPA React + Vite
packages/api-client/ cliente da API gerado pelo orval (não editar à mão)
scripts/carga-inicial/ script Python que importa as planilhas, roda uma vez
docs/requisitos/     documento de requisitos (referências como [Cobranças.RF005])
docs/adr/            registros de decisões de arquitetura
docs/arquitetura/    diagramas C4, de sequência e o MER (.drawio com o .svg exportado ao lado)
docs/playbooks/      passo a passo de configuração da máquina
data/                planilhas reais do CASD, fora do git (*.xlsx no .gitignore)
```

As planilhas de `data/` têm dados reais de alunos e funcionários: servem só para leitura e
análise local. Nunca copie o conteúdo delas (nomes, CPFs, descrições) para código, testes,
documentação ou mensagens de commit.

Para exportar um diagrama depois de editar o `.drawio` (draw.io desktop instalado):
`& "C:\Program Files\draw.io\draw.io.exe" -x -f svg -o diagrama.svg diagrama.drawio`.

Cada aplicação tem o próprio `CLAUDE.md` com regras específicas.

## Comandos (rodar na raiz)

```powershell
pnpm install                 # instala tudo
docker compose up -d         # sobe o PostgreSQL
pnpm dev:api                 # API em http://localhost:3000
pnpm dev:web                 # frontend em http://localhost:5173
pnpm dev:worker              # worker (fila do pg-boss), sem porta HTTP
pnpm --filter api test       # testes do backend
pnpm --filter web lint       # lint do frontend
pnpm --filter api dados-ficticios  # popula o banco local com dados fictícios
pnpm gerar:cliente-api       # regenera packages/api-client depois de mudar controller ou DTO
pnpm verificar:arquitetura   # funções de aptidão (migrações imutáveis, cores)
pnpm verificar:contrato      # falha se o cliente da API estiver desatualizado
```

Lint, testes e `verificar:arquitetura` também rodam sozinhos nos ganchos do git
(`.githooks/pre-merge-commit` e `pre-push`, ativados pelo `pnpm install`).

## Arquitetura: regras que não se quebram

Monólito modular. Detalhes e justificativas em `docs/adr/`.

1. **Módulos com fronteiras.** Backend dividido em Cadastros, Cobranças, Movimentações, Indicadores e Administração. Um módulo só usa outro pelo que ele exporta; nunca importa arquivos internos de outro módulo.
2. **Regra de negócio só no backend.** O frontend apresenta, coleta e chama a API. Validação no formulário é conveniência; a que vale é a do backend.
3. **Só o Cliente Asaas fala com o Asaas.** O resto do código depende de uma interface.
4. **A baixa é atômica.** Marcar cobrança como paga e criar a movimentação de entrada acontecem na mesma transação ([Confiabilidade.NF004]).
5. **O webhook não processa.** Valida o token `asaas-access-token`, grava o evento, enfileira e responde. Quem processa é o worker ([Desempenho.NF001]).
6. **Idempotência.** Todo evento do Asaas é identificado pelo id; um evento repetido nunca gera efeito duplicado ([Confiabilidade.NF003]).

## Regras de dados

- **O modelo de dados é o MER** em `docs/arquitetura/mer-financeiro.md` (diagrama no `.drawio`/`.svg`).
  O `schema.prisma` segue o MER. Onde ele diverge do documento de requisitos v1.1 (conta, centro de
  custo e verba, situação do projeto, periodicidade do contrato), vale o MER: as decisões estão listadas lá.
  Mudou o modelo? Atualize o MER no mesmo commit.
- **Dinheiro em centavos, como inteiro.** Nunca use `float` para valores monetários.
- **Nada é excluído fisicamente.** Cadastros são inativados; movimentações são corrigidas por estorno.
  Única exceção: categoria de movimentação que nunca foi usada pode ser excluída (decisão de 26/10/2026,
  registrada em `docs/governanca/excecoes.json`). Qualquer outra exceção é decisão da equipe.
- **Toda alteração de dados é auditada** (usuário, data, operação, registro afetado).
- **Nenhuma cobrança existe só localmente.** Se o Asaas falhar, nada é gravado.
- **Segredos só no `.env`**, nunca no código, nos logs ou na trilha de auditoria. A chave do Asaas nunca aparece em tela nem em log.
- **Dados reais de alunos nunca entram no repositório** (LGPD). Use apenas dados fictícios em testes e exemplos.

## Fluxo de trabalho

- Branches a partir de `main`: `feat/...`, `fix/...`, `docs/...`.
- Commits no formato Conventional Commits, em português: `feat(cobrancas): emite cobrança avulsa`.
- Não há pull request nem revisão obrigatória: a branch é integrada à `main` por merge local, depois de lint e testes passarem.
  Use `git merge --no-ff <branch>` (o gancho `pre-merge-commit` confere tudo), depois `git push`.
  Branch integrada é apagada (`git branch -d`).
- Issues ficam no GitHub (`gh issue list`). Ao fechar uma, cite os commits que a resolvem.
- Regras de domínio novas vêm com teste.
- Ao terminar uma tarefa, rode lint e testes da aplicação alterada antes de dizer que está pronto.

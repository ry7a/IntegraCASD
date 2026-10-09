# Como contribuir com o IntegraCASD

Este guia explica como uma mudança sai da ideia e chega à branch `main`. Leia uma vez antes do primeiro pull request e volte a ele sempre que tiver dúvida.

Para configurar a máquina e rodar o projeto, veja o [README](README.md).

## O fluxo de uma mudança

```
issue → branch → commits → pull request → revisão → merge
```

1. **Toda mudança começa numa issue.** Se não existe, crie uma descrevendo o que será feito. Atribua a issue a você antes de começar, para ninguém trabalhar na mesma coisa.
2. **Crie uma branch a partir da `main` atualizada.**
3. **Faça commits pequenos** enquanto trabalha.
4. **Abra o pull request** quando a tarefa estiver pronta (ou antes, como rascunho, se quiser ajuda).
5. **Outra pessoa revisa.** Ninguém aprova o próprio PR.
6. **Merge** depois da aprovação e com o CI verde.

## Branches

Sempre a partir da `main`, com o tipo e uma descrição curta, em minúsculas e com hífens:

| Tipo | Quando usar | Exemplo |
| --- | --- | --- |
| `feat/` | Funcionalidade nova | `feat/emitir-cobranca-avulsa` |
| `fix/` | Correção de bug | `fix/cpf-duplicado-na-inclusao` |
| `refactor/` | Mudança de código sem mudar comportamento | `refactor/extrair-cliente-asaas` |
| `docs/` | Só documentação | `docs/adr-004-fila-no-postgres` |
| `chore/` | Configuração, dependências, ferramentas | `chore/configurar-ci` |

```powershell
git switch main
git pull
git switch -c feat/emitir-cobranca-avulsa
```

## Commits

Seguimos o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com a mensagem em português:

```
<tipo>(<escopo>): <o que o commit faz, no imperativo>
```

- **tipo:** os mesmos das branches (`feat`, `fix`, `refactor`, `docs`, `chore`) e também `test`.
- **escopo:** o módulo ou a aplicação afetada: `cadastros`, `cobrancas`, `movimentacoes`, `indicadores`, `administracao`, `web`, `api`.

Exemplos:

```
feat(cobrancas): emite cobrança avulsa pelo Asaas
fix(cadastros): impede CPF duplicado entre alunos ativos
test(cobrancas): cobre evento de webhook repetido
docs: adiciona ADR sobre a fila no PostgreSQL
```

Prefira vários commits pequenos e com sentido a um commit gigante chamado "ajustes".

## Pull requests

- **Um PR, uma tarefa.** Se o PR mexe em coisas sem relação, divida.
- **PRs pequenos são revisados mais rápido e com mais cuidado.** Como referência, tente ficar abaixo de 400 linhas alteradas.
- Preencha o template que aparece ao abrir o PR, incluindo o número da issue (`Closes #12`).
- Antes de abrir, rode na raiz:

  ```powershell
  pnpm lint
  pnpm test
  pnpm build
  ```

- O merge é feito por **squash**: todos os commits do PR viram um só na `main`, com o título do PR. Por isso, o título do PR também segue o padrão de commits.

## Revisão de código

A revisão é onde o conhecimento se espalha pela equipe, não só onde se pegam bugs.

**Para quem revisa:**

- Responda em até um dia útil. Um PR parado trava quem o abriu.
- Comente o código, nunca a pessoa. Explique o porquê da sugestão.
- Diferencie o que bloqueia do que é sugestão: comece os comentários opcionais com **"Sugestão:"**.
- Se não entendeu algo, pergunte. Se você não entendeu, o próximo a mexer também não vai entender.

**Para quem é revisado:**

- Responda todos os comentários, mesmo que seja com "feito" ou explicando por que discorda.
- Discordâncias que não se resolvem em dois comentários viram conversa de voz.

## Definição de pronto

Uma tarefa só está pronta quando **todos** os itens que se aplicam a ela estão cumpridos.

**Sempre:**

- [ ] Lint, testes e build passando.
- [ ] Regras de negócio novas têm teste.
- [ ] Nenhuma regra de negócio no frontend.
- [ ] Mensagens de erro dizem ao usuário o que fazer.
- [ ] Documentação e `CLAUDE.md` atualizados, se a mudança altera uma convenção.

**Se mexe com dinheiro ou banco de dados:**

- [ ] Valores monetários em centavos, como inteiro.
- [ ] Nada é excluído fisicamente (inativação ou estorno).
- [ ] Operações em mais de uma tabela estão numa transação.
- [ ] A alteração é registrada na trilha de auditoria.
- [ ] A migração foi criada com `prisma migrate dev` e não altera migrações antigas.

**Se mexe com o Asaas:**

- [ ] O acesso passa pelo Cliente Asaas, nunca direto.
- [ ] Testado contra um dublê, não contra o Asaas real.
- [ ] Nenhuma cobrança é gravada localmente se a chamada ao Asaas falhar.
- [ ] Webhook: valida o token, grava, enfileira e responde, sem processar.
- [ ] Processamento de eventos é idempotente (evento repetido não tem efeito).

## Dependências

- **Não adicione bibliotecas sem combinar com a equipe.** Abra uma issue ou pergunte no grupo, explicando o problema que ela resolve.
- Instale sempre pela raiz, com `pnpm`, nunca com `npm` ou `yarn`.
- Versões são fixadas exatas (o `.npmrc` já cuida disso). Atualizações de versão são PRs próprios, do tipo `chore`.

## Decisões de arquitetura

Uma decisão que seria cara de mudar depois (nova biblioteca importante, mudança de padrão, novo serviço externo) precisa de um ADR em `docs/adr/`, revisado no próprio PR. Use o template da pasta.

## Segurança e dados pessoais

- **Nunca faça commit de planilhas, exportações ou qualquer dado real de alunos** (LGPD). Use dados fictícios.
- **Nunca faça commit de segredos.** Chaves e senhas ficam no `.env`. Se um segredo for enviado por engano, avise a equipe na hora: ele precisa ser trocado, e apagar o commit não basta.

## Uso de IA

Usar o Claude Code e outras ferramentas de IA é bem-vindo, com duas regras:

- **Você é responsável por todo código que envia.** Leia, entenda e saiba explicar cada linha do seu PR. "Foi a IA que escreveu" não é resposta numa revisão.
- **Use a IA para aprender, não só para entregar.** Quando ela gerar algo que você não conhece, peça para explicar antes de aceitar.
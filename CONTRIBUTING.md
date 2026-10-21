# Como contribuir com o IntegraCASD

Este guia explica como uma mudança sai da ideia e chega à branch `main`. Leia uma vez antes da primeira contribuição e volte a ele sempre que tiver dúvida.

Para configurar a máquina e rodar o projeto, veja o [README](README.md).

## O fluxo de uma mudança

```
issue → branch → commits → verificação → merge na main
```

1. **Toda mudança começa numa issue.** Se não existe, crie uma descrevendo o que será feito. Atribua a issue a você antes de começar, para ninguém trabalhar na mesma coisa.
2. **Crie uma branch a partir da `main` atualizada.**
3. **Faça commits pequenos** enquanto trabalha.
4. **Verifique** quando a tarefa estiver pronta: lint, testes e build passando na raiz.
5. **Faça o merge na `main`** e envie ao GitHub. Neste projeto não há pull request nem revisão obrigatória.
6. **Feche a issue**, citando o commit.

## Branches

Sempre a partir da `main`, com o tipo e uma descrição curta, em minúsculas e com hífens:

| Tipo        | Quando usar                               | Exemplo                          |
| ----------- | ----------------------------------------- | -------------------------------- |
| `feat/`     | Funcionalidade nova                       | `feat/emitir-cobranca-avulsa`    |
| `fix/`      | Correção de bug                           | `fix/cpf-duplicado-na-inclusao`  |
| `refactor/` | Mudança de código sem mudar comportamento | `refactor/extrair-cliente-asaas` |
| `docs/`     | Só documentação                           | `docs/adr-004-fila-no-postgres`  |
| `chore/`    | Configuração, dependências, ferramentas   | `chore/configurar-ci`            |

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

## Integração na main

- **Uma branch, uma tarefa.** Se a branch mexe em coisas sem relação, divida.
- **Mudanças pequenas** são mais fáceis de entender depois e de desfazer se algo der errado. Como referência, tente ficar abaixo de 400 linhas alteradas.
- Antes do merge, rode na raiz:

  ```powershell
  pnpm lint
  pnpm test
  pnpm build
  ```

- Para integrar:

  ```powershell
  git switch main
  git pull
  git merge --no-ff feat/emitir-cobranca-avulsa
  git push
  ```

- A mensagem do merge também segue o padrão de commits, por exemplo `merge: integra emissão de cobrança avulsa`.

## Revisão de código

A revisão não é obrigatória neste projeto. Quando quiser uma segunda opinião sobre uma mudança, peça no grupo antes do merge.

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
- Versões são fixadas exatas (o `.npmrc` já cuida disso). Atualizações de versão são commits próprios, do tipo `chore`.

## Decisões de arquitetura

Uma decisão que seria cara de mudar depois (nova biblioteca importante, mudança de padrão, novo serviço externo) precisa de um ADR em `docs/adr/`, combinado com a equipe antes do merge. Use o template da pasta.

## Segurança e dados pessoais

- **Nunca faça commit de planilhas, exportações ou qualquer dado real de alunos** (LGPD). Use dados fictícios.
- **Nunca faça commit de segredos.** Chaves e senhas ficam no `.env`. Se um segredo for enviado por engano, avise a equipe na hora: ele precisa ser trocado, e apagar o commit não basta.

## Uso de IA

Usar o Claude Code e outras ferramentas de IA é bem-vindo, com duas regras:

- **Você é responsável por todo código que envia.** Leia, entenda e saiba explicar cada linha que você integra na `main`. "Foi a IA que escreveu" não é resposta quando alguém perguntar.
- **Use a IA para aprender, não só para entregar.** Quando ela gerar algo que você não conhece, peça para explicar antes de aceitar.

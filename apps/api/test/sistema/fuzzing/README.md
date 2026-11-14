# Fuzzing com entradas geradas por LLM (CT-FZ-01 e CT-FZ-02)

Plano de Testes, Seção 4.1. O sistema recebe muitas entradas inválidas, extremas ou inesperadas e o teste
confere que ele não quebra, não grava dado inconsistente e responde com um erro tratado. O LLM só **gerou**
as entradas; quem envia e julga é o Vitest, com a aplicação inteira e o PostgreSQL de verdade.

| Arquivo | Alvo | Entradas |
|---|---|---|
| `entradas/webhook-asaas.json` | CT-FZ-01: `POST /api/webhooks/asaas` | 84 |
| `entradas/aluno.json` | CT-FZ-02: cadastro de aluno | 55 |
| `entradas/cobranca-avulsa.json` | CT-FZ-02: cobrança avulsa | 43 |
| `entradas/movimentacao.json` | CT-FZ-02: lançamento de movimentação | 42 |
| `entradas/consultas.json` | CT-FZ-02: filtros de alunos, cobranças, movimentações, indicadores e trilha | 65 |

Para rodar só estes testes (PostgreSQL do `docker compose` no ar), na raiz:

```powershell
pnpm --filter api exec vitest run --config vitest.integracao.config.ts test/sistema/fuzzing
```

O CT-FZ-01 demora uns dois minutos: no fim ele liga o worker, que pega um evento a cada 2 s.

## Como as entradas foram geradas

Para cada alvo, o LLM recebeu **só o formato** do ponto de entrada (o DTO ou o corpo do aviso do Asaas e a
função que o valida), nunca dados reais nem as planilhas de `data/`. O pedido, resumido (o texto completo
está no campo `comoForamGeradas` de cada arquivo):

> Gere entradas fictícias inválidas, extremas ou inesperadas para cada campo: formato errado, tipo trocado,
> campo faltando, números negativos, com casas decimais, em texto ou acima do inteiro do banco, datas
> inexistentes, períodos invertidos, textos com SQL, HTML e byte nulo, corpo grande ou truncado, token quase
> igual ao certo. Para cada uma, diga o que se espera: recusa (e a palavra da mensagem que indica o campo),
> aceite (e o que fica gravado) ou lista vazia.

A resposta foi revisada à mão antes de entrar no repositório: valores que dependem do cenário viraram
marcadores (`{{CPF}}`, `{{ALUNO_ID}}`, `{{HOJE}}`...), e textos enormes viraram geradores (`$repetir`,
`$embaralhado`), para o JSON não ter megabytes. Os marcadores estão descritos no topo de cada arquivo e em
`entradas.ts`. O teste não chama o LLM: as entradas versionadas se repetem iguais em toda execução.

## Formato de uma entrada

```json
{ "classe": "data-inexistente", "descricao": "vencimento em 30 de fevereiro",
  "alterar": { "vencimento": "{{ANO_QUE_VEM}}-02-30" },
  "esperado": "recusa", "campoNaMensagem": "vencimento" }
```

- `esperado`: `recusa` (4xx e nada gravado), `aceito` (2xx e gravado uma vez), `recusa-ou-aceito` (qualquer
  um, mas nunca 5xx nem gravação pela metade), `lista` ou `lista-vazia` (consultas).
- Formulários: `alterar` e `remover` mudam o corpo `base` do arquivo; `corpo` ou `corpoBruto` o substituem.
- `campoNaMensagem`: palavra que a mensagem de recusa precisa conter ([Usabilidade.NF002]).
- `gravado`: no aceite, o campo do registro e o valor exato que ele precisa ter (SQL fica literal).
- Webhook: `token` (padrão: o certo; `null` = sem cabeçalho), `idEvento`, `repeticoes`, `simultaneas`,
  `status`, `tipoGravado`. Veja a interface no topo de `ct-fz-01-webhook.spec.ts`.

## Como revisar e como acrescentar uma entrada

1. Leia a `descricao` e o `esperado`: o esperado é o comportamento **correto** segundo os requisitos, não o
   que o sistema faz hoje. Uma entrada nunca é ajustada para "passar".
2. Para acrescentar, copie uma entrada parecida do mesmo arquivo, troque a descrição e os valores e rode o
   teste. Só dados fictícios: CPF válido só pelo marcador `{{CPF}}`; nada que pareça chave do Asaas.
3. Um id de evento novo no webhook segue a numeração `evt_fz01_NNN`, sem repetir (a não ser que a repetição
   seja o que a entrada testa).

## Entrada que derruba o sistema vira caso fixo de regressão

Se uma entrada provocar 5xx ou gravar algo indevido, **ela não sai do arquivo** e o `esperado` não muda: o
teste fica vermelho até o defeito ser corrigido no código. Depois da correção, a mesma entrada passa a ser a
garantia de que o defeito não volta. Registre o defeito (issue no GitHub) citando a `descricao` da entrada.

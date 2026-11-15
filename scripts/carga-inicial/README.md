# Carga inicial

Script que leva os dados das planilhas do CASD para o banco, uma única vez, na implantação
([Distribuição.NF002]). Por enquanto carrega, da aba `H8` de `data/SIRLEYDE NOVA.xlsx`:

- os **alunos**, com as turmas e as vagas de alojamento;
- os **débitos em aberto**: cada mês "NÃO PAGO" do Fundo de Manutenção vira uma cobrança
  **herdada** (ADR-0005), que não existe no Asaas e não tem boleto.

Movimentações, projetos e contratos ficam para uma próxima etapa. Nenhuma outra cobrança entra
por aqui: só as herdadas podem existir sem o Asaas.

## LGPD: leia antes de rodar

- A planilha e tudo o que o script gera (`dados/`) têm dados reais de alunos. A pasta `dados/`
  está no `.gitignore`: nunca force a inclusão, não envie por chat e não copie para testes ou docs.
- **Não abra o túnel do ambiente de testes** (Cloudflare) com um banco que recebeu esta carga:
  ele deixa o sistema acessível pela internet. Para testar com o Asaas, use um banco só com dados
  fictícios.
- **Não cadastre parâmetros de cobrança nem a chave do Asaas** num banco com esta carga enquanto
  o worker estiver ligado: a geração recorrente emitiria cobranças no Asaas com os dados reais.
- No terminal o script mostra só totais, nunca nomes ou CPFs.

## Como rodar (PowerShell, na raiz)

Precisa de Python 3.10 ou mais novo e do `openpyxl` (única dependência):

```powershell
python -m pip install -r scripts/carga-inicial/requirements.txt
```

1. Coloque a planilha em `data/SIRLEYDE NOVA.xlsx` (ou passe outro caminho com `--planilha`).
2. Gere o SQL e o relatório de pendências:

   ```powershell
   python scripts/carga-inicial/carregar_alunos.py
   ```

   A data da carga vem de `--hoje` (ex.: `--hoje 2027-01-06`); sem ele, vale a de hoje. Na carga
   real, ela tem de ser 06/01/2027 ou depois: veja "Na implantação", abaixo.

3. Com o banco no ar (`docker compose up -d`) e as migrações aplicadas, carregue:

   ```powershell
   pnpm --filter api exec prisma db execute --file ../../scripts/carga-inicial/dados/carga.sql
   ```

O SQL roda numa transação só: ou entra tudo, ou nada. Pode ser aplicado de novo sem duplicar:
turma, vaga, aluno (pelo CPF) e débito (aluno + mês) que já existem são pulados. Cada aluno e cada
cobrança herdada ganham um registro na trilha de auditoria (sem usuário, como as rotinas automáticas).
O detalhe desse registro não leva nome, CPF nem e-mail: a trilha não pode ser apagada (LGPD, regra B14).

Para começar de um banco vazio: `pnpm --filter api exec prisma migrate reset`. **Apaga todos os
dados do banco local**, inclusive os usuários; depois rode o `admin-inicial` de novo.

## O que o script gera

| Arquivo (em `dados/`)   | Conteúdo                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `carga.sql`             | Turmas, vagas, alunos e cobranças herdadas, prontos para o banco             |
| `pendencias-alunos.csv` | Uma linha por problema: linha da planilha, campo, valor, problema e o que a carga fez. Abre direto no Excel |

A área administrativa confere as pendências e corrige pela tela de Cadastros antes de o sistema
entrar em operação.

## Regras (em `regras.py`)

As mesmas do backend (`apps/api/src/modulos/cadastros/dominio/`), para o que entra passar na tela
de edição depois.

| Coluna            | Vira                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `ALUNOS`, `CPF`   | Nome e CPF. CPF perde a pontuação e recupera os zeros à esquerda. Sem nome ou CPF, a linha não é carregada |
| `EMAIL`           | Em minúsculas. Vazio ou inválido: aluno entra como **cadastro incompleto** (não recebe cobrança) |
| `CPF` inválido    | Também entra como cadastro incompleto e vai para as pendências                             |
| `TURMA`           | Ano de formatura vira turma: `2028` → `T28`                                                |
| `CURSO`           | `2º Comp` → `COMP`. `Fund` (os dois primeiros anos) fica sem curso                         |
| `POSTO`           | `Al Mil` → aluno militar; `Asp`/`Asp Of` → aspirante. Vazio fica sem posto (a planilha não diz se é civil) |
| `ALOJ/APTO/VAGA`  | `H-8A`, `105`, `C` → vaga bloco A, apto 105, vaga C. Uma vaga tem no máximo um aluno ativo |
| `SITUAC`          | Ativos: Matriculado e sem situação. Inativos: Trancado, Intercâmbio, Desligado, Suspenso, Fora do H8 (decisão de 30/10/2026) |
| `CELULAR`, `MATRIC`, `APELIDO` | Normalizados; valor que não serve fica em branco e vai para as pendências     |

Repetições: CPF repetido não é carregado; matrícula repetida fica em branco; vaga já ocupada por
outro aluno ativo fica em branco. Em todos os casos a primeira linha da planilha vence. Se a matrícula
ou a vaga já estiverem em uso por um aluno que estava no banco antes da carga, também ficam em
branco, sem derrubar a transação.

`STATUS`, `BOLETO` e `NEG` não são carregados.

### Débitos (colunas de cada mês)

Cada mês ocupa três colunas (`VALOR`, `DATA`, `SITUAÇÃO`). Nas linhas acima do cabeçalho ficam o
nome do mês, o valor e o vencimento.

| O que                  | Regra                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Débito                 | Só a situação `NÃO PAGO` de um mês **já vencido** na data da carga (`--hoje`, padrão: hoje). Mês ainda a vencer não vira herdada: vai para as pendências e é cobrado pela geração do sistema. Situações sem débito: `PAGO`, vazio, Antes da moradia, Bolsista, Isento, Fora do H8, Intercâmbio, Trancado, Desligado e Vaga disponível |
| Situação desconhecida  | Texto fora dessa lista (ex.: `#REF!`, fórmula quebrada) vira pendência; o débito do mês não é carregado |
| Valor e vencimento     | Os do mês, das linhas de cima (a célula do aluno em aberto fica vazia). Multa e juros zerados |
| Descrição              | O mês da referência, no texto da geração do sistema, e o mês como a planilha o chama: `Mensalidade de outubro/2026 (planilha: setembro/2026)` |
| Mês de referência      | O do **vencimento**, como na geração recorrente: "setembro/2026" vence em 05/10/2026 e tem referência `2026-10` |
| Data da carga          | `--hoje AAAA-MM-DD`. Mês que vence nesse dia ou depois não vira herdada            |
| Conferência            | O total de meses em aberto de cada aluno é comparado com a coluna `DEVENDO`; diferença vira pendência |

Aluno inativo também leva os débitos dele. Aluno não carregado (CPF repetido) não leva nenhum.

### Na implantação: o mês de virada

Decisão da equipe (item 1.13 do [playbook de implantação](../../docs/playbooks/implantacao.md)):

| Quem cobra    | Último ou primeiro mês                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| A planilha    | Até a que ela chama de **"dezembro/2026"**, que vence em 05/01/2027. No sistema: referência `2027-01`, `Mensalidade de janeiro/2027 (planilha: dezembro/2026)` |
| O sistema     | A partir da **`Mensalidade de fevereiro/2027`** (referência `2027-02`, vence em fevereiro/2027) |

A planilha **não cobra** o mês que ela chamaria de "janeiro/2027": esse é o fevereiro do sistema.

- **Quando rodar:** em janeiro/2027, com `--hoje 2027-01-06` ou depois. O script só leva como
  herdada o mês que vence **antes** do `--hoje`. Com `--hoje 2027-01-05` ou antes, a "dezembro/2026"
  não paga vai para as pendências como "cobre pela geração do sistema", e o sistema não vai cobrá-la:
  o débito se perde. Sem `--hoje`, vale a data do dia.
- **Antes de gerar o SQL:** a planilha precisa estar com todos os pagamentos recebidos até ali.
- **Trava no sistema:** a variável `GERACAO_A_PARTIR_DE=2027-02`, no `app` e no `worker`, impede a
  geração recorrente de cobrar qualquer mês anterior a fevereiro/2027, inclusive pelo "gerar agora".
  Assim, o sistema não cobra de novo um mês que a planilha já cobrou.
- **Depois da carga:** pagamento de um mês antigo (até "dezembro/2026") é registrado **no sistema**,
  como pagamento manual da cobrança herdada (ADR-0005), e não só na planilha. A planilha deixa de ser
  a fonte dos débitos no dia da carga.

## Carga anonimizada (homologação)

A homologação usa dados anonimizados ([Padrões.NF001]). Para mostrar o sistema com a "cara" da
planilha (quantidade de alunos, turmas, ocupação do H8, débitos e inadimplência por turma) sem
nenhum aluno real:

```powershell
python scripts/carga-inicial/carregar_alunos.py --anonimizar --hoje AAAA-MM-DD
```

Gera só `dados/carga-anonimizada.sql` (o relatório de pendências não, porque tem valores da planilha).

- **Trocados:** nome, CPF, e-mail (`@exemplo.com`) e matrícula viram fictícios; celular e apelido
  ficam em branco. Cadastro incompleto continua incompleto (e-mail vazio ou CPF inválido).
- **Embaralhados:** os débitos, entre alunos da mesma turma; as vagas, entre os alunos ativos (e, à
  parte, entre os inativos). Só trocar os nomes não anonimiza: quem conhece o H8 reconheceria o aluno
  pela vaga e veria os débitos dele.
- **Mantidos com o aluno:** turma, curso, posto e situação (ativo ou inativo).
- **Trava:** se algum nome, CPF, e-mail, celular, apelido ou matrícula real aparecer no SQL, o script
  para e não grava nada.
- **Gere uma vez e aplique sempre o mesmo arquivo.** O sorteio muda a cada execução: aplicar dois
  arquivos diferentes duplica os alunos.
- **Antes de fevereiro/2027**, quando acaba a trava `GERACAO_A_PARTIR_DE`, zere esses dados da
  homologação: senão a geração recorrente emite boletos no Asaas sandbox para todos eles.

Como aplicar na Railway: `docs/playbooks/implantacao.md` (TCP Proxy aberto só durante a carga).

## Carga das movimentações

`carregar_movimentacoes.py` lê a planilha do Fundo de Manutenção (padrão:
`data/2026 AEITA-CASD Fundo de Manutenção do H8.xlsx`; outra com `--planilha`) como manda o MER
(`docs/arquitetura/mer-financeiro.md`, "Da planilha para o modelo"):

| Na planilha | Vira |
| ----------- | ---- |
| Abas Janeiro…Dezembro, Entradas | entradas da "Conta Corrente Fundo de Manutenção" |
| Abas Janeiro…Dezembro, Saídas | saídas da mesma conta; a projetização vira o vínculo (`AAC NNN` contrato, `AAP NNN` projeto, `Z - X` centro de custo X) e `A - X` vira a categoria X |
| Resumo Mensal, C8 e C13 | saldo inicial das duas contas (em 1º de janeiro) |
| Investimentos, Rendimento | entradas da "Conta de Investimentos Fundo de Manutenção", categoria Rendimento |
| Zeladoria e Administrativo | verba liberada de cada centro de custo em cada mês |
| Contratos | data de início do contrato, quando o código está lá |

Contratos e projetos entram só se aparecem nas saídas. O contrato leva como valor a mediana dos
pagamentos do ano e é mensal se foi pago em 6 meses ou mais. Se o código da planilha já existe no banco
com outro texto, o registro ganha o próximo código livre do ano e `(planilha: 26P001)` no nome ou objeto.
Forma de pagamento: transferência (a planilha não diz).

```powershell
python scripts/carga-inicial/carregar_movimentacoes.py               # dados/movimentacoes.sql + pendencias-movimentacoes.csv
python scripts/carga-inicial/carregar_movimentacoes.py --anonimizar  # dados/movimentacoes-anonimizada.sql (homologação)
```

- **Conferência:** o script compara, mês a mês, o que vai carregar com os totais do Resumo Mensal. As
  entradas "Outros" ficam fora do resumo da planilha, então aparecem como diferença (decisão de
  15/11/2026: elas entram).
- **Mês a mês:** cada mês grava um marco na trilha (`movimentacoes-planilha-AAAA-MM`). Reaplicar o mesmo
  arquivo não duplica nada, e uma planilha com um mês novo carrega só o mês novo. **Lançamento acrescentado
  depois num mês já carregado não entra**: registre-o pela tela.
- **Funcionárias:** a planilha não tem o cadastro delas, então no modo real os pagamentos entram sem
  vínculo com funcionário (e vão para as pendências). Movimentação não se altera: a equipe decide antes
  da carga de produção se aceita isso.
- **`--anonimizar`** (homologação, [Padrões.NF001]): as descrições viram um texto neutro ("Pagamento do
  contrato 24C002", "Zeladoria: Jardins", com o número da NF quando havia); os pagamentos às funcionárias
  são somados por mês; a contraparte de contrato com mais de uma parte no rótulo vira "Contratada do contrato
  <código>". Valores, datas, categorias, centros, projetos e objetos de contrato ficam como na planilha
  (são do CASD, não de pessoas). Uma trava procura no SQL cada descrição e contraparte original e para sem
  gravar se achar alguma. O relatório de pendências não é gravado nesse modo.

Para aplicar: o mesmo comando dos alunos (`prisma db execute --file ...`) no banco local, ou o caminho da
Railway descrito acima.

## Testes

```powershell
python -m unittest discover -s scripts/carga-inicial -v
```

Só dados fictícios. Ainda não rodam nos ganchos do git nem no CI.

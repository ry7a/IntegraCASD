# MER: parte financeira (movimentações, contratos, projetos)

**Situação: validado em 26/10/2026**, com as decisões abaixo aplicadas conforme a recomendação.

Fontes: a planilha do Fundo de Manutenção do H8 (2026) e o documento de requisitos v1.1
([Cadastros.RF002], [Cadastros.RF004], [Cadastros.RF005], [Movimentações.RF001],
[Movimentações.RF002], [Administração.RF002]). Aluno, turma e alojamento seguem o modelo
combinado pela equipe em 21/10 ([Cadastros.RF001]). `COBRANCA` é *contexto*: pertence à tarefa
de Cobranças e aparece só para mostrar onde ela se liga.

## Diagrama

![MER do IntegraCASD](mer-financeiro.svg)

Fonte editável: [`mer-financeiro.drawio`](mer-financeiro.drawio). Ao alterar, exporte de novo o `.svg`.

## Regras que o diagrama não mostra

1. **No máximo um vínculo de origem por movimentação:** contrato, projeto, funcionário ou centro
   de custo. No banco isso vira um `CHECK`; no backend, uma validação com mensagem.
2. **Uma movimentação só aceita uma categoria compatível com o seu tipo:** uma `ENTRADA` não
   recebe categoria `SAIDA`, e vice-versa.
3. **O estorno é uma movimentação nova**, de tipo oposto e mesmo valor, que aponta para a
   original em `estornoDeId`. Como o campo é `UNIQUE`, uma movimentação só pode ser estornada uma
   vez. Nada é apagado.
4. **A transferência entre contas (aplicar ou resgatar) é um par de movimentações** com o mesmo
   valor e tipos opostos, em contas diferentes, ligadas por `transferenciaParId`. Ela muda o saldo
   de cada conta, mas fica de fora do resultado do CASD (não é receita nem despesa). É isso que a
   planilha faz à mão no "Resumo Fundo de Manutenção".
5. **Rendimento da aplicação** é uma `ENTRADA` na conta `APLICACAO` com a categoria "Rendimento".
   Não precisa de tabela própria.
6. **Verba mensal:** só pode haver uma por centro de custo e mês (`UNIQUE (centroCustoId, ano, mes)`).
7. **Código de contrato e projeto** segue o formato da planilha (ano com 2 dígitos + `C`/`P` +
   sequência de 3 dígitos) e é gerado pelo backend.
8. **Aluno:** o CPF é único só entre os alunos ativos (índice parcial, como já está no schema).
   Assim, um cadastro inativo não impede recadastrar a mesma pessoa.
9. **Alojamento:** cada registro é uma vaga, com `UNIQUE (bloco, apto, vaga)`.

## Alunos: o que muda em relação ao schema atual

Estes são os campos combinados em 21/10 ([Cadastros.RF001]). Comparado ao `schema.prisma` da `main`:

- **Entram:** `apelido`, além de `alojamentoId` (FK para a vaga) no lugar do texto livre.
- **Saem:** `situacao` (o enum `MATRICULADO | TRANCADO | …`), que é substituído por `ativo`,
  e as colunas de texto `alojamento`, `apto` e `vaga`. A remoção fica para um passo posterior,
  depois que a carga inicial preencher os campos novos (expandir e depois contrair).
- **Continuam iguais:** `nome`, `cpf`, `email`, `celular`, `matricula`, `turmaId`, `curso`,
  `posto` e `ativo`.

Ainda em aberto, sem decisão: como tratar bolsistas e isentos, o histórico de boletos, como
mapear Trancado e Intercâmbio para `ativo`, e o curso "1º/2º Fund" da planilha, que não existe no
enum.

## O que é calculado, e não guardado

| Valor | Como se calcula |
| --- | --- |
| Saldo de uma conta | saldo inicial + entradas − saídas da conta até a data |
| Resultado do mês | entradas − saídas, sem transferências |
| Total pago num contrato ou projeto | soma das saídas vinculadas, menos os estornos |
| Restante do projeto | orçamento previsto − total pago |
| Saldo da verba do mês | verba liberada − saídas do centro de custo no mês |
| Gasto por categoria e % sobre o total | agrupamento das saídas do período |
| Adimplência | consulta sobre as cobranças (deixa de ser digitada) |

## Da planilha para o modelo

| Na planilha | No modelo |
| --- | --- |
| Abas Janeiro…Dezembro, tabela Entradas | `MOVIMENTACAO` tipo `ENTRADA` na conta corrente |
| Abas Janeiro…Dezembro, tabela Saídas | `MOVIMENTACAO` tipo `SAIDA`; a projetização vira o vínculo de origem |
| Aba Investimentos | movimentações na conta `APLICACAO` (rendimento, aporte, retirada) |
| Projetização `25P013 - …` / `23Z005 - …` | `PROJETO` (os dois formatos viram a mesma entidade) |
| Projetização `24C002 - …` | `CONTRATO` |
| Projetização `Z - Jardins` etc. | `CENTRO_CUSTO` |
| Projetização `A - Funcionárias` | vínculo com `FUNCIONARIO` |
| Projetização `A - Impostos`, `A - Taxas Bancárias`, `A - Taxa AEITA`… | só `CATEGORIA` |
| Valor liberado (aba Zeladoria e Administrativo) | `VERBA_MENSAL` |
| Saldos iniciais (Resumo Mensal C8 e C13) | `CONTA.saldoInicialCentavos` |
| Resumo Mensal, Prestações, Gráficos, Resumo de Projetos | consultas (nada guardado) |

## Decisões

Cada item traz a recomendação que foi aplicada. Os itens 1, 2 e 3 vão **além do documento de
requisitos v1.1** e precisam de uma nota no documento, assim como o responsável opcional do projeto
(o [Cadastros.RF005] ainda o trata como obrigatório).

1. **`CONTA` (corrente e aplicação).** Sem ela, o saldo do fundo e os investimentos não fecham com
   a planilha. *Recomendo incluir.*
2. **`CENTRO_CUSTO` e `VERBA_MENSAL` (controle da zeladoria).** Hoje esse controle é uma aba inteira
   da planilha, mas não aparece nos requisitos. *Recomendo incluir `CENTRO_CUSTO` agora.
   `VERBA_MENSAL` é uma tabela pequena, mas exige uma tela a mais; incluir só se couber no MVP.*
3. **Transferência como par de movimentações** (regra 4). *Recomendo.* A alternativa, uma
   categoria marcada como "não entra no resultado", é mais simples, mas não liga as duas pernas.
4. **Centros administrativos (`A - …`) viram categorias**, e "Funcionárias" vira vínculo com
   funcionário. *Recomendo.*
5. **Situação do projeto:** usei os status da planilha, incluindo `EM_EXECUCAO`, que aparece no
   resumo dela mas não na lista permitida. Confirmar a lista.
6. **Código `24C002` / `25P013`:** manter para não perder a referência da planilha e das notas
   antigas. *Recomendo manter.*
7. **Histórico de boletos na carga inicial:** na planilha, as entradas são totais por dia, sem
   aluno. *Recomendo importar como movimentações sem cobrança vinculada.*
8. **Contas a pagar** (aba A Pagar, hoje com 1 linha): *recomendo deixar fora do MVP.*
9. **Uma vaga com vários alunos?** No diagrama, uma vaga pode aparecer em vários cadastros,
   porque alunos inativos guardam a vaga que ocupavam. *Recomendo um índice parcial: no máximo um
   aluno ativo por vaga.* Isso não estava no que combinamos.

# ADR-0004: Trilha de auditoria gravada na transação, com o banco recusando mudanças

- **Status:** Aceita
- **Data:** 2026-10-26
- **Decisores:** Marcello Ryaj
- **Requisitos relacionados:** [Segurança.NF006], [Administração.RF005]

## Contexto

O [Segurança.NF006] exige que toda operação que altere cadastro, cobrança, movimentação ou
configuração fique registrada (usuário ou rotina automática, data, hora, operação e registro
afetado) e que nenhum perfil consiga alterar ou apagar esses registros.

O `apps/api/CLAUDE.md` previa gravar a trilha "por um ponto central (interceptor)". Na prática, os
primeiros módulos (usuários, autenticação, categorias) gravaram a trilha à mão, cada um com
`tx.registroAuditoria.create(...)` dentro da própria transação. Cada módulo escrevia o registro do
seu jeito, e nada impedia um código futuro de alterar ou apagar a trilha.

## Decisão

Vamos gravar a trilha por uma única função, `registrarNaTrilha(tx, registro)`, em
`apps/api/src/compartilhado/auditoria/trilha.ts`, chamada **dentro da transação** da alteração. A
inalterabilidade fica garantida pelo próprio PostgreSQL: um gatilho recusa `UPDATE`, `DELETE` e
`TRUNCATE` em `registros_auditoria`.

- Operações e entidades auditadas são tipos fechados (`OperacaoAuditada`, `EntidadeAuditada`).
  Valor novo entra nesses tipos.
- Rotina automática grava com `usuarioId` nulo.
- A função de aptidão **B13** (`apps/api/test/arquitetura/trilha-de-auditoria.spec.ts`) falha se
  algum arquivo além do ponto central gravar na trilha, se alguém fizer `update` ou `delete` nela, ou
  se o gatilho sumir das migrações.

## Alternativas consideradas

### Alternativa 1: interceptor do Nest

- **Prós:** nenhum caso de uso precisa lembrar de auditar; tudo que passa por uma rota seria registrado.
- **Contras:** o interceptor roda depois que o caso de uso termina, com a transação já confirmada. Se
  a gravação da trilha falhar, o dado fica alterado sem registro. Ele também não enxerga as rotinas
  do worker (geração recorrente, conciliação), que não passam por rota HTTP, nem sabe qual registro foi
  afetado sem convenções extras na resposta.
- **Por que não:** viola o NF006 justamente no caso de falha, e não cobre as rotinas automáticas.

### Alternativa 2: só a ausência de rota de alteração

- **Prós:** nada a fazer; não existe tela nem rota que altere a trilha.
- **Contras:** um script, uma migração ou um código novo poderiam alterar a trilha sem que ninguém percebesse.
- **Por que não:** o requisito diz "não deve existir função de alteração para nenhum perfil"; o
  gatilho torna isso verdade no banco, não só na interface.

## Consequências

**Positivas:**

- A alteração e o seu registro são gravados juntos, ou nenhum dos dois é.
- A trilha não muda nem por engano de quem tem acesso ao banco pela aplicação.
- Um único lugar define o formato do registro, o que facilita a tela de consulta ([Administração.RF005]).

**Negativas e riscos:**

- Cada caso de uso que altera dados precisa chamar `registrarNaTrilha`. O esquecimento não é pego
  pela B13 (que barra o jeito errado, não a ausência). A definição de pronto do CONTRIBUTING continua
  pedindo a conferência.
- Corrigir um registro errado na trilha exige desligar o gatilho numa migração com justificativa: é
  de propósito.

**Quando revisitar:** se a quantidade de casos de uso esquecendo de auditar virar problema, avaliar
um auxiliar que envolva a transação e exija o registro (por exemplo, `executarComAuditoria(...)`).

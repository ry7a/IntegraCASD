# Registros de decisões de arquitetura (ADRs)

Um ADR registra uma decisão que seria cara de mudar depois: o contexto em que foi tomada, o que se decidiu, as alternativas descartadas e as consequências. O objetivo é que quem chegar nas próximas gestões entenda **por que** o sistema é como é, e não só **como** ele é.

## Quando escrever um ADR

- Escolha de tecnologia importante (framework, banco, biblioteca central).
- Mudança de padrão de arquitetura ou de organização do código.
- Novo serviço externo ou mudança na integração com o Asaas.
- Qualquer decisão em que a equipe discutiu alternativas e uma ganhou.

Não precisa de ADR: escolha de nome de variável, biblioteca pequena e fácil de trocar, ajuste de estilo.

## Como escrever

1. Copie o [`0000-template.md`](0000-template.md) com o próximo número livre: `0005-titulo-em-minusculas.md`.
2. Preencha com status **Proposta** e abra um pull request.
3. A discussão acontece no PR. Quando aprovado, mude o status para **Aceita** antes do merge.

## Regras

- **ADR aceito não se edita.** Se a decisão mudar, escreva um ADR novo e marque o antigo como "Substituída por ADR-NNNN". O histórico das decisões é tão importante quanto a decisão atual.
- Correções de digitação ou links quebrados podem ser feitas a qualquer momento.
- Mantenha curto. Um ADR bom se lê em cinco minutos.

## Índice

| Número                           | Decisão                                     | Status     |
| -------------------------------- | ------------------------------------------- | ---------- |
| [0001](0001-monolito-modular.md) | Monólito modular como estilo arquitetural   | Aceita     |
| 0002                             | PostgreSQL como banco e como fila (pg-boss) | A escrever |

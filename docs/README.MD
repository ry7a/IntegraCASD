# Registros de decisões de arquitetura (ADRs)

Um ADR registra uma decisão que seria cara de mudar depois: o contexto em que foi tomada, o que se decidiu, as alternativas descartadas e as consequências. O objetivo é que quem chegar nas próximas gestões entenda **por que** o sistema é como é, e não só **como** ele é.

## Quando escrever um ADR

- Escolha de tecnologia importante (framework, banco, biblioteca central).
- Mudança de padrão de arquitetura ou de organização do código.
- Novo serviço externo ou mudança na integração com o Asaas.
- Qualquer decisão em que a equipe discutiu alternativas e uma ganhou.

Não precisa de ADR: escolha de nome de variável, biblioteca pequena e fácil de trocar, ajuste de estilo.

## Como escrever

1. Copie o [`0000-template.md`](adr/0000-template.md) com o próximo número livre: `NNNN-titulo-em-minusculas.md`.
2. Preencha com status **Proposta** e avise a equipe no grupo.
3. A discussão acontece com a equipe. Quando aprovado, mude o status para **Aceita** antes do merge na `main`.

## Regras

- **ADR aceito não se edita.** Se a decisão mudar, escreva um ADR novo e marque o antigo como "Substituída por ADR-NNNN". O histórico das decisões é tão importante quanto a decisão atual.
- Correções de digitação ou links quebrados podem ser feitas a qualquer momento.
- Mantenha curto. Um ADR bom se lê em cinco minutos.

## Índice

| Número | Decisão | Status |
| --- | --- | --- |
| [0001](adr/0001-monolito-modular.md) | Monólito modular como estilo arquitetural | Aceita |
| [0002](adr/0002-postgresql-banco-e-fila.md) | PostgreSQL como banco e como fila (pg-boss) | Proposta |
| [0003](adr/0003-funcoes-de-aptidao.md) | Funções de aptidão como guardiãs da arquitetura | Aceita |
| [0004](adr/0004-trilha-de-auditoria-na-transacao.md) | Trilha de auditoria na transação, só de inclusão | Aceita |
| [0005](adr/0005-cobranca-herdada-da-planilha.md) | Débitos da planilha como cobranças herdadas, sem Asaas | Proposta |
| [0006](adr/0006-hospedagem-na-railway.md) | Hospedagem na Railway | Proposta |

## Playbooks

| Playbook | Para quê |
| --- | --- |
| [Configuração no Windows](playbooks/configuracao-windows.md) | Preparar a máquina de desenvolvimento |
| [Implantação](playbooks/implantacao.md) | Colocar no ar na Railway, implantar versões, voltar versão, incidentes |
| [Backup e restauração](playbooks/backup-e-restauracao.md) | Fazer, testar e usar os backups do banco |

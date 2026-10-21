# ADR-0002: PostgreSQL como banco e como fila, com processamento assíncrono dos webhooks

- **Status:** Proposta
- **Data:** 2026-10-09
- **Decisores:** Marcello Ryaj
- **Requisitos relacionados:** [Confiabilidade.NF001], [Confiabilidade.NF003], [Confiabilidade.NF004], [Confiabilidade.NF006], [Confiabilidade.NF007], [Desempenho.NF001], [Desempenho.NF004], [Hardware e software.NF005]

## Contexto

O sistema tem três necessidades de armazenamento e processamento que se cruzam.

**Dados financeiros com transações.** A baixa de uma cobrança e a criação da movimentação de entrada precisam acontecer juntas ou não acontecer ([Confiabilidade.NF004]). O armazenamento precisa de transações que abranjam mais de um registro e de cópias de segurança consistentes sem parar o serviço ([Hardware e software.NF005]).

**Webhooks do Asaas com prazo curto.** O Asaas considera falha qualquer notificação não respondida em até 5 segundos ([Desempenho.NF001]) e interrompe o envio depois de 15 falhas consecutivas ([Confiabilidade.NF001]). Os picos acontecem justamente nos dias de vencimento das mensalidades. A mesma notificação pode chegar mais de uma vez e não pode gerar efeito duplicado ([Confiabilidade.NF003]).

**Rotinas sem intervenção humana.** A geração recorrente de mensalidades, a sincronização periódica com o Asaas e o alerta de webhook parado precisam rodar em horários definidos, sobreviver a reinícios e registrar o resultado de cada execução ([Confiabilidade.NF007], [Desempenho.NF004]).

Restrições: equipe de 4 pessoas aprendendo a stack, 2 meses de prazo, orçamento perto de zero, volume pequeno (cerca de 800 alunos por mês) e manutenção futura por pessoas que não participaram da construção.

## Decisão

Vamos usar **um único PostgreSQL 18** tanto para os dados quanto para a fila de tarefas, por meio da biblioteca **pg-boss**, e **processar as notificações do Asaas de forma assíncrona**.

**Banco de dados.** PostgreSQL 18, acessado pelo Prisma. Cada módulo de domínio é dono das próprias tabelas.

**Fila e agendamento.** O pg-boss guarda a fila e os agendamentos em tabelas do próprio PostgreSQL, num esquema separado (`pgboss`). Não há Redis, RabbitMQ nem outro serviço de mensageria.

**Processamento do webhook em duas etapas:**

1. **Na API, dentro do prazo de 5 segundos:** valida o token `asaas-access-token`, grava o evento bruto numa tabela com o id do Asaas marcado como `UNIQUE`, enfileira um job no pg-boss e responde 200. Nenhuma regra de negócio roda aqui.
2. **No worker, sem prazo:** consome o job, verifica se o evento já foi processado e executa a baixa numa única transação, que inclui a atualização da cobrança, a criação da movimentação, o registro de auditoria e a marcação do evento como processado.

**Rotinas agendadas** são jobs do pg-boss com expressão cron, executados pelo worker.

## Alternativas consideradas

### Alternativa 1: processar o webhook direto no controller, sem fila

- **Prós:** o caminho mais simples; menos código e nenhum componente de fila.
- **Contras:** o tempo de resposta ao Asaas passa a depender do banco e da lógica de negócio. Em dia de vencimento, com centenas de notificações, lentidões viram falhas de entrega; quinze seguidas interrompem a fila do Asaas, e eventos não entregues são descartados depois de 14 dias.
- **Por que não:** coloca em risco o requisito mais crítico do sistema, a conciliação automática.

### Alternativa 2: Redis com BullMQ

- **Prós:** a combinação mais popular no ecossistema Node; muito rápida; boa documentação e painéis prontos.
- **Contras:** um serviço a mais para hospedar, monitorar e manter. Enfileirar e gravar dados não acontecem na mesma transação, porque estão em sistemas diferentes. Os dados da fila exigem um cuidado de persistência e backup separado do banco.
- **Por que não:** o ganho de velocidade é irrelevante para o volume do CASD, e cada componente a mais pesa numa equipe pequena e numa manutenção que troca de mãos a cada gestão.

### Alternativa 3: RabbitMQ

- **Prós:** mensageria robusta, com roteamento sofisticado.
- **Contras:** os mesmos do Redis, com uma curva de aprendizado ainda maior.
- **Por que não:** recursos muito além do que o problema exige.

### Alternativa 4: agendador dentro do processo (node-cron ou similar) para as rotinas

- **Prós:** fácil de configurar.
- **Contras:** o agendamento vive só na memória: se o processo reiniciar no horário da rotina, ela não roda, e não há registro persistente de execuções nem retentativa.
- **Por que não:** não atende a [Confiabilidade.NF007] sem reconstruir à mão o que o pg-boss já oferece.

### Alternativa 5 (para o banco): MySQL ou SQLite

- **Prós:** MySQL é igualmente maduro; SQLite dispensa servidor.
- **Contras:** o MySQL não tem índice único parcial, usado para garantir CPF único só entre cadastros ativos. O SQLite não lida bem com escrita concorrente entre a API e o worker nem com backup sem parar o serviço.
- **Por que não:** o PostgreSQL atende a todos os requisitos sem contornos.

## Consequências

**Positivas:**

- Um único componente de infraestrutura para dados, fila e agendamento: um só backup, um só serviço para monitorar ([Confiabilidade.NF006]).
- O webhook responde rápido independentemente da carga de processamento.
- A idempotência tem duas camadas: o `UNIQUE` no id do evento e a verificação de "já processado" dentro da transação.
- Falhas no processamento não perdem eventos: o evento já está gravado, e o pg-boss tenta o job de novo.
- O histórico de jobs e rotinas fica consultável em tabelas, o que alimenta as telas de pendências e de geração recorrente.

**Negativas e riscos:**

- **Gravar o evento e enfileirar o job são duas operações separadas.** Se a API cair entre uma e outra, o evento fica gravado sem job. Mitigação: uma rotina periódica no worker reprocessa eventos gravados e não processados há mais de alguns minutos.
- A fila consome recursos do mesmo banco que guarda os dados. Para o volume do CASD isso é desprezível, mas o PostgreSQL passa a ser o ponto único de falha de tudo, e sua disponibilidade importa ainda mais.
- O processamento assíncrono adiciona um atraso de segundos entre o pagamento e a baixa no sistema. Para a rotina do CASD, isso é imperceptível.
- A equipe passa a depender do pg-boss, uma biblioteca menos conhecida que o BullMQ, com menos material de apoio.

**Quando revisitar:**

- Se o volume de jobs chegar a milhares por minuto, ou se a fila começar a disputar recursos com as consultas de indicadores.
- Se surgir a necessidade de distribuir eventos para vários consumidores independentes (por exemplo, outros sistemas do CASD), caso em que um broker dedicado passa a se justificar.

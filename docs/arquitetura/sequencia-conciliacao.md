# Sequência: conciliação de um pagamento via webhook

O Asaas recebe resposta antes do processamento; a baixa acontece numa única transação. Detalhes no [ADR-0002](../adr/0002-postgresql-banco-e-fila.md).

```mermaid
sequenceDiagram
    autonumber
    participant A as Asaas
    participant API as API (webhook)
    participant DB as PostgreSQL
    participant W as Worker

    A->>API: POST /webhooks/asaas com o token
    API->>API: Valida o asaas-access-token
    API->>DB: Grava o evento (id único) e enfileira o job
    API-->>A: 200 OK em até 5 s

    Note over API,W: Daqui em diante, assíncrono

    DB->>W: Entrega o job (pg-boss)
    W->>DB: O evento já foi processado?
    alt Evento repetido
        W->>W: Descarta, sem efeito
    else Evento novo
        W->>DB: Uma transação: cobrança paga + movimentação de entrada + auditoria + evento marcado como processado
    end
```

| Passo | Garante | Requisito |
| --- | --- | --- |
| 2 | Ninguém além do Asaas altera dados financeiros | [Segurança.NF002] |
| 4 | O Asaas não conta falhas nem interrompe a fila | [Desempenho.NF001], [Confiabilidade.NF001] |
| 6 e 7 | Nenhuma entrada duplicada | [Confiabilidade.NF003] |
| 8 | Cobrança paga sempre tem movimentação | [Confiabilidade.NF004] |

Se a transação do passo 8 falhar, nada é gravado e o pg-boss tenta o job de novo; o evento já está salvo desde o passo 3.

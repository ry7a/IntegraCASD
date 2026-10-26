# Backup e restauração do banco

O requisito [Confiabilidade.NF006] pede cópia de segurança **diária**, guardada por **no mínimo 30 dias**, e
que a restauração seja **executada e documentada ao menos uma vez antes da entrega**, para a eficácia não ser
só presumida. Este playbook mostra como fazer as duas coisas e registra os testes feitos.

Os comandos são para o **PowerShell**, na raiz do repositório, com o banco no ar (`docker compose up -d`).

> **Atenção (LGPD):** um backup tem os dados pessoais dos alunos. Guarde-o fora do repositório (a pasta
> `backups/` e os arquivos `*.dump` estão no `.gitignore`), em lugar com acesso restrito à diretoria.

## 1. Fazer um backup

```powershell
.\scripts\backup\fazer-backup.ps1
```

Gera `backups\integracasd-AAAAMMDD-HHMMSS.dump` (formato *custom* do `pg_dump`: comprimido e restaurável com
`pg_restore`). O arquivo tem tudo o que está no banco: as tabelas do sistema, a trilha de auditoria e a fila do
pg-boss. Opções:

- `-Pasta D:\backups-integracasd`: grava em outra pasta (de preferência, outro disco).
- `-RemoverAntigos`: apaga os backups com mais de 30 dias. Sem essa opção, o script só lista quais são.

### Backup diário

Em produção, a forma de agendar depende do provedor de nuvem, ainda em escolha (issue #48): o mais simples é
usar o backup automático do PostgreSQL gerenciado, com retenção de 30 dias. Se o banco rodar numa máquina
própria, agende o script no **Agendador de Tarefas** do Windows (uma vez por dia, de madrugada):

```powershell
$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -File C:\caminho\IntegraCASD\scripts\backup\fazer-backup.ps1 -Pasta D:\backups-integracasd -RemoverAntigos" `
  -WorkingDirectory "C:\caminho\IntegraCASD"
$gatilho = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "IntegraCASD - backup diario" -Action $acao -Trigger $gatilho
```

## 2. Testar a restauração (sem mexer no banco em uso)

```powershell
.\scripts\backup\restaurar-backup.ps1 -Arquivo backups\integracasd-20261026-030000.dump
```

O script restaura num banco **separado** (`integracasd_restaurado`, ou o nome passado em `-Banco`) e mostra a
conferência: migrações aplicadas, contagem de usuários, alunos, cobranças, movimentações e registros da trilha,
e a data do último registro da trilha. Ele se recusa a restaurar por cima do banco em uso e a usar um nome que
já existe.

Para dar o teste por bom:

1. As contagens batem com as do banco de origem no momento do backup.
2. A trilha continua só de inclusão no restaurado (o comando abaixo tem de **dar erro**):
   ```powershell
   docker compose exec -T db psql -U integracasd -d integracasd_restaurado -c "update registros_auditoria set detalhe = 'x'"
   ```
3. A aplicação sobe apontando para o banco restaurado e o login funciona (troque o `DATABASE_URL` só para o
   teste, numa porta diferente).

Depois do teste, apague o banco de teste:
`docker compose exec -T db dropdb -U integracasd integracasd_restaurado`.

## 3. Recuperar de verdade (trocar o banco em uso pelo restaurado)

Só em incidente (banco corrompido, dados apagados por engano). Combine com a diretoria antes.

1. Restaure o backup escolhido num banco separado, como no passo 2, e confira.
2. Pare a API e o worker (nada pode estar gravando).
3. Troque os nomes, guardando o banco antigo para investigação (nada é apagado):
   ```powershell
   docker compose exec -T db psql -U integracasd -d postgres -c "ALTER DATABASE integracasd RENAME TO integracasd_antes_20261026"
   docker compose exec -T db psql -U integracasd -d postgres -c "ALTER DATABASE integracasd_restaurado RENAME TO integracasd"
   ```
4. Suba a API e o worker. O que foi gravado depois do backup se perdeu aqui: a **sincronização com o Asaas**
   (Cobranças › Sincronizar, período das últimas semanas) recupera os pagamentos e as cobranças desse
   intervalo; lançamentos manuais de movimentação precisam ser refeitos.
5. Registre o incidente na tabela abaixo.

## 4. Registro dos testes de restauração

| Data | Quem | Ambiente | Origem do backup | Resultado |
| --- | --- | --- | --- | --- |
| 26/10/2026 | Claude (pedido de Marcello Ryaj) | Desenvolvimento (Docker local, PostgreSQL 18.6) | Banco de teste com dados fictícios: 25 movimentações, 1 contrato, 27 registros na trilha | Restaurado num banco separado; contagens e soma dos valores idênticas à origem; trilha continuou recusando `UPDATE`; API subiu sobre o restaurado, login e consultas ok. Os scripts recusaram restaurar por cima do banco em uso. |

**Pendente antes da entrega:** repetir o teste no ambiente de produção (ou homologação) assim que o provedor
for escolhido (issues #48, #49 e #52), e registrar aqui.

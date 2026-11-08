# Restauração de uma cópia de segurança [Confiabilidade.NF006]. Passo a passo em
# docs/playbooks/backup-e-restauracao.md.
#
# Restaura num banco SEPARADO (por padrão, integracasd_restaurado) e confere o resultado: o banco em
# uso não é tocado. Trocar o banco em uso pelo restaurado é um passo manual, descrito no playbook.
#
# Uso (na raiz do repositório, com o banco no ar):
#   .\scripts\backup\restaurar-backup.ps1 -Arquivo backups\integracasd-20261026-120000.dump
#   .\scripts\backup\restaurar-backup.ps1 -Arquivo ... -Banco outro_nome

param(
  [Parameter(Mandatory = $true)][string]$Arquivo,
  [string]$Banco = "integracasd_restaurado",
  [string]$Usuario = "integracasd"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Arquivo)) { throw "Arquivo não encontrado: $Arquivo" }
if ($Banco -eq "integracasd") {
  throw "Não restaure por cima do banco em uso. Restaure num banco separado e siga o playbook para trocar."
}

$existe = docker compose exec -T db psql -U $Usuario -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Banco'"
if ($existe -eq "1") {
  throw "O banco $Banco já existe. Escolha outro nome com -Banco (nada foi alterado)."
}

$nome = Split-Path $Arquivo -Leaf
docker compose cp $Arquivo "db:/tmp/$nome"
if ($LASTEXITCODE -ne 0) { throw "Não foi possível copiar o arquivo para o contêiner." }

# O finally apaga a cópia do dump dentro do contêiner também quando algo falha: ela tem os dados do banco
# (de produção, no teste mensal) e não pode ficar esquecida em /tmp.
try {
  docker compose exec -T db createdb -U $Usuario $Banco
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível criar o banco $Banco." }

  # --no-owner: o dono dos objetos passa a ser o usuário que restaura (útil ao restaurar em outro servidor).
  docker compose exec -T db pg_restore -U $Usuario -d $Banco --no-owner --exit-on-error "/tmp/$nome"
  if ($LASTEXITCODE -ne 0) { throw "O pg_restore falhou. O banco $Banco ficou incompleto; apague-o antes de tentar de novo." }
} finally {
  docker compose exec -T db rm -f "/tmp/$nome" | Out-Null
}

Write-Output "Restaurado em $Banco. Conferência:"
$consulta = @"
SELECT 'migracoes aplicadas', count(*)::text FROM _prisma_migrations WHERE finished_at IS NOT NULL
UNION ALL SELECT 'ultima migracao', max(migration_name) FROM _prisma_migrations
UNION ALL SELECT 'usuarios', count(*)::text FROM usuarios
UNION ALL SELECT 'alunos', count(*)::text FROM alunos
UNION ALL SELECT 'cobrancas', count(*)::text FROM cobrancas
UNION ALL SELECT 'movimentacoes', count(*)::text FROM movimentacoes
UNION ALL SELECT 'registros da trilha', count(*)::text FROM registros_auditoria
UNION ALL SELECT 'ultimo registro da trilha', coalesce(max(ocorrido_em)::text, '-') FROM registros_auditoria
"@
docker compose exec -T db psql -U $Usuario -d $Banco -tA -F " = " -c $consulta

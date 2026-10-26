# Cópia de segurança do banco [Confiabilidade.NF006]. Passo a passo em docs/playbooks/backup-e-restauracao.md.
#
# Gera um arquivo no formato "custom" do pg_dump (comprimido, restaurável com pg_restore), com tudo o
# que está no banco: tabelas do sistema, trilha de auditoria e a fila do pg-boss.
#
# Uso (na raiz do repositório, com o banco no ar):
#   .\scripts\backup\fazer-backup.ps1
#   .\scripts\backup\fazer-backup.ps1 -Pasta D:\backups-integracasd
#   .\scripts\backup\fazer-backup.ps1 -RemoverAntigos     # apaga os backups com mais de 30 dias
#
# O arquivo tem dados pessoais de alunos (LGPD): guarde fora do repositório, em lugar com acesso restrito.

param(
  [string]$Pasta = "backups",
  [string]$Banco = "integracasd",
  [string]$Usuario = "integracasd",
  [int]$DiasDeRetencao = 30,
  [switch]$RemoverAntigos
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
$carimbo = Get-Date -Format "yyyyMMdd-HHmmss"
$nome = "integracasd-$carimbo.dump"
$destino = Join-Path $Pasta $nome

# O pg_dump grava dentro do contêiner e o arquivo é copiado para fora. Redirecionar a saída (">") no
# PowerShell 5.1 trataria o arquivo binário como texto e o corromperia.
docker compose exec -T db pg_dump -U $Usuario -d $Banco -Fc -f "/tmp/$nome"
if ($LASTEXITCODE -ne 0) { throw "O pg_dump falhou. Confira se o banco está no ar (docker compose up -d)." }
docker compose cp "db:/tmp/$nome" $destino
if ($LASTEXITCODE -ne 0) { throw "Não foi possível copiar o backup para $destino." }
docker compose exec -T db rm "/tmp/$nome" | Out-Null

$tamanho = [math]::Round((Get-Item $destino).Length / 1KB)
Write-Output "Backup gravado em $destino ($tamanho KB)."

# Retenção mínima de 30 dias: só lista os mais antigos; apaga apenas com -RemoverAntigos.
$limite = (Get-Date).AddDays(-$DiasDeRetencao)
$antigos = Get-ChildItem -Path $Pasta -Filter "integracasd-*.dump" | Where-Object { $_.LastWriteTime -lt $limite }
foreach ($antigo in $antigos) {
  if ($RemoverAntigos) {
    Remove-Item $antigo.FullName -Confirm:$false
    Write-Output "Removido (mais de $DiasDeRetencao dias): $($antigo.Name)"
  } else {
    Write-Output "Mais de $DiasDeRetencao dias (use -RemoverAntigos para apagar): $($antigo.Name)"
  }
}

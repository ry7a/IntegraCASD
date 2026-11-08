#!/bin/sh
# Backup diário na Railway [Confiabilidade.NF006] (ADR-0006). Roda como cron no serviço `backup`
# (imagem de scripts/backup/Dockerfile), faz o trabalho e sai. Configuração em
# docs/playbooks/implantacao.md, passo 4.6.
#
# Variáveis:
#   AMBIENTE          homologacao ou producao: vira a pasta no bucket e parte do nome do arquivo.
#   DATABASE_URL      banco a copiar (na Railway: ${{Postgres.DATABASE_URL}}).
#   BACKUP_PING_URL   opcional: URL do check do Healthchecks.io, chamada só se tudo deu certo.
#   RCLONE_CONFIG_*   os remotes `r2` (o bucket no Cloudflare R2) e `r2cifrado` (rclone crypt por cima
#                     dele). O rclone lê a configuração só dessas variáveis; não há arquivo de configuração.
#
# Qualquer falha encerra o script com erro e sem o ping: o Healthchecks.io avisa quando o ping não chega.
# O script nunca imprime a DATABASE_URL nem as variáveis do rclone (têm senhas).

set -eu

# ${VAR:?msg} aborta com a mensagem se a variável não existir ou estiver vazia.
: "${AMBIENTE:?defina AMBIENTE (homologacao ou producao)}"
: "${DATABASE_URL:?defina DATABASE_URL}"

case "$AMBIENTE" in
  homologacao | producao) ;;
  *)
    echo "backup: AMBIENTE invalido: '$AMBIENTE' (use homologacao ou producao)" >&2
    exit 1
    ;;
esac

# Horário em UTC, o mesmo do cron da Railway.
carimbo=$(date -u +%Y%m%d-%H%M%S)
arquivo="/tmp/integracasd-$AMBIENTE-$carimbo.dump"

# O dump fica só neste contêiner, que é descartado ao fim da execução. Ainda assim, apagamos ao sair.
trap 'rm -f "$arquivo"' EXIT

echo "backup: gerando o dump de $AMBIENTE..."
# Formato custom (-Fc): comprimido e restaurável com pg_restore, o mesmo do fazer-backup.ps1.
pg_dump "$DATABASE_URL" -Fc -f "$arquivo"

# -s: existe e não está vazio.
if [ ! -s "$arquivo" ]; then
  echo "backup: o dump saiu vazio" >&2
  exit 1
fi
tamanho=$(du -k "$arquivo" | cut -f1)
echo "backup: dump gerado ($tamanho KB): $(basename "$arquivo")"

echo "backup: enviando para r2cifrado:$AMBIENTE/ ..."
rclone copy "$arquivo" "r2cifrado:$AMBIENTE/"
echo "backup: enviado."

# Vazia ou ausente: só não pinga.
if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$BACKUP_PING_URL"
  echo "backup: ping enviado."
fi

echo "backup: concluido."

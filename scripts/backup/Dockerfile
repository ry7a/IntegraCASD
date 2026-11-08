# Imagem do serviço `backup` da Railway (ADR-0006): um cron diário que roda backup-railway.sh e sai.
# Passo a passo em docs/playbooks/implantacao.md, passo 4.6.
#
# Contexto do build: a raiz do repositório (é o que a Railway usa com RAILWAY_DOCKERFILE_PATH).
#   docker build -f scripts/backup/Dockerfile .

# A mesma imagem do banco (docker-compose.yml): o pg_dump tem de ser da mesma versão do servidor, ou mais nova.
FROM postgres:18.6

# rclone do Debian (1.60 no trixie): o provider "Cloudflare" do R2 existe desde a 1.59.
# curl: para avisar o Healthchecks.io. ca-certificates: HTTPS do R2 e do Healthchecks.
RUN apt-get update \
 && apt-get install -y --no-install-recommends rclone curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY scripts/backup/backup-railway.sh /usr/local/bin/backup-railway.sh
# Garante a permissão de execução mesmo se o arquivo vier de um checkout sem ela.
RUN chmod +x /usr/local/bin/backup-railway.sh

# Roda como o usuário sem privilégios que a imagem do postgres já tem; o script só escreve em /tmp.
USER postgres

# O ENTRYPOINT da imagem do postgres (docker-entrypoint.sh) repassa para qualquer comando que não seja
# "postgres", então o CMD abaixo roda o script direto, sem iniciar um servidor.
CMD ["/usr/local/bin/backup-railway.sh"]

# Imagem única do IntegraCASD (ADR-0006): o serviço `app` da Railway roda a API, que também serve o site,
# e o `worker` usa esta mesma imagem com o comando `node dist/main-worker.js`.
# Passo a passo em docs/playbooks/implantacao.md (itens 1.11, 2.5 e 2.6).
#
# É uma imagem "gorda" de propósito: leva as devDependencies, entre elas a CLI do Prisma, que o
# pre-deploy da Railway usa para rodar `pnpm exec prisma migrate deploy` nesta mesma imagem.
# Simplicidade vale mais que tamanho aqui.

FROM node:24.20.0-bookworm-slim

# O schema engine do Prisma (usado pelo `migrate deploy`) precisa da libssl, e a imagem slim não traz o
# OpenSSL. Sem ele o Prisma não detecta a versão e baixa o engine errado (openssl-1.1.x).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# A versão do pnpm é a do campo "packageManager" do package.json da raiz.
RUN npm i -g pnpm@11.28.5

WORKDIR /repo

# O .dockerignore deixa de fora node_modules, dist, .env, .git e os dados reais (planilhas, dumps).
COPY . .

# Instalação normal, com os scripts de instalação ligados. Eles fazem duas coisas de que a imagem precisa:
# - o postinstall do @prisma/engines baixa o schema engine, que o `prisma migrate deploy` usa;
# - o postinstall do apps/api roda `prisma generate` (cliente em apps/api/src/generated).
# O `prepare` da raiz tenta ativar os ganchos do git e, sem git na imagem, apenas segue em frente
# (`|| exit 0`). Por isso não usamos --ignore-scripts, que obrigaria a repetir aqui cada um desses passos.
# NODE_ENV ainda não é production: o pnpm instalaria só as dependencies e pularia as devDependencies.
RUN pnpm install --frozen-lockfile

# O build do web gera apps/web/dist, que a API serve em produção (caminho padrão, nada a copiar).
RUN pnpm --filter web build \
 && pnpm --filter api build

# Só depois do install e do build.
ENV NODE_ENV=production

WORKDIR /repo/apps/api
EXPOSE 3000

# Roda como o usuário sem privilégios `node` (uid 1000, que já vem na imagem oficial), não como root: uma
# falha na aplicação não dá ao invasor poder de root no contêiner. Os arquivos de /repo continuam do root
# (copiados e gerados acima) e o `node` só os lê, o que basta: nem a API, nem o worker, nem o
# `prisma migrate deploy` do pre-deploy escrevem em /repo (os caches, como o do jiti, caem no /tmp ou são
# desligados quando a pasta não aceita escrita). Vale para tudo que rodar nesta imagem depois desta linha.
USER node
CMD ["node", "dist/main.js"]

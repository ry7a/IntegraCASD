-- CreateEnum
CREATE TYPE "tipo_pendencia" AS ENUM ('SEM_COBRANCA', 'APOS_REGISTRO_MANUAL', 'DIVERGENCIA');

-- CreateEnum
CREATE TYPE "origem_pendencia" AS ENUM ('WEBHOOK', 'SINCRONIZACAO');

-- CreateTable
CREATE TABLE "pendencias_conciliacao" (
    "id" UUID NOT NULL,
    "tipo" "tipo_pendencia" NOT NULL,
    "origem" "origem_pendencia" NOT NULL,
    "id_asaas" TEXT NOT NULL,
    "cobranca_id" UUID,
    "evento_webhook_id" UUID,
    "descricao" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvida_em" TIMESTAMP(3),
    "resolvida_por_id" UUID,
    "resolucao" TEXT,

    CONSTRAINT "pendencias_conciliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pendencias_conciliacao_resolvida_em_criada_em_idx" ON "pendencias_conciliacao"("resolvida_em", "criada_em");

-- CreateIndex
CREATE UNIQUE INDEX "pendencias_conciliacao_aberta_key" ON "pendencias_conciliacao"("id_asaas", "tipo") WHERE ("resolvida_em" IS NULL);

-- AddForeignKey
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_evento_webhook_id_fkey" FOREIGN KEY ("evento_webhook_id") REFERENCES "eventos_webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_resolvida_por_id_fkey" FOREIGN KEY ("resolvida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- Resolução completa ou nenhuma: quando, quem e o texto de quem conferiu.
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_resolucao_check"
  CHECK (("resolvida_em" IS NULL) = ("resolvida_por_id" IS NULL) AND ("resolvida_em" IS NULL) = ("resolucao" IS NULL));

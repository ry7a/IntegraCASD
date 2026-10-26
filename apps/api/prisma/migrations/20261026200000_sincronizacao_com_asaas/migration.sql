-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "sincronizada_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "execucoes_sincronizacao" (
    "id" UUID NOT NULL,
    "origem" "origem_execucao" NOT NULL,
    "vencimento_de" DATE,
    "vencimento_ate" DATE,
    "cobranca_id" UUID,
    "pedida_por_id" UUID,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMP(3),
    "conferidas" INTEGER NOT NULL DEFAULT 0,
    "atualizadas" INTEGER NOT NULL DEFAULT 0,
    "somente_no_asaas" INTEGER NOT NULL DEFAULT 0,
    "nao_identificadas" INTEGER NOT NULL DEFAULT 0,
    "para_conferir" INTEGER NOT NULL DEFAULT 0,
    "falha" TEXT,

    CONSTRAINT "execucoes_sincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execucoes_sincronizacao_iniciada_em_idx" ON "execucoes_sincronizacao"("iniciada_em");

-- AddForeignKey
ALTER TABLE "execucoes_sincronizacao" ADD CONSTRAINT "execucoes_sincronizacao_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_sincronizacao" ADD CONSTRAINT "execucoes_sincronizacao_pedida_por_id_fkey" FOREIGN KEY ("pedida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- Uma execução é de um período (de/até, nessa ordem) ou de uma cobrança só; contagens nunca negativas.
ALTER TABLE "execucoes_sincronizacao" ADD CONSTRAINT "execucoes_sincronizacao_alvo_check"
  CHECK ((("vencimento_de" IS NOT NULL AND "vencimento_ate" IS NOT NULL AND "vencimento_de" <= "vencimento_ate") AND "cobranca_id" IS NULL)
      OR ("vencimento_de" IS NULL AND "vencimento_ate" IS NULL AND "cobranca_id" IS NOT NULL));
ALTER TABLE "execucoes_sincronizacao" ADD CONSTRAINT "execucoes_sincronizacao_contagens_check"
  CHECK ("conferidas" >= 0 AND "atualizadas" >= 0 AND "somente_no_asaas" >= 0 AND "nao_identificadas" >= 0 AND "para_conferir" >= 0);

-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "renegociacao_de_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_renegociacao_de_id_key" ON "cobrancas"("renegociacao_de_id");

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_renegociacao_de_id_fkey" FOREIGN KEY ("renegociacao_de_id") REFERENCES "cobrancas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Uma cobrança não renegocia a si mesma.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_renegociacao_check"
  CHECK ("renegociacao_de_id" IS NULL OR "renegociacao_de_id" <> "id");

-- CreateEnum
CREATE TYPE "ambiente_asaas" AS ENUM ('SANDBOX', 'PRODUCAO');

-- CreateTable
CREATE TABLE "configuracoes_asaas" (
    "id" UUID NOT NULL,
    "ambiente" "ambiente_asaas" NOT NULL,
    "chave_cifrada" TEXT NOT NULL,
    "prazo_alerta_horas" INTEGER NOT NULL,
    "testada_em" TIMESTAMP(3) NOT NULL,
    "alterado_por_id" UUID NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_asaas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracoes_asaas_data_criacao_idx" ON "configuracoes_asaas"("data_criacao");

-- AddForeignKey
ALTER TABLE "configuracoes_asaas" ADD CONSTRAINT "configuracoes_asaas_alterado_por_id_fkey" FOREIGN KEY ("alterado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Prazo do alerta de interrupção: 12, 24 ou 48 horas [Administração.RF004] fluxo A2, [Confiabilidade.NF002].
ALTER TABLE "configuracoes_asaas" ADD CONSTRAINT "configuracoes_asaas_prazo_check"
  CHECK ("prazo_alerta_horas" IN (12, 24, 48));

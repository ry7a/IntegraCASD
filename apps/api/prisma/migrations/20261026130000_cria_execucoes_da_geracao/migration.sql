-- CreateEnum
CREATE TYPE "origem_execucao" AS ENUM ('AGENDADA', 'MANUAL');

-- CreateTable
CREATE TABLE "execucoes_geracao" (
    "id" UUID NOT NULL,
    "referencia" CHAR(7) NOT NULL,
    "origem" "origem_execucao" NOT NULL,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMP(3),
    "total_criadas" INTEGER NOT NULL DEFAULT 0,
    "total_ja_existentes" INTEGER NOT NULL DEFAULT 0,
    "total_falhas" INTEGER NOT NULL DEFAULT 0,
    "falhas" JSONB NOT NULL DEFAULT '[]',
    "interrompida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "execucoes_geracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execucoes_geracao_referencia_iniciada_em_idx" ON "execucoes_geracao"("referencia", "iniciada_em");


-- CreateTable
CREATE TABLE "alertas_conciliacao" (
    "id" UUID NOT NULL,
    "aberto_em" TIMESTAMP(3) NOT NULL,
    "ultima_notificacao_em" TIMESTAMP(3),
    "horas_sem_notificacao" INTEGER NOT NULL,
    "prazo_horas" INTEGER NOT NULL,
    "envios" INTEGER NOT NULL DEFAULT 0,
    "ultimo_envio_em" TIMESTAMP(3),
    "resolvido_em" TIMESTAMP(3),
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_conciliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertas_conciliacao_resolvido_em_idx" ON "alertas_conciliacao"("resolvido_em");


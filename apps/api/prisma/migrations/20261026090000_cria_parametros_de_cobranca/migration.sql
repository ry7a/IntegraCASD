-- CreateTable
CREATE TABLE "parametros_cobranca" (
    "id" UUID NOT NULL,
    "valor_mensalidade_centavos" INTEGER NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "dia_geracao" INTEGER NOT NULL,
    "multa_percentual" INTEGER NOT NULL,
    "juros_mensal_percentual" INTEGER NOT NULL,
    "alterado_por_id" UUID NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parametros_cobranca_data_criacao_idx" ON "parametros_cobranca"("data_criacao");

-- AddForeignKey
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_alterado_por_id_fkey" FOREIGN KEY ("alterado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve (CHECK), escritas à mão [Administração.RF003].
-- Dias de 1 a 28: todo mês tem esses dias, inclusive fevereiro.
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_dias_check"
  CHECK ("dia_geracao" BETWEEN 1 AND 28 AND "dia_vencimento" BETWEEN 1 AND 28);
-- Fluxo E1: a geração precisa ser antes do vencimento, senão a cobrança já nasceria vencida.
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_geracao_antes_check"
  CHECK ("dia_geracao" < "dia_vencimento");
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_valor_check"
  CHECK ("valor_mensalidade_centavos" > 0);
-- Multa até 2% (Código de Defesa do Consumidor, art. 52) e juros até 1% ao mês.
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_encargos_check"
  CHECK ("multa_percentual" BETWEEN 0 AND 2 AND "juros_mensal_percentual" BETWEEN 0 AND 1);

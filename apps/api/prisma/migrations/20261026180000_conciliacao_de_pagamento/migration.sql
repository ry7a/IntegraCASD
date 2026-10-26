-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "disponivel_em" DATE;

-- AlterTable
ALTER TABLE "eventos_webhook" ADD COLUMN     "pendencia" TEXT;

-- AlterTable
ALTER TABLE "parametros_cobranca" ADD COLUMN     "categoria_avulsa_id" UUID,
ADD COLUMN     "categoria_mensalidade_id" UUID,
ADD COLUMN     "conta_recebimento_id" UUID;

-- AddForeignKey
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_conta_recebimento_id_fkey" FOREIGN KEY ("conta_recebimento_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_categoria_mensalidade_id_fkey" FOREIGN KEY ("categoria_mensalidade_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_cobranca" ADD CONSTRAINT "parametros_cobranca_categoria_avulsa_id_fkey" FOREIGN KEY ("categoria_avulsa_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- Cobrança paga (pelo Asaas ou à mão) sempre tem a data do pagamento e a movimentação de entrada,
-- gravadas na mesma transação da baixa [Confiabilidade.NF004].
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_paga_com_entrada_check"
  CHECK ("situacao" NOT IN ('PAGA', 'PAGA_COM_REGISTRO_MANUAL') OR ("paga_em" IS NOT NULL AND "movimentacao_id" IS NOT NULL));

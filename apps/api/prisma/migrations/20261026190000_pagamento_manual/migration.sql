-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "justificativa_manual" TEXT;

-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- [Cobranças.RF006] fluxo E1: pagamento registrado à mão sempre tem justificativa escrita.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_justificativa_manual_check"
  CHECK ("situacao" <> 'PAGA_COM_REGISTRO_MANUAL' OR "justificativa_manual" IS NOT NULL);

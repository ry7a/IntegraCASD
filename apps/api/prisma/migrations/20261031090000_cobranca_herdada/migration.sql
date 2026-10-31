-- AlterEnum
ALTER TYPE "origem_cobranca" ADD VALUE 'HERDADA';

-- AlterTable
ALTER TABLE "cobrancas" ALTER COLUMN "id_asaas" DROP NOT NULL;

-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- ADR-0005: só a cobrança herdada da planilha fica sem id do Asaas; todas as outras têm, sempre
-- ([Confiabilidade.NF005]). A comparação é feita como texto porque o PostgreSQL não deixa usar um
-- valor de enum na mesma transação em que ele foi criado.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_id_asaas_check"
  CHECK (("origem"::text = 'HERDADA') = ("id_asaas" IS NULL));

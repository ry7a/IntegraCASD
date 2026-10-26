-- CreateEnum
CREATE TYPE "origem_cobranca" AS ENUM ('MENSALIDADE', 'AVULSA');

-- CreateEnum
CREATE TYPE "situacao_cobranca" AS ENUM ('ABERTA', 'PAGA', 'PAGA_COM_REGISTRO_MANUAL', 'CANCELADA', 'ESTORNADA');

-- CreateTable
CREATE TABLE "clientes_asaas" (
    "aluno_id" UUID NOT NULL,
    "id_asaas" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_asaas_pkey" PRIMARY KEY ("aluno_id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" UUID NOT NULL,
    "id_asaas" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "origem" "origem_cobranca" NOT NULL,
    "referencia" CHAR(7),
    "descricao" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "multa_percentual" INTEGER NOT NULL,
    "juros_mensal_percentual" INTEGER NOT NULL,
    "situacao" "situacao_cobranca" NOT NULL DEFAULT 'ABERTA',
    "url_boleto" TEXT,
    "url_fatura" TEXT,
    "emitida_por_id" UUID,
    "paga_em" DATE,
    "movimentacao_id" UUID,
    "cancelada_em" TIMESTAMP(3),
    "motivo_cancelamento" TEXT,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_asaas_id_asaas_key" ON "clientes_asaas"("id_asaas");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_id_asaas_key" ON "cobrancas"("id_asaas");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_movimentacao_id_key" ON "cobrancas"("movimentacao_id");

-- CreateIndex
CREATE INDEX "cobrancas_situacao_vencimento_idx" ON "cobrancas"("situacao", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_aluno_id_referencia_key" ON "cobrancas"("aluno_id", "referencia");

-- AddForeignKey
ALTER TABLE "clientes_asaas" ADD CONSTRAINT "clientes_asaas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_emitida_por_id_fkey" FOREIGN KEY ("emitida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve (CHECK), escritas à mão.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_valor_positivo_check"
  CHECK ("valor_centavos" > 0);
-- Os mesmos limites dos parâmetros: multa até 2% e juros até 1% ao mês.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_encargos_check"
  CHECK ("multa_percentual" BETWEEN 0 AND 2 AND "juros_mensal_percentual" BETWEEN 0 AND 1);
-- Mensalidade tem mês de referência; avulsa não tem.
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_referencia_check"
  CHECK (("origem" = 'MENSALIDADE') = ("referencia" IS NOT NULL));

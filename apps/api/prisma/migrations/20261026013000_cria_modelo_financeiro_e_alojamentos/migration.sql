-- CreateEnum
CREATE TYPE "periodicidade_contrato" AS ENUM ('MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA');

-- CreateEnum
CREATE TYPE "situacao_contrato" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "situacao_projeto" AS ENUM ('A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO', 'EXECUTADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "tipo_conta" AS ENUM ('CORRENTE', 'APLICACAO');

-- CreateEnum
CREATE TYPE "tipo_categoria" AS ENUM ('ENTRADA', 'SAIDA', 'AMBOS');

-- CreateEnum
CREATE TYPE "tipo_movimentacao" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('ASAAS', 'PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO');

-- CreateEnum
CREATE TYPE "origem_movimentacao" AS ENUM ('MANUAL', 'CONCILIACAO_AUTOMATICA', 'REGISTRO_MANUAL_DE_COBRANCA', 'ESTORNO');

-- AlterTable
ALTER TABLE "alunos" ADD COLUMN     "alojamento_id" UUID,
ADD COLUMN     "apelido" TEXT;

-- CreateTable
CREATE TABLE "alojamentos" (
    "id" UUID NOT NULL,
    "bloco" TEXT NOT NULL,
    "apto" TEXT NOT NULL,
    "vaga" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alojamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "cargo" TEXT NOT NULL,
    "salario_referencia_centavos" INTEGER NOT NULL,
    "data_admissao" DATE NOT NULL,
    "data_desligamento" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "contraparte" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "periodicidade" "periodicidade_contrato" NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "situacao" "situacao_contrato" NOT NULL DEFAULT 'ATIVO',
    "data_encerramento" DATE,
    "justificativa_encerramento" TEXT,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "responsavel" TEXT,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "orcamento_previsto_centavos" INTEGER,
    "situacao" "situacao_projeto" NOT NULL DEFAULT 'A_LIBERAR',
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verbas_mensais" (
    "id" UUID NOT NULL,
    "centro_custo_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor_liberado_centavos" INTEGER NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verbas_mensais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "tipo_conta" NOT NULL,
    "saldo_inicial_centavos" INTEGER NOT NULL,
    "data_saldo_inicial" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "tipo_categoria" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "tipo" "tipo_movimentacao" NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "categoria_id" UUID NOT NULL,
    "forma_pagamento" "forma_pagamento" NOT NULL,
    "origem" "origem_movimentacao" NOT NULL DEFAULT 'MANUAL',
    "descricao" TEXT NOT NULL,
    "contrato_id" UUID,
    "projeto_id" UUID,
    "funcionario_id" UUID,
    "centro_custo_id" UUID,
    "estorno_de_id" UUID,
    "motivo_estorno" TEXT,
    "transferencia_par_id" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alojamentos_bloco_apto_vaga_key" ON "alojamentos"("bloco", "apto", "vaga");

-- CreateIndex
CREATE UNIQUE INDEX "funcionarios_cpf_ativo_key" ON "funcionarios"("cpf") WHERE ("ativo" = true);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_codigo_key" ON "contratos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "projetos_codigo_key" ON "projetos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_nome_key" ON "centros_custo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "verbas_mensais_centro_custo_id_ano_mes_key" ON "verbas_mensais"("centro_custo_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "contas_nome_key" ON "contas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_ativa_key" ON "categorias"("nome") WHERE ("ativo" = true);

-- CreateIndex
CREATE UNIQUE INDEX "movimentacoes_estorno_de_id_key" ON "movimentacoes"("estorno_de_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimentacoes_transferencia_par_id_key" ON "movimentacoes"("transferencia_par_id");

-- CreateIndex
CREATE INDEX "movimentacoes_data_idx" ON "movimentacoes"("data");

-- CreateIndex
CREATE INDEX "movimentacoes_conta_id_idx" ON "movimentacoes"("conta_id");

-- CreateIndex
CREATE INDEX "movimentacoes_categoria_id_idx" ON "movimentacoes"("categoria_id");

-- CreateIndex
CREATE INDEX "movimentacoes_contrato_id_idx" ON "movimentacoes"("contrato_id");

-- CreateIndex
CREATE INDEX "movimentacoes_projeto_id_idx" ON "movimentacoes"("projeto_id");

-- CreateIndex
CREATE INDEX "movimentacoes_funcionario_id_idx" ON "movimentacoes"("funcionario_id");

-- CreateIndex
CREATE INDEX "movimentacoes_centro_custo_id_idx" ON "movimentacoes"("centro_custo_id");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_alojamento_ativo_key" ON "alunos"("alojamento_id") WHERE ("ativo" = true);

-- AddForeignKey
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_alojamento_id_fkey" FOREIGN KEY ("alojamento_id") REFERENCES "alojamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verbas_mensais" ADD CONSTRAINT "verbas_mensais_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_estorno_de_id_fkey" FOREIGN KEY ("estorno_de_id") REFERENCES "movimentacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_transferencia_par_id_fkey" FOREIGN KEY ("transferencia_par_id") REFERENCES "movimentacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não descreve no schema (CHECK). Escritas à mão nesta migração.

-- Dinheiro: o valor da movimentação é sempre positivo; o sinal vem do tipo.
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_valor_positivo_check"
  CHECK ("valor_centavos" > 0);

-- No máximo um vínculo de origem: contrato, projeto, funcionário ou centro de custo.
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_um_vinculo_check"
  CHECK (num_nonnulls("contrato_id", "projeto_id", "funcionario_id", "centro_custo_id") <= 1);

-- Estorno: a movimentação espelho tem origem ESTORNO, aponta para a original e traz o motivo.
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_estorno_check"
  CHECK (
    ("origem" = 'ESTORNO') = ("estorno_de_id" IS NOT NULL)
    AND ("estorno_de_id" IS NULL OR "motivo_estorno" IS NOT NULL)
    AND ("estorno_de_id" IS NULL OR "estorno_de_id" <> "id")
  );

-- Transferência: uma perna não pode apontar para si mesma.
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_transferencia_check"
  CHECK ("transferencia_par_id" IS NULL OR "transferencia_par_id" <> "id");

ALTER TABLE "verbas_mensais" ADD CONSTRAINT "verbas_mensais_mes_check"
  CHECK ("mes" BETWEEN 1 AND 12);
ALTER TABLE "verbas_mensais" ADD CONSTRAINT "verbas_mensais_valor_check"
  CHECK ("valor_liberado_centavos" >= 0);

-- O término não pode ser anterior ao início [Cadastros.RF004].
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_periodo_check"
  CHECK ("data_fim" IS NULL OR "data_fim" >= "data_inicio");
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_valor_check"
  CHECK ("valor_centavos" >= 0);

ALTER TABLE "projetos" ADD CONSTRAINT "projetos_periodo_check"
  CHECK ("data_fim" IS NULL OR "data_fim" >= "data_inicio");
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_orcamento_check"
  CHECK ("orcamento_previsto_centavos" IS NULL OR "orcamento_previsto_centavos" >= 0);

ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_periodo_check"
  CHECK ("data_desligamento" IS NULL OR "data_desligamento" >= "data_admissao");
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_salario_check"
  CHECK ("salario_referencia_centavos" >= 0);

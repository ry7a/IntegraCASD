-- CreateEnum
CREATE TYPE "situacao_aluno" AS ENUM ('MATRICULADO', 'TRANCADO', 'DESLIGADO', 'FORMADO', 'INTERCAMBIO');

-- CreateEnum
CREATE TYPE "posto_aluno" AS ENUM ('CIVIL', 'ALUNO_MILITAR', 'ASP_OF');

-- CreateEnum
CREATE TYPE "curso_aluno" AS ENUM ('AER', 'ELE', 'MEC', 'CIV', 'COMP', 'AESP');

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "email" TEXT NOT NULL,
    "matricula" INTEGER,
    "situacao" "situacao_aluno",
    "posto" "posto_aluno",
    "curso" "curso_aluno",
    "turma_id" UUID,
    "celular" TEXT,
    "alojamento" TEXT,
    "apto" TEXT,
    "vaga" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "turmas_nome_key" ON "turmas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_matricula_key" ON "alunos"("matricula");

-- CreateIndex
CREATE INDEX "alunos_turma_id_idx" ON "alunos"("turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_cpf_ativo_key" ON "alunos"("cpf") WHERE ("ativo" = true);

-- AddForeignKey
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras que o Prisma não descreve (CHECK), escritas à mão.
-- ADR-0005: a cobrança herdada da planilha também guarda o mês de referência, para a geração
-- recorrente não cobrar de novo um mês que veio da planilha. Antes, só a mensalidade tinha referência.
-- Agora: mensalidade e herdada sempre têm; a avulsa nunca tem. Comparação como texto, como na
-- migração 20261031090000.
ALTER TABLE "cobrancas" DROP CONSTRAINT "cobrancas_referencia_check";
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_referencia_check"
  CHECK (("origem"::text = 'AVULSA') = ("referencia" IS NULL));

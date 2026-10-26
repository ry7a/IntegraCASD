-- Trilha de auditoria inalterável [Segurança.NF006]: nenhum perfil, nenhum código e nenhuma
-- rotina pode alterar ou apagar um registro depois de gravado. A garantia fica no próprio banco,
-- e não só na ausência de tela ou rota (ADR-0004).
-- O Prisma não descreve gatilhos no schema; esta migração é escrita à mão.

CREATE FUNCTION "trilha_de_auditoria_recusa_mudanca"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria é só de inclusão: % recusado em registros_auditoria.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "registros_auditoria_so_inclusao"
  BEFORE UPDATE OR DELETE ON "registros_auditoria"
  FOR EACH ROW EXECUTE FUNCTION "trilha_de_auditoria_recusa_mudanca"();

-- TRUNCATE não dispara gatilhos de linha; este cobre o apagamento em massa.
CREATE TRIGGER "registros_auditoria_sem_truncate"
  BEFORE TRUNCATE ON "registros_auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION "trilha_de_auditoria_recusa_mudanca"();

import type { Prisma } from '../../generated/prisma/client.js';

// Ponto central de gravação da trilha de auditoria [Segurança.NF006].
//
// Por que uma função chamada DENTRO da transação, e não um interceptor do Nest: o interceptor
// roda depois que o caso de uso terminou e a transação já foi confirmada. Se a gravação da
// trilha falhasse ali, o dado ficaria alterado sem registro. Aqui, ou a alteração e o registro
// são gravados juntos, ou nenhum dos dois é (ADR-0004).
//
// A trilha é só de inclusão: o banco recusa UPDATE e DELETE em registros_auditoria (gatilho da
// migração 20261026060000), e a função de aptidão B13 barra gravação fora deste arquivo.

// As listas são a fonte única: os tipos saem delas, e a consulta da trilha valida os filtros com elas.
export const OPERACOES_AUDITADAS = [
  'INCLUSAO',
  'ALTERACAO',
  'INATIVACAO',
  'REATIVACAO',
  'EXCLUSAO',
  'ESTORNO',
  'BLOQUEIO_AUTENTICACAO',
  'OBTENCAO_DE_BOLETO',
  'CANCELAMENTO',
] as const;
export type OperacaoAuditada = (typeof OPERACOES_AUDITADAS)[number];

export const ENTIDADES_AUDITADAS = [
  'USUARIO',
  'CATEGORIA',
  'ALUNO',
  'FUNCIONARIO',
  'CONTRATO',
  'PROJETO',
  'COBRANCA',
  'MOVIMENTACAO',
  'CONFIGURACAO',
  'PENDENCIA',
  'ALERTA_DE_CONCILIACAO',
] as const;
export type EntidadeAuditada = (typeof ENTIDADES_AUDITADAS)[number];

export type RegistroNaTrilha = {
  // Nulo = rotina automática (geração recorrente, conciliação, sincronização).
  usuarioId: string | null;
  operacao: OperacaoAuditada;
  entidade: EntidadeAuditada;
  registroId: string;
  // Texto curto para quem lê a trilha. Nunca coloque segredos nem dados pessoais (nome, e-mail,
  // CPF, telefone...): a trilha não pode ser apagada, então um dado pessoal gravado aqui não sai
  // mais (LGPD). O registro já fica identificado por `entidade` + `registroId`. Nomes de campos
  // alterados podem entrar ("Aluno alterado: email, celular."), os valores não. Regra B14.
  detalhe: string;
};

// `tx` é o cliente da transação em andamento: `prisma.$transaction(async (tx) => ...)`.
export async function registrarNaTrilha(tx: Prisma.TransactionClient, registro: RegistroNaTrilha): Promise<void> {
  await tx.registroAuditoria.create({ data: registro });
}

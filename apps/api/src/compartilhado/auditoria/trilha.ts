import { Logger } from '@nestjs/common';
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

// Segunda barreira, em tempo de execução, além da B14 (que só lê o código das chamadas). O detalhe pode
// levar texto livre digitado por alguém (descrição da movimentação, justificativa, motivo), e ali pode
// aparecer um e-mail ou um CPF. Mascarar, e não recusar: recusar quebraria uma operação legítima só por
// causa do texto. Não pega nome nem telefone formatado: esses continuam dependendo de quem escreve.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 11 dígitos, com ou sem a máscara 000.000.000-00. As bordas (?<!\w) e (?!\w) evitam pegar um pedaço de
// algo maior: id com letras ou "_" (pay_12345678901), número com mais dígitos (timestamp), uuid.
const CPF = /(?<!\w)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\w)/g;
export const MASCARA_DE_EMAIL = '[e-mail removido]';
export const MASCARA_DE_CPF = '[CPF removido]';

export function mascararDadosPessoais(texto: string): string {
  return texto.replace(EMAIL, MASCARA_DE_EMAIL).replace(CPF, MASCARA_DE_CPF);
}

const logger = new Logger('Trilha');

// `tx` é o cliente da transação em andamento: `prisma.$transaction(async (tx) => ...)`.
export async function registrarNaTrilha(tx: Prisma.TransactionClient, registro: RegistroNaTrilha): Promise<void> {
  const detalhe = mascararDadosPessoais(registro.detalhe);
  if (detalhe !== registro.detalhe) {
    // Só a entidade e o id no log, nunca o texto original (é ele que tem o dado pessoal).
    logger.warn(`Dado pessoal mascarado no detalhe da trilha (${registro.entidade} ${registro.registroId}).`);
  }
  await tx.registroAuditoria.create({ data: { ...registro, detalhe } });
}

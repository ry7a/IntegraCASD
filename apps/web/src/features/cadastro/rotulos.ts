import type { CursoAluno, PeriodicidadeContrato, PostoAluno, SituacaoProjeto } from '@integracasd/api-client'

// Os valores da API vêm em MAIÚSCULAS sem acento; o texto da tela fica aqui.
export const ROTULO_DO_CURSO: Record<CursoAluno, string> = {
  AER: 'Engenharia Aeronáutica',
  ELE: 'Engenharia Eletrônica',
  MEC: 'Engenharia Mecânica-Aeronáutica',
  CIV: 'Engenharia Civil-Aeronáutica',
  COMP: 'Engenharia de Computação',
  AESP: 'Engenharia Aeroespacial',
}

export const ROTULO_DO_POSTO: Record<PostoAluno, string> = {
  CIVIL: 'Civil',
  ALUNO_MILITAR: 'Aluno militar',
  ASP_OF: 'Aspirante a oficial',
}

export const ROTULO_DA_PERIODICIDADE: Record<PeriodicidadeContrato, string> = {
  MENSAL: 'Mensal',
  ANUAL: 'Anual',
  POR_DEMANDA: 'Por demanda',
  UNICA: 'Única',
}

export const ROTULO_DA_SITUACAO_DO_PROJETO: Record<SituacaoProjeto, string> = {
  A_LIBERAR: 'A liberar',
  LIBERADO: 'Liberado',
  EM_EXECUCAO: 'Em execução',
  EXECUTADO: 'Executado',
  CANCELADO: 'Cancelado',
}

import type { CursoAluno, PostoAluno } from '@integracasd/api-client'

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

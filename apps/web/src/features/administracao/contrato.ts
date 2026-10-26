// Contrato planejado da API de Administração [Administração.RF001 a RF005].
// Dinheiro em centavos; dias em "AAAA-MM-DD"; instantes em ISO 8601.

export type PerfilUsuario = 'DIRETORIA' | 'ADMINISTRATIVO'

export interface UsuarioDto {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  observacao: string | null
  ultimoAcessoEm: string | null
}

// GET /api/administracao/usuarios
export interface ListaDeUsuariosDto {
  // Ativos primeiro, depois os inativos.
  itens: UsuarioDto[]
}

export type OperacaoAuditoria =
  | 'INCLUSAO'
  | 'ALTERACAO'
  | 'INATIVACAO'
  | 'ESTORNO'
  | 'CANCELAMENTO'
  | 'REGISTRO_MANUAL_DE_PAGAMENTO'
  | 'GERACAO_RECORRENTE'

export type EntidadeAuditoria = 'ALUNO' | 'COBRANCA' | 'MOVIMENTACAO' | 'CONFIGURACAO'

export interface RegistroAuditoriaDto {
  id: string
  ocorridoEm: string
  // Nulo = rotina automática.
  usuarioNome: string | null
  operacao: OperacaoAuditoria
  entidade: EntidadeAuditoria
  // Nunca contém segredos, como a chave do Asaas.
  detalhe: string
}

// GET /api/administracao/trilha-auditoria?de=&ate=&usuario=&operacao=&entidade=
// TODO [Administração.RF005]: a API de verdade também recebe pagina e tamanhoPagina.
export interface ListaDaTrilhaDto {
  // Do mais recente para o mais antigo.
  itens: RegistroAuditoriaDto[]
  total: number
}

// Os filtros da trilha, iguais aos parâmetros da rota acima. "ROTINA_AUTOMATICA" em `usuario` = sem usuário.
export interface FiltrosDaTrilha {
  de?: string
  ate?: string
  usuario?: string
  operacao?: OperacaoAuditoria
  entidade?: EntidadeAuditoria
}

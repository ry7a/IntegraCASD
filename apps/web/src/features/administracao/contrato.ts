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

export interface ConferenciaDto {
  proximaGeracao: string
  proximoVencimento: string
  // Alunos ativos, que receberão a mensalidade.
  alunosCobrados: number
  // Alunos cobrados x valor da mensalidade.
  totalPrevistoCentavos: number
}

export interface ExecucaoGeracaoDto {
  id: string
  iniciadaEm: string
  finalizadaEm: string | null
  // Cobranças criadas.
  totalProcessado: number
  totalFalhas: number
  motivoFalhas: string | null
}

// GET /api/administracao/parametros-cobranca
export interface ParametrosCobrancaDto {
  valorMensalidadeCentavos: number
  diaVencimento: number
  diaGeracao: number
  // Percentual inteiro (2 = 2%). Quem calcula é o Asaas.
  multaPercentual: number
  // Percentual inteiro ao mês (1 = 1%).
  jurosMensalPercentual: number
  alteradoEm: string
  alteradoPor: string
  conferencia: ConferenciaDto
  // As três últimas, da mais recente.
  ultimasExecucoes: ExecucaoGeracaoDto[]
}

// GET /api/administracao/integracao-asaas
// A chave de acesso NUNCA aparece aqui: a API só informa quando ela foi cadastrada.
export interface IntegracaoAsaasDto {
  ambiente: 'SANDBOX' | 'PRODUCAO'
  conectada: boolean
  ultimoTesteEm: string | null
  ultimaNotificacaoEm: string | null
  // Falhas de entrega seguidas.
  falhasSeguidas: number
  // Quantas falhas seguidas o Asaas tolera antes de pausar a fila.
  limiteFalhas: number
  chaveCadastradaEm: string | null
  // Endereço a cadastrar no painel do Asaas, em Integrações > Webhooks.
  enderecoNotificacao: string
  // Alerta a diretoria se ficar este tempo sem notificações.
  horasAlertaSemNotificacao: number
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

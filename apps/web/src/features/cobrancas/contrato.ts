// Contrato planejado da API de Cobranças [Cobranças.RF002 a RF008].
// Dinheiro em centavos; dias em "AAAA-MM-DD"; instantes em ISO 8601.
import type { SituacaoCobranca } from '@/compartilhado/dominio'

export type OrigemCobranca = 'MENSALIDADE' | 'AVULSA'

export interface CobrancaListaItemDto {
  id: string
  alunoId: string
  alunoNome: string
  descricao: string
  origem: OrigemCobranca
  // Valor original, sem multa e juros.
  valorCentavos: number
  vencimento: string
  situacao: SituacaoCobranca
  // Só para cobrança vencida.
  diasDeAtraso: number | null
  // Preenchido só quando a cobrança vencida está há mais de 7 dias sem sincronizar com o Asaas.
  semSincronizarHaDias: number | null
}

// GET /api/cobrancas?situacoes=&busca=&vencimentoDe=&vencimentoAte=&valorMinimoCentavos=&valorMaximoCentavos=
// TODO [Cobranças.RF002]: a API de verdade também recebe pagina e tamanhoPagina e devolve o total geral.
export interface ListaDeCobrancasDto {
  itens: CobrancaListaItemDto[]
  total: number
}

// Os filtros da lista, iguais aos parâmetros da rota acima.
export interface FiltrosDeCobrancas {
  situacoes: SituacaoCobranca[]
  busca?: string
  vencimentoDe?: string
  vencimentoAte?: string
  valorMinimoCentavos?: number
  valorMaximoCentavos?: number
}

export interface ResumoSituacaoDto {
  situacao: SituacaoCobranca
  quantidade: number
  // Soma dos valores originais.
  valorCentavos: number
}

export interface SincronizacaoDto {
  iniciadaEm: string
  // Cobranças conferidas no Asaas.
  conferidas: number
  // Cobranças cuja situação foi atualizada (pagas no Asaas).
  atualizadas: number
  // Encontradas só no Asaas e registradas aqui.
  somenteNoAsaas: number
  // Pagas com registro manual, para conferir.
  paraConferir: number
}

export interface ConciliacaoDto {
  // A integração com o Asaas está conectada.
  ativa: boolean
  ultimaNotificacaoEm: string | null
  ultimaSincronizacao: SincronizacaoDto | null
}

// GET /api/cobrancas/resumo
export interface ResumoCobrancasDto {
  // Abertas e vencidas: todas. Demais situações: só as que mudaram de situação no mês corrente.
  situacoes: ResumoSituacaoDto[]
  conciliacao: ConciliacaoDto
}

export interface EventoCobrancaDto {
  id: string
  ocorridoEm: string
  descricao: string
  origem: 'ASAAS' | 'USUARIO'
}

// GET /api/cobrancas/:id
export interface CobrancaDetalheDto {
  id: string
  alunoId: string
  alunoNome: string
  descricao: string
  origem: OrigemCobranca
  valorCentavos: number
  vencimento: string
  situacao: SituacaoCobranca
  diasDeAtraso: number | null
  asaasId: string | null
  ultimaSincronizacaoEm: string | null
  diasDesdeUltimaSincronizacao: number | null
  // Cobrança vencida há mais de 7 dias sem sincronizar.
  sincronizacaoAntiga: boolean
  pagaEm: string | null
  justificativaManual: string | null
  // Só cobrança aberta ou vencida pode ser cancelada.
  podeCancelar: boolean
  // Só cobrança aberta ou vencida aceita pagamento manual.
  podeRegistrarPagamentoManual: boolean
  // Do mais recente para o mais antigo.
  eventos: EventoCobrancaDto[]
}

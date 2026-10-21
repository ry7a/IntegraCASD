// Tipos e textos do domínio usados por mais de uma feature (uma feature nunca importa outra).
// São o contrato planejado da API: quando os endpoints existirem, estes tipos passam a vir do
// `@integracasd/api-client`, gerado pelo orval, e este arquivo encolhe.

export type SituacaoCobranca = 'ABERTA' | 'VENCIDA' | 'PAGA' | 'PAGA_COM_REGISTRO_MANUAL' | 'CANCELADA' | 'ESTORNADA'

export type FormaPagamento = 'ASAAS' | 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO'

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA'

export type OrigemMovimentacao = 'MANUAL' | 'CONCILIACAO_AUTOMATICA' | 'REGISTRO_MANUAL_DE_COBRANCA' | 'ESTORNO'

export interface VinculoDto {
  tipo: 'COBRANCA' | 'CONTRATO' | 'PROJETO' | 'FUNCIONARIO'
  // Nome do contrato, projeto ou funcionário.
  nome: string | null
}

// Aparece na tela de Movimentações e na aba "Movimentações" do aluno.
export interface MovimentacaoDto {
  id: string
  data: string
  descricao: string
  tipo: TipoMovimentacao
  // Sempre positivo, em centavos. O sinal vem do tipo.
  valorCentavos: number
  // Nulo = não classificada.
  categoriaNome: string | null
  forma: FormaPagamento
  origem: OrigemMovimentacao
  registradaPor: string | null
  vinculo: VinculoDto | null
  estornadaEm: string | null
  motivoEstorno: string | null
  // Só lançamento manual, ainda não estornado, pode ser estornado.
  podeEstornar: boolean
  motivoSemEstorno: string | null
}

// Os valores da API vêm em MAIÚSCULAS sem acento; o texto da tela fica aqui.
export const ROTULO_DA_FORMA: Record<FormaPagamento, string> = {
  ASAAS: 'Asaas',
  PIX: 'Pix',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
}

// Contrato planejado da API de Indicadores [Indicadores.RF001 a RF003].
// Dinheiro em centavos; meses no formato "AAAA-MM".

// GET /api/indicadores/resumo?mes=AAAA-MM
export interface ResumoIndicadoresDto {
  mes: string
  entradasCentavos: number
  saidasCentavos: number
  // Entradas menos saídas do mês.
  resultadoCentavos: number
  // Variação % sobre o mês anterior; nulo se não havia movimento.
  variacaoEntradasPercentual: number | null
  variacaoSaidasPercentual: number | null
  // Já pago pelos alunos, ainda não disponível na conta.
  aguardandoLiberacaoCentavos: number
  // Cobranças vencidas há mais de 7 dias sem sincronizar com o Asaas.
  vencidasSemSincronizar: number
}

export interface PontoDeEvolucaoDto {
  mes: string
  entradasCentavos: number
  saidasCentavos: number
  resultadoCentavos: number
}

// GET /api/indicadores/evolucao?ate=AAAA-MM&quantidade=6
export interface EvolucaoDto {
  // Do mês mais antigo para o mais recente.
  meses: PontoDeEvolucaoDto[]
}

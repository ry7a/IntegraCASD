import type { CobrancasDoAlunoDto } from '@integracasd/api-client'

// O que o diálogo de inativação mostra quando o aluno deve. Os números vêm prontos da API (que decide o que é
// "em aberto"); aqui só se decide se há débito para mostrar.
export type DebitoDoAluno = {
  // Abertas e vencidas somadas.
  totalEmAbertoCentavos: number
  quantidadeVencidas: number
  totalVencidoCentavos: number
}

// [Cadastros.RF001] fluxo E2: há débito quando o aluno tem cobrança "Aberta ou Vencida", e não só vencida.
// Basta olhar o total em aberto: toda cobrança tem valor positivo (CHECK no banco), então total maior que zero
// quer dizer pelo menos uma cobrança aberta ou vencida. Devolve null sem débito ou enquanto a consulta não chegou.
export function debitoDoAluno(cobrancas: CobrancasDoAlunoDto | undefined): DebitoDoAluno | null {
  if (!cobrancas || cobrancas.totalEmAbertoCentavos <= 0) return null
  return {
    totalEmAbertoCentavos: cobrancas.totalEmAbertoCentavos,
    quantidadeVencidas: cobrancas.quantidadeVencidas,
    totalVencidoCentavos: cobrancas.totalVencidoCentavos,
  }
}

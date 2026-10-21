// Dados FICTÍCIOS de Cobranças, iguais aos do mockup (docs/telas/cobrancas.html e cobranca.html).
// A "data de hoje" do mockup é 19/10/2026. Nada aqui é real (LGPD).
// Os ids dos alunos e as cobranças do Lucas batem com features/cadastro/dados-ficticios.ts.
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type { SituacaoCobranca } from '@/compartilhado/dominio'
import type {
  CobrancaDetalheDto,
  CobrancaListaItemDto,
  EventoCobrancaDto,
  OrigemCobranca,
  ResumoCobrancasDto,
} from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:cobrancas')

const HOJE = '2026-10-19'
const MENSALIDADE = 8500

// Dias corridos entre duas datas "AAAA-MM-DD".
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86400000)
}

interface Linha {
  id: string
  alunoId: string
  alunoNome: string
  descricao: string
  valorCentavos: number
  vencimento: string
  situacao: SituacaoCobranca
  origem?: OrigemCobranca
  pagaEm?: string // instante ISO
  sincronizadaEm?: string // instante ISO (só cobranças vencidas)
  justificativa?: string
}

const linhas: Linha[] = [
  // Lucas Andrade Ferreira: 3 vencidas (R$ 255,00) e 3 pagas.
  { id: 'cob-lucas-0526', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 05/2026', valorCentavos: MENSALIDADE, vencimento: '2026-05-10', situacao: 'PAGA', pagaEm: '2026-05-11T09:00:00-03:00' },
  { id: 'cob-lucas-0626', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 06/2026', valorCentavos: MENSALIDADE, vencimento: '2026-06-10', situacao: 'PAGA', pagaEm: '2026-06-09T09:00:00-03:00' },
  { id: 'cob-lucas-0726', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 07/2026', valorCentavos: MENSALIDADE, vencimento: '2026-07-10', situacao: 'PAGA', pagaEm: '2026-07-08T09:00:00-03:00' },
  { id: 'cob-lucas-0826', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 08/2026', valorCentavos: MENSALIDADE, vencimento: '2026-08-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-10T09:00:00-03:00' },
  { id: 'cob-lucas-0926', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 09/2026', valorCentavos: MENSALIDADE, vencimento: '2026-09-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-17T09:00:00-03:00' },
  { id: 'cob-lucas-1026', alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', descricao: 'Mensalidade 10/2026', valorCentavos: MENSALIDADE, vencimento: '2026-10-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-17T09:00:00-03:00' },
  // Beatriz Moura Lima: 2 vencidas (R$ 170,00) e o Baile pago.
  { id: 'cob-beatriz-0926', alunoId: 'aluno-beatriz', alunoNome: 'Beatriz Moura Lima', descricao: 'Mensalidade 09/2026', valorCentavos: MENSALIDADE, vencimento: '2026-09-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-10T09:00:00-03:00' },
  { id: 'cob-beatriz-1026', alunoId: 'aluno-beatriz', alunoNome: 'Beatriz Moura Lima', descricao: 'Mensalidade 10/2026', valorCentavos: MENSALIDADE, vencimento: '2026-10-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-17T09:00:00-03:00' },
  { id: 'cob-beatriz-baile', alunoId: 'aluno-beatriz', alunoNome: 'Beatriz Moura Lima', descricao: 'Inscrição no Baile do ITA', valorCentavos: 15000, vencimento: '2026-10-05', situacao: 'PAGA', origem: 'AVULSA', pagaEm: '2026-10-05T15:00:00-03:00' },
  // Rafael Tavares Costa: 2 vencidas (R$ 170,00) e a mensalidade de outubro paga com registro manual.
  { id: 'cob-rafael-0926', alunoId: 'aluno-rafael', alunoNome: 'Rafael Tavares Costa', descricao: 'Mensalidade 09/2026', valorCentavos: MENSALIDADE, vencimento: '2026-09-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-10T09:00:00-03:00' },
  { id: 'cob-rafael-camiseta', alunoId: 'aluno-rafael', alunoNome: 'Rafael Tavares Costa', descricao: 'Camiseta do CASD', valorCentavos: MENSALIDADE, vencimento: '2026-09-10', situacao: 'VENCIDA', origem: 'AVULSA', sincronizadaEm: '2026-10-17T09:00:00-03:00' },
  { id: 'cob-rafael-1026', alunoId: 'aluno-rafael', alunoNome: 'Rafael Tavares Costa', descricao: 'Mensalidade 10/2026', valorCentavos: MENSALIDADE, vencimento: '2026-10-10', situacao: 'PAGA_COM_REGISTRO_MANUAL', pagaEm: '2026-10-15T11:30:00-03:00', justificativa: 'Pix na conta do CASD' },
  // Júlia, Pedro, Carlos, Ana e Mariana.
  { id: 'cob-julia-baile', alunoId: 'aluno-julia', alunoNome: 'Júlia Nogueira Prado', descricao: 'Inscrição no Baile do ITA', valorCentavos: 15000, vencimento: '2026-09-27', situacao: 'VENCIDA', origem: 'AVULSA', sincronizadaEm: '2026-10-10T09:00:00-03:00' },
  { id: 'cob-pedro-1026', alunoId: 'aluno-pedro', alunoNome: 'Pedro Henrique Saldanha', descricao: 'Mensalidade 10/2026', valorCentavos: MENSALIDADE, vencimento: '2026-10-10', situacao: 'VENCIDA', sincronizadaEm: '2026-10-17T09:00:00-03:00' },
  { id: 'cob-carlos-1126', alunoId: 'aluno-carlos', alunoNome: 'Carlos Eduardo Vasconcelos', descricao: 'Mensalidade 11/2026', valorCentavos: MENSALIDADE, vencimento: '2026-11-10', situacao: 'ABERTA' },
  { id: 'cob-carlos-baile', alunoId: 'aluno-carlos', alunoNome: 'Carlos Eduardo Vasconcelos', descricao: 'Inscrição no Baile do ITA', valorCentavos: 15000, vencimento: '2026-10-05', situacao: 'PAGA', origem: 'AVULSA', pagaEm: '2026-10-05T16:00:00-03:00' },
  { id: 'cob-ana-1026', alunoId: 'aluno-ana', alunoNome: 'Ana Clara Ribeiro', descricao: 'Mensalidade 10/2026', valorCentavos: MENSALIDADE, vencimento: '2026-10-10', situacao: 'PAGA', pagaEm: '2026-10-08T10:00:00-03:00' },
  { id: 'cob-ana-baile', alunoId: 'aluno-ana', alunoNome: 'Ana Clara Ribeiro', descricao: 'Inscrição no Baile do ITA', valorCentavos: 15000, vencimento: '2026-10-05', situacao: 'PAGA', origem: 'AVULSA', pagaEm: '2026-10-05T14:00:00-03:00' },
  { id: 'cob-ana-camiseta', alunoId: 'aluno-ana', alunoNome: 'Ana Clara Ribeiro', descricao: 'Camiseta do CASD', valorCentavos: 7000, vencimento: '2026-10-06', situacao: 'ESTORNADA', origem: 'AVULSA', pagaEm: '2026-10-06T10:00:00-03:00' },
  { id: 'cob-mariana-0926', alunoId: 'aluno-mariana', alunoNome: 'Mariana Costa Albuquerque', descricao: 'Mensalidade 09/2026', valorCentavos: MENSALIDADE, vencimento: '2026-09-10', situacao: 'CANCELADA' },
]

// Histórico de eventos do Asaas, do mais recente para o mais antigo.
function eventosDe(linha: Linha, numero: number): EventoCobrancaDto[] {
  const inicioDoMes = `${linha.vencimento.slice(0, 8)}01`
  const criadaEm = `${inicioDoMes > HOJE ? '2026-10-01' : inicioDoMes}T06:03:00-03:00`
  const diaSeguinte = new Date(Date.parse(linha.vencimento) + 86400000).toISOString().slice(0, 10)
  const eventos: Omit<EventoCobrancaDto, 'id'>[] = [
    { ocorridoEm: criadaEm, descricao: 'Cobrança criada no Asaas.', origem: 'ASAAS' },
    { ocorridoEm: criadaEm, descricao: 'Boleto enviado por e-mail ao aluno.', origem: 'ASAAS' },
  ]
  if (linha.situacao === 'VENCIDA') {
    eventos.push({
      ocorridoEm: `${diaSeguinte}T00:10:00-03:00`,
      descricao: 'Vencimento sem pagamento: a situação da cobrança passou a Vencida.',
      origem: 'ASAAS',
    })
  }
  if (linha.situacao === 'PAGA' && linha.pagaEm) {
    eventos.push({ ocorridoEm: linha.pagaEm, descricao: 'Pagamento confirmado pelo Asaas. Cobrança conciliada.', origem: 'ASAAS' })
  }
  if (linha.situacao === 'PAGA_COM_REGISTRO_MANUAL' && linha.pagaEm) {
    eventos.push({
      ocorridoEm: linha.pagaEm,
      descricao: 'Pagamento registrado manualmente por Sônia Aparecida Martins.',
      origem: 'USUARIO',
    })
  }
  if (linha.id === 'cob-lucas-0826') {
    eventos.push({
      ocorridoEm: '2026-09-15T10:40:00-03:00',
      descricao: 'Boleto reenviado por e-mail ao aluno, por Sônia Aparecida Martins.',
      origem: 'USUARIO',
    })
  }
  return eventos
    .sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm))
    .map((evento, i) => ({ id: `evt-${numero}-${i}`, ...evento }))
}

export const cobrancasDetalhadas: CobrancaDetalheDto[] = linhas.map((linha, indice) => {
  const emAberto = linha.situacao === 'ABERTA' || linha.situacao === 'VENCIDA'
  const diasDesdeUltimaSincronizacao = linha.sincronizadaEm ? diasEntre(linha.sincronizadaEm.slice(0, 10), HOJE) : null
  return {
    id: linha.id,
    alunoId: linha.alunoId,
    alunoNome: linha.alunoNome,
    descricao: linha.descricao,
    origem: linha.origem ?? 'MENSALIDADE',
    valorCentavos: linha.valorCentavos,
    vencimento: linha.vencimento,
    situacao: linha.situacao,
    diasDeAtraso: linha.situacao === 'VENCIDA' ? diasEntre(linha.vencimento, HOJE) : null,
    asaasId: `pay_ficticio_${String(801 + indice).padStart(6, '0')}`,
    ultimaSincronizacaoEm: linha.sincronizadaEm ?? null,
    diasDesdeUltimaSincronizacao,
    sincronizacaoAntiga: diasDesdeUltimaSincronizacao !== null && diasDesdeUltimaSincronizacao > 7,
    pagaEm: linha.pagaEm ?? null,
    justificativaManual: linha.justificativa ?? null,
    podeCancelar: emAberto,
    podeRegistrarPagamentoManual: emAberto,
    eventos: eventosDe(linha, indice),
  }
})

// A lista mostra menos campos que o detalhe.
export const cobrancasDaLista: CobrancaListaItemDto[] = cobrancasDetalhadas.map((c) => ({
  id: c.id,
  alunoId: c.alunoId,
  alunoNome: c.alunoNome,
  descricao: c.descricao,
  origem: c.origem,
  valorCentavos: c.valorCentavos,
  vencimento: c.vencimento,
  situacao: c.situacao,
  diasDeAtraso: c.diasDeAtraso,
  semSincronizarHaDias: c.sincronizacaoAntiga ? c.diasDesdeUltimaSincronizacao : null,
}))

// Números do mockup (a base inteira tem centenas de cobranças; a lista acima é só uma amostra).
export const resumo: ResumoCobrancasDto = {
  situacoes: [
    { situacao: 'ABERTA', quantidade: 412, valorCentavos: 3502000 },
    { situacao: 'VENCIDA', quantidade: 54, valorCentavos: 481000 },
    { situacao: 'PAGA', quantidade: 318, valorCentavos: 2703000 },
    { situacao: 'PAGA_COM_REGISTRO_MANUAL', quantidade: 2, valorCentavos: 17000 },
    { situacao: 'CANCELADA', quantidade: 6, valorCentavos: 51000 },
    { situacao: 'ESTORNADA', quantidade: 1, valorCentavos: 7000 },
  ],
  conciliacao: {
    ativa: true,
    ultimaNotificacaoEm: '2026-10-19T08:48:00-03:00',
    ultimaSincronizacao: {
      iniciadaEm: '2026-10-19T06:00:00-03:00',
      conferidas: 466,
      atualizadas: 3,
      somenteNoAsaas: 0,
      paraConferir: 1,
    },
  },
}

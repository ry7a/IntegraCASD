// Formatações de exibição usadas em várias telas.

// '12345678901' -> '123.456.789-01'. Se não tiver 11 dígitos, mostra como veio.
export function formatarCpf(cpf: string): string {
  if (!/^\d{11}$/.test(cpf)) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

// A API manda dinheiro em centavos (inteiro), dias como "AAAA-MM-DD" e instantes em ISO 8601.

const formatadorDeMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// 8500 -> "R$ 85,00"
export function formatarMoeda(centavos: number): string {
  return formatadorDeMoeda.format(centavos / 100)
}

// Com sinal, como nas movimentações: "+ R$ 85,00" ou "− R$ 1.200,00".
export function formatarMoedaComSinal(tipo: 'ENTRADA' | 'SAIDA', centavos: number): string {
  return `${tipo === 'ENTRADA' ? '+' : '−'} ${formatarMoeda(centavos)}`
}

const formatadorDeCampoDeValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 245000 -> "2.450,00": valor já salvo, para preencher um campo de texto de formulário.
// O paraCentavos (abaixo) lê de volta esse mesmo formato.
export function formatarValorParaCampo(centavos: number): string {
  return formatadorDeCampoDeValor.format(centavos / 100)
}

// Texto digitado pelo usuário ("R$ 1.200,00", "85", "85,5") -> centavos. NaN se não der para entender.
// É só conveniência do formulário: quem valida o valor de verdade é a API.
export function paraCentavos(texto: string): number {
  // Com sinal de menos ("-" ou o "−" das telas) é inválido: o replace abaixo apagaria o sinal (#67).
  if (/[-−]/.test(texto)) return NaN
  const limpo = texto.replace(/[^\d,]/g, '').replace(',', '.')
  if (limpo === '') return NaN
  return Math.round(Number(limpo) * 100)
}

// "2026-10-19" -> "19/10/2026". Não passa por Date, para o fuso horário não mudar o dia.
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

const formatadorDeDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

// "2026-10-19T11:02:00.000Z" -> "19/10/2026 08:02" (horário de Brasília)
export function formatarDataHora(instanteIso: string): string {
  return formatadorDeDataHora.format(new Date(instanteIso)).replace(',', '')
}

const formatadorDeHora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export function formatarHora(instanteIso: string): string {
  return formatadorDeHora.format(new Date(instanteIso))
}

const formatadorDeInteiro = new Intl.NumberFormat('pt-BR')

// 1234 -> "1.234" (contagens, como quantidade de alunos)
export function formatarInteiro(valor: number): string {
  return formatadorDeInteiro.format(valor)
}

// 4 -> "4,0%"; 6.4 -> "6,4%"
export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`
}

// Meses no formato "AAAA-MM", o mesmo dos filtros da API.
const NOMES_DOS_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// "2026-10" -> "outubro"
export function nomeDoMes(mes: string): string {
  return NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1]
}

// "2026-10" -> "Outubro de 2026"
export function formatarMes(mes: string): string {
  const nome = nomeDoMes(mes)
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${mes.slice(0, 4)}`
}

// somarMeses("2026-10", -1) -> "2026-09"
export function somarMeses(mes: string, quantidade: number): string {
  const [ano, numeroDoMes] = mes.split('-').map(Number)
  return new Date(Date.UTC(ano, numeroDoMes - 1 + quantidade, 1)).toISOString().slice(0, 7)
}

// "2026-05" -> "mai"
export function abreviarMes(mes: string): string {
  return nomeDoMes(mes).slice(0, 3)
}

// "2026-10-19T..." -> "há 12 minutos", "há 3 horas", "há 2 dias"
export function haQuantoTempo(instanteIso: string, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - new Date(instanteIso).getTime()) / 60000))
  if (minutos < 1) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

// "2026-10-19" no formato do <input type="date">. O dia é o de São Paulo, o mesmo que a API usa: com
// toISOString (UTC) o dia viraria às 21h de Brasília e o formulário sugeriria uma data "futura".
// O locale en-CA escreve exatamente AAAA-MM-DD.
const formatadorDoDiaDeHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
export function hojeIso(): string {
  return formatadorDoDiaDeHoje.format(new Date())
}

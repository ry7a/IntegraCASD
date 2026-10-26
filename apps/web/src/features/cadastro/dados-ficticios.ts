// Dados FICTÍCIOS de Cadastros, iguais aos do mockup (docs/telas/cadastros.html e aluno.html).
// Nomes, CPFs e e-mails são inventados (LGPD). Os ids dos alunos e as cobranças do Lucas batem com
// features/cobrancas/dados-ficticios.ts. O cadastro dos alunos NÃO usa isto: vem da API real.
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type { MovimentacaoDto } from '@/compartilhado/dominio'
import type {
} from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:cadastro')

// Só o Lucas tem movimentações no mockup; os outros alunos mostram o estado "vazio".
function entradaDeMensalidade(id: string, data: string, mes: string): MovimentacaoDto {
  return {
    id,
    data,
    descricao: `Mensalidade ${mes}/2026 · Lucas Andrade Ferreira`,
    tipo: 'ENTRADA',
    valorCentavos: 8500,
    categoriaNome: 'Mensalidades',
    forma: 'ASAAS',
    origem: 'CONCILIACAO_AUTOMATICA',
    registradaPor: null,
    vinculo: { tipo: 'COBRANCA', nome: null },
    estornadaEm: null,
    motivoEstorno: null,
    podeEstornar: false,
    motivoSemEstorno: 'Entradas da conciliação espelham o Asaas. Para corrigir, trate a cobrança em Cobranças.',
  }
}

export const movimentacoesDoLucas: MovimentacaoDto[] = [
  entradaDeMensalidade('mov-lucas-0726', '2026-07-08', '07'),
  entradaDeMensalidade('mov-lucas-0626', '2026-06-09', '06'),
  entradaDeMensalidade('mov-lucas-0526', '2026-05-11', '05'),
]

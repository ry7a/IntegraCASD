// Dados FICTÍCIOS de Cadastros, iguais aos do mockup (docs/telas/cadastros.html e aluno.html).
// Nomes, CPFs e e-mails são inventados (LGPD). Os ids dos alunos e as cobranças do Lucas batem com
// features/cobrancas/dados-ficticios.ts. O cadastro dos alunos NÃO usa isto: vem da API real.
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type { MovimentacaoDto } from '@/compartilhado/dominio'
import type {
  CobrancasDoAlunoDto,
  ContratoDto,
  ProjetoDto,
} from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:cadastro')

// Só o Lucas tem cobranças e movimentações no mockup; os outros alunos mostram o estado "vazio".
export const cobrancasDoLucas: CobrancasDoAlunoDto = {
  itens: [
    { id: 'cob-lucas-0826', descricao: 'Mensalidade 08/2026', valorCentavos: 8500, vencimento: '2026-08-10', situacao: 'VENCIDA', diasDeAtraso: 70, pagaEm: null },
    { id: 'cob-lucas-0926', descricao: 'Mensalidade 09/2026', valorCentavos: 8500, vencimento: '2026-09-10', situacao: 'VENCIDA', diasDeAtraso: 39, pagaEm: null },
    { id: 'cob-lucas-1026', descricao: 'Mensalidade 10/2026', valorCentavos: 8500, vencimento: '2026-10-10', situacao: 'VENCIDA', diasDeAtraso: 9, pagaEm: null },
    { id: 'cob-lucas-0726', descricao: 'Mensalidade 07/2026', valorCentavos: 8500, vencimento: '2026-07-10', situacao: 'PAGA', diasDeAtraso: null, pagaEm: '2026-07-08T09:00:00-03:00' },
    { id: 'cob-lucas-0626', descricao: 'Mensalidade 06/2026', valorCentavos: 8500, vencimento: '2026-06-10', situacao: 'PAGA', diasDeAtraso: null, pagaEm: '2026-06-09T09:00:00-03:00' },
    { id: 'cob-lucas-0526', descricao: 'Mensalidade 05/2026', valorCentavos: 8500, vencimento: '2026-05-10', situacao: 'PAGA', diasDeAtraso: null, pagaEm: '2026-05-11T09:00:00-03:00' },
  ],
  totalEmAbertoCentavos: 25500,
  quantidadeVencidas: 3,
}

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

export const contratos: ContratoDto[] = [
  { id: 'contrato-lavanderia', contraparte: 'Lavanderia Bem Lavado', objeto: 'Manutenção das máquinas', valorCentavos: 120000, periodicidade: 'MENSAL', dataInicio: '2026-01-01', dataFim: '2026-12-31', situacao: 'VIGENTE', diasParaVencer: 73, pagoNoAnoCentavos: 1080000 },
  { id: 'contrato-grafica', contraparte: 'Gráfica Pontual', objeto: 'Impressões e banners', valorCentavos: 45000, periodicidade: 'POR_DEMANDA', dataInicio: '2026-03-15', dataFim: '2026-12-15', situacao: 'VENCE_EM_BREVE', diasParaVencer: 57, pagoNoAnoCentavos: 270000 },
  { id: 'contrato-som-e-luz', contraparte: 'Som & Luz Eventos', objeto: 'Sonorização da Semana de Integração', valorCentavos: 600000, periodicidade: 'UNICA', dataInicio: '2026-03-01', dataFim: '2026-03-31', situacao: 'ENCERRADO', diasParaVencer: -202, pagoNoAnoCentavos: 600000 },
]

export const projetos: ProjetoDto[] = [
  { id: 'projeto-semana', nome: 'Semana de Integração 2026', responsavel: 'Gabriela Sato', dataInicio: '2026-02-01', dataFim: '2026-03-31', orcamentoCentavos: 2000000, situacao: 'ENCERRADO', movimentadoCentavos: 1840000 },
  { id: 'projeto-reforma', nome: 'Reforma da sala de estudos', responsavel: 'Thiago Rezende', dataInicio: '2026-08-01', dataFim: '2026-11-30', orcamentoCentavos: 1200000, situacao: 'EM_ANDAMENTO', movimentadoCentavos: 715000 },
  { id: 'projeto-olimpiada', nome: 'Olimpíada interna do ITA', responsavel: 'Larissa Okada', dataInicio: '2026-10-01', dataFim: '2026-11-15', orcamentoCentavos: null, situacao: 'EM_ANDAMENTO', movimentadoCentavos: 192000 },
]

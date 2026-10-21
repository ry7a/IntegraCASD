// Dados FICTÍCIOS de Movimentações, iguais aos do mockup (docs/telas/movimentacoes.html).
// Nada aqui é real (LGPD).
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type { MovimentacaoDto } from '@/compartilhado/dominio'
import type { OpcoesDaMovimentacaoDto, TotaisDto } from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:movimentacoes')

const SEM_ESTORNO = { podeEstornar: false, motivoSemEstorno: null, estornadaEm: null, motivoEstorno: null }

export const movimentacoes: MovimentacaoDto[] = [
  {
    id: 'mov-1018-manutencao-maquinas',
    data: '2026-10-18',
    descricao: 'Manutenção das máquinas, outubro/2026',
    tipo: 'SAIDA',
    valorCentavos: 120000,
    categoriaNome: 'Lavanderia',
    forma: 'PIX',
    origem: 'MANUAL',
    registradaPor: 'Sônia Martins',
    vinculo: { tipo: 'CONTRATO', nome: 'Lavanderia Bem Lavado' },
    ...SEM_ESTORNO,
    podeEstornar: true,
  },
  {
    id: 'mov-1017-recebimentos-lavanderia',
    data: '2026-10-17',
    descricao: 'Recebimentos da lavanderia na semana',
    tipo: 'ENTRADA',
    valorCentavos: 134000,
    categoriaNome: 'Lavanderia',
    forma: 'DINHEIRO',
    origem: 'MANUAL',
    registradaPor: 'Sônia Martins',
    vinculo: null,
    ...SEM_ESTORNO,
    podeEstornar: true,
  },
  {
    id: 'mov-1016-tinta-reforma',
    data: '2026-10-16',
    descricao: 'Tinta e materiais para a reforma',
    tipo: 'SAIDA',
    valorCentavos: 238000,
    categoriaNome: 'Manutenção',
    forma: 'CARTAO',
    origem: 'MANUAL',
    registradaPor: 'Marina Teixeira',
    vinculo: { tipo: 'PROJETO', nome: 'Reforma da sala de estudos' },
    ...SEM_ESTORNO,
    podeEstornar: true,
  },
  {
    id: 'mov-1015-mensalidade-rafael',
    data: '2026-10-15',
    descricao: 'Mensalidade 10/2026 · Rafael Tavares Costa',
    tipo: 'ENTRADA',
    valorCentavos: 8500,
    categoriaNome: 'Mensalidades',
    forma: 'ASAAS',
    origem: 'REGISTRO_MANUAL_DE_COBRANCA',
    registradaPor: null,
    vinculo: { tipo: 'COBRANCA', nome: null },
    ...SEM_ESTORNO,
    motivoSemEstorno: 'Movimentações de cobrança são corrigidas pela própria cobrança, em Cobranças.',
  },
  {
    id: 'mov-1014-estorno-banners',
    data: '2026-10-14',
    descricao: 'Estorno: impressão de banners',
    tipo: 'ENTRADA',
    valorCentavos: 45000,
    categoriaNome: 'Material de escritório',
    forma: 'PIX',
    origem: 'ESTORNO',
    registradaPor: 'Marina Teixeira',
    vinculo: { tipo: 'CONTRATO', nome: 'Gráfica Pontual' },
    ...SEM_ESTORNO,
    motivoEstorno: 'lançada em duplicidade',
  },
  {
    id: 'mov-1012-banners',
    data: '2026-10-12',
    descricao: 'Impressão de banners',
    tipo: 'SAIDA',
    valorCentavos: 45000,
    categoriaNome: 'Material de escritório',
    forma: 'PIX',
    origem: 'MANUAL',
    registradaPor: 'Sônia Martins',
    vinculo: { tipo: 'CONTRATO', nome: 'Gráfica Pontual' },
    ...SEM_ESTORNO,
    estornadaEm: '2026-10-14',
  },
  {
    id: 'mov-1010-salario-sonia',
    data: '2026-10-10',
    descricao: 'Salário de outubro · Sônia Aparecida Martins',
    tipo: 'SAIDA',
    valorCentavos: 420000,
    categoriaNome: 'Pessoal',
    forma: 'TRANSFERENCIA',
    origem: 'MANUAL',
    registradaPor: 'Marina Teixeira',
    vinculo: { tipo: 'FUNCIONARIO', nome: 'Sônia Aparecida Martins' },
    ...SEM_ESTORNO,
    podeEstornar: true,
  },
  {
    id: 'mov-1008-mensalidade-ana',
    data: '2026-10-08',
    descricao: 'Mensalidade 10/2026 · Ana Clara Ribeiro',
    tipo: 'ENTRADA',
    valorCentavos: 8500,
    categoriaNome: 'Mensalidades',
    forma: 'ASAAS',
    origem: 'CONCILIACAO_AUTOMATICA',
    registradaPor: null,
    vinculo: { tipo: 'COBRANCA', nome: null },
    ...SEM_ESTORNO,
    motivoSemEstorno: 'Entradas da conciliação espelham o Asaas. Para corrigir, trate a cobrança em Cobranças.',
  },
]

// Totais do mockup: a base do mês inteiro tem centenas de movimentações; a lista acima é só uma amostra.
export const totais: TotaisDto = {
  entradasCentavos: 6438000,
  quantidadeEntradas: 812,
  saidasCentavos: 4121530,
  quantidadeSaidas: 212,
  saldoCentavos: 2316470,
}

export const opcoes: OpcoesDaMovimentacaoDto = {
  categorias: [
    { id: 'cat-mensalidades', nome: 'Mensalidades' },
    { id: 'cat-lavanderia', nome: 'Lavanderia' },
    { id: 'cat-eventos', nome: 'Eventos' },
    { id: 'cat-pessoal', nome: 'Pessoal' },
    { id: 'cat-manutencao', nome: 'Manutenção' },
    { id: 'cat-projetos', nome: 'Projetos acadêmicos' },
    { id: 'cat-escritorio', nome: 'Material de escritório' },
  ],
  contratos: [
    { id: 'contrato-lavanderia', nome: 'Lavanderia Bem Lavado (manutenção das máquinas)', valorCentavos: 120000, periodicidade: 'MENSAL', pagoNoAnoCentavos: 1080000 },
    { id: 'contrato-grafica', nome: 'Gráfica Pontual (impressões e banners)', valorCentavos: 45000, periodicidade: 'POR_DEMANDA', pagoNoAnoCentavos: 270000 },
  ],
  projetos: [
    { id: 'projeto-reforma', nome: 'Reforma da sala de estudos' },
    { id: 'projeto-olimpiada', nome: 'Olimpíada interna do ITA' },
  ],
  funcionarios: [
    { id: 'func-sonia', nome: 'Sônia Aparecida Martins' },
    { id: 'func-roberto', nome: 'Roberto Lins Moreira' },
  ],
}

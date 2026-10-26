// Dados FICTÍCIOS de Movimentações, iguais aos do mockup (docs/telas/movimentacoes.html).
// Nada aqui é real (LGPD).
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type { OpcoesDaMovimentacaoDto } from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:movimentacoes')

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

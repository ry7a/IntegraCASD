// Dados FICTÍCIOS de Indicadores, iguais aos do mockup (docs/telas/indicadores.html). A "data de hoje" do
// mockup é 19/10/2026. Nenhum nome, valor ou id aqui é real (LGPD).
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type {
  EvolucaoDto,
  GastosPorCategoriaDto,
  InadimplenciaDto,
  ResumoIndicadoresDto,
} from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:indicadores')

export const MES_DOS_DADOS = '2026-10'

export const resumo: ResumoIndicadoresDto = {
  mes: MES_DOS_DADOS,
  entradasCentavos: 6438000,
  saidasCentavos: 4121530,
  resultadoCentavos: 2316470,
  variacaoEntradasPercentual: 4.0,
  variacaoSaidasPercentual: 6.4,
  aguardandoLiberacaoCentavos: 425000,
  vencidasSemSincronizar: 4,
}

export const evolucao: EvolucaoDto = {
  meses: [
    { mes: '2026-05', entradasCentavos: 5824000, saidasCentavos: 4412000, resultadoCentavos: 1412000 },
    { mes: '2026-06', entradasCentavos: 6103000, saidasCentavos: 4790000, resultadoCentavos: 1313000 },
    { mes: '2026-07', entradasCentavos: 3951000, saidasCentavos: 3026000, resultadoCentavos: 925000 },
    { mes: '2026-08', entradasCentavos: 5280000, saidasCentavos: 4961000, resultadoCentavos: 319000 },
    { mes: '2026-09', entradasCentavos: 6192000, saidasCentavos: 3874000, resultadoCentavos: 2318000 },
    { mes: '2026-10', entradasCentavos: 6438000, saidasCentavos: 4121530, resultadoCentavos: 2316470 },
  ],
}

// Os ids dos alunos são os mesmos de features/cadastro/dados-ficticios.ts.
export const inadimplencia: InadimplenciaDto = {
  alunosInadimplentes: 37,
  valorEmAbertoCentavos: 481000,
  alunosPorFaixa: { ate30Dias: 24, de31a60Dias: 9, acimaDe60Dias: 4 },
  maioresDevedores: [
    { alunoId: 'aluno-lucas', alunoNome: 'Lucas Andrade Ferreira', quantidade: 3, valorCentavos: 25500, diasDeAtrasoMaisAntigo: 70 },
    { alunoId: 'aluno-beatriz', alunoNome: 'Beatriz Moura Lima', quantidade: 2, valorCentavos: 17000, diasDeAtrasoMaisAntigo: 39 },
    { alunoId: 'aluno-rafael', alunoNome: 'Rafael Tavares Costa', quantidade: 2, valorCentavos: 17000, diasDeAtrasoMaisAntigo: 39 },
    { alunoId: 'aluno-julia', alunoNome: 'Júlia Nogueira Prado', quantidade: 1, valorCentavos: 15000, diasDeAtrasoMaisAntigo: 22 },
    { alunoId: 'aluno-pedro', alunoNome: 'Pedro Henrique Saldanha', quantidade: 1, valorCentavos: 8500, diasDeAtrasoMaisAntigo: 9 },
  ],
}

export const gastosPorCategoria: GastosPorCategoriaDto = {
  mes: MES_DOS_DADOS,
  totalSaidasCentavos: 4121530,
  itens: [
    { categoriaId: 'cat-eventos', categoriaNome: 'Eventos', valorCentavos: 1320000, percentual: 32.0 },
    { categoriaId: 'cat-pessoal', categoriaNome: 'Pessoal', valorCentavos: 985000, percentual: 23.9 },
    { categoriaId: 'cat-lavanderia', categoriaNome: 'Lavanderia', valorCentavos: 742000, percentual: 18.0 },
    { categoriaId: 'cat-manutencao', categoriaNome: 'Manutenção', valorCentavos: 498030, percentual: 12.1 },
    { categoriaId: 'cat-projetos', categoriaNome: 'Projetos acadêmicos', valorCentavos: 321500, percentual: 7.8 },
    { categoriaId: 'cat-escritorio', categoriaNome: 'Material de escritório', valorCentavos: 183000, percentual: 4.4 },
    { categoriaId: null, categoriaNome: null, valorCentavos: 72000, percentual: 1.7 },
  ],
}

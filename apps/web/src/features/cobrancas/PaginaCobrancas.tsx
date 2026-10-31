import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useListarCobrancas, useResumirCobrancas, type ResumoSituacaoDto } from '@integracasd/api-client'
import { keepPreviousData } from '@tanstack/react-query'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import SeloDaCobranca from '@/compartilhado/componentes/SeloDaCobranca'
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  haQuantoTempo,
  nomeDoMes,
  paraCentavos,
} from '@/compartilhado/formatacao'
import { MARCA_DA_ORIGEM, type SituacaoCobranca } from '@/compartilhado/dominio'
import DialogoSincronizarCobrancas from './DialogoSincronizarCobrancas'

// Texto pequeno sob o número de cada cartão de resumo. `mes` é "AAAA-MM", o mês dos totais finais.
function legendaDoResumo(item: ResumoSituacaoDto, mes: string): string {
  const noMes = `em ${nomeDoMes(mes).toLowerCase()}`
  switch (item.situacao) {
    case 'ABERTA':
    case 'VENCIDA':
      return formatarMoeda(item.valorCentavos)
    case 'PAGA':
    case 'PAGA_COM_REGISTRO_MANUAL':
      return `${formatarMoeda(item.valorCentavos)} ${noMes}`
    case 'CANCELADA':
    case 'ESTORNADA':
      return noMes
  }
}

// Cobranças por página. O mesmo valor vai para a API, que também limita o tamanho (máximo 200).
const POR_PAGINA = 50

const TODAS_AS_SITUACOES: SituacaoCobranca[] = ['ABERTA', 'VENCIDA', 'PAGA', 'PAGA_COM_REGISTRO_MANUAL', 'CANCELADA', 'ESTORNADA']

// "VENCIDA,ABERTA" -> só os valores conhecidos; sem nada válido, o padrão (abertas e vencidas).
function situacoesDaUrl(texto: string | null): SituacaoCobranca[] {
  const lidas = (texto ?? '').split(',').flatMap((parte) => TODAS_AS_SITUACOES.filter((situacao) => situacao === parte))
  return lidas.length > 0 ? lidas : ['ABERTA', 'VENCIDA']
}

// Lista de cobranças. [Cobranças.RF002 a RF008]
// A lista abre só com abertas e vencidas, por vencimento; as demais situações se ligam pelos cartões de resumo.
function PaginaCobrancas() {
  const { abrirNovaCobranca } = useAcoesGlobais()
  // As situações podem chegar pela URL (ex.: "Ver todas as cobranças vencidas", nos Indicadores).
  const [parametros] = useSearchParams()
  const [situacoes, definirSituacoes] = useState<SituacaoCobranca[]>(() => situacoesDaUrl(parametros.get('situacoes')))
  const [busca, definirBusca] = useState('')
  const [vencimentoDe, definirVencimentoDe] = useState('')
  const [vencimentoAte, definirVencimentoAte] = useState('')
  const [valorMinimo, definirValorMinimo] = useState('')
  const [valorMaximo, definirValorMaximo] = useState('')
  const [sincronizarAberto, definirSincronizarAberto] = useState(false)
  // Página atual da lista. Todo filtro novo volta para a página 1: a página 3 de um filtro
  // não tem relação com a página 3 de outro.
  const [pagina, definirPagina] = useState(1)

  const resumo = useResumirCobrancas()
  const minimo = paraCentavos(valorMinimo)
  const maximo = paraCentavos(valorMaximo)
  // A API recebe as situações separadas por vírgula; o filtro de verdade é feito no backend.
  const cobrancas = useListarCobrancas({
    situacoes: situacoes.join(','),
    busca: busca || undefined,
    vencimentoDe: vencimentoDe || undefined,
    vencimentoAte: vencimentoAte || undefined,
    valorMinimoCentavos: Number.isNaN(minimo) ? undefined : minimo,
    valorMaximoCentavos: Number.isNaN(maximo) ? undefined : maximo,
    pagina,
    tamanhoPagina: POR_PAGINA,
  }, {
    // Ao trocar de página, a tabela continua mostrando a página anterior até a nova chegar,
    // em vez de piscar o "carregando".
    query: { placeholderData: keepPreviousData },
  })
  const itens = cobrancas.data?.itens ?? []
  const total = cobrancas.data?.total ?? 0
  const totalDePaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const primeiro = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const ultimo = (pagina - 1) * POR_PAGINA + itens.length
  const conciliacao = resumo.data?.conciliacao

  function alternarSituacao(situacao: SituacaoCobranca) {
    definirPagina(1)
    definirSituacoes((atuais) =>
      atuais.includes(situacao) ? atuais.filter((s) => s !== situacao) : [...atuais, situacao],
    )
  }

  function limparFiltros() {
    definirPagina(1)
    definirBusca('')
    definirVencimentoDe('')
    definirVencimentoAte('')
    definirValorMinimo('')
    definirValorMaximo('')
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Cobranças</h1>
          {conciliacao && (
            // Ícone e texto lado a lado (flex): o ícone nunca fica sozinho numa linha.
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ paddingTop: 2 }}>
                <Icone nome={conciliacao.ativa ? 'check' : 'alerta'} />
              </span>
              <span>
                {conciliacao.ativa
                  ? 'Conciliação automática ativa'
                  : 'Conciliação automática inativa: confira a integração com o Asaas'}
                {conciliacao.ultimaNotificacaoEm &&
                  ` · última notificação do Asaas ${haQuantoTempo(conciliacao.ultimaNotificacaoEm)}`}
                {conciliacao.ultimaSincronizacao &&
                  ` · última sincronização em ${formatarDataHora(conciliacao.ultimaSincronizacao.iniciadaEm).replace(' ', ' às ')}`}
              </span>
            </p>
          )}
        </div>
        <div className="acoes">
          <Link className="botao" to="/cobrancas/pendencias">
            <Icone nome="alerta" />
            Pendências{conciliacao && conciliacao.pendenciasAbertas > 0 ? ` (${conciliacao.pendenciasAbertas})` : ''}
          </Link>
          <button type="button" className="botao" onClick={() => definirSincronizarAberto(true)}>
            <Icone nome="sincronizar" />
            Sincronizar com o Asaas
          </button>
          <button type="button" className="botao botao-principal" onClick={() => abrirNovaCobranca()}>
            <Icone nome="mais" />
            Nova cobrança
          </button>
        </div>
      </div>

      <div className="resumo-situacoes" aria-label="Filtrar por situação">
        {resumo.data?.situacoes.map((item) => (
          <button
            key={item.situacao}
            type="button"
            className="resumo-situacao"
            aria-pressed={situacoes.includes(item.situacao)}
            onClick={() => alternarSituacao(item.situacao)}
          >
            <SeloDaCobranca situacao={item.situacao} />
            <strong>{formatarInteiro(item.quantidade)}</strong>
            <span>{legendaDoResumo(item, resumo.data.mes)}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <div className="campo" style={{ flex: 1, maxWidth: 300 }}>
          <label htmlFor="cb-aluno">Aluno</label>
          <input
            id="cb-aluno"
            type="search"
            placeholder="Nome ou CPF"
            value={busca}
            onChange={(evento) => { definirBusca(evento.target.value); definirPagina(1) }}
          />
        </div>
        <div className="campo">
          <label htmlFor="cb-venc-de">Vencimento de</label>
          <input id="cb-venc-de" type="date" value={vencimentoDe} onChange={(evento) => { definirVencimentoDe(evento.target.value); definirPagina(1) }} />
        </div>
        <div className="campo">
          <label htmlFor="cb-venc-ate">até</label>
          <input id="cb-venc-ate" type="date" value={vencimentoAte} onChange={(evento) => { definirVencimentoAte(evento.target.value); definirPagina(1) }} />
        </div>
        <div className="campo" style={{ width: 120 }}>
          <label htmlFor="cb-valor-min">Valor mínimo</label>
          <input id="cb-valor-min" placeholder="R$ 0,00" value={valorMinimo} onChange={(evento) => { definirValorMinimo(evento.target.value); definirPagina(1) }} />
        </div>
        <div className="campo" style={{ width: 120 }}>
          <label htmlFor="cb-valor-max">Valor máximo</label>
          <input id="cb-valor-max" placeholder="R$ 0,00" value={valorMaximo} onChange={(evento) => { definirValorMaximo(evento.target.value); definirPagina(1) }} />
        </div>
        <button type="button" className="botao botao-fantasma" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      <EstadoDaConsulta
        carregando={cobrancas.isPending}
        erro={cobrancas.error}
        aoTentarDeNovo={() => void cobrancas.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhuma cobrança encontrada. Confira os filtros ou escolha outras situações nos cartões acima."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Descrição</th>
                <th className="numero">Valor</th>
                <th>Vencimento</th>
                <th>Situação</th>
                <th className="numero">Atraso</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((cobranca) => (
                <tr key={cobranca.id}>
                  <td>
                    <Link className="nome-principal" to={`/cobrancas/${cobranca.id}`}>
                      {cobranca.alunoNome}
                    </Link>
                  </td>
                  <td>
                    {cobranca.descricao}
                    {MARCA_DA_ORIGEM[cobranca.origem] && <span className="secundario">{MARCA_DA_ORIGEM[cobranca.origem]}</span>}
                  </td>
                  <td className="numero">{formatarMoeda(cobranca.valorCentavos)}</td>
                  <td>{formatarData(cobranca.vencimento)}</td>
                  <td>
                    <SeloDaCobranca situacao={cobranca.situacao} />
                    {cobranca.semSincronizarHaDias !== null && (
                      <span
                        className="secundario"
                        data-dica={`A última consulta desta cobrança no Asaas foi há ${cobranca.semSincronizarHaDias} dias. Sincronize antes de cobrar o aluno.`}
                      >
                        <Icone nome="alerta" /> Sem sincronizar há {cobranca.semSincronizarHaDias} dias
                      </span>
                    )}
                  </td>
                  <td className="numero">{cobranca.diasDeAtraso !== null ? `${cobranca.diasDeAtraso} dias` : '—'}</td>
                  <td className="acoes">
                    <Link className="botao botao-pequeno" to={`/cobrancas/${cobranca.id}`}>
                      <Icone nome="trilha" />
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <RodapeDaTabela
            texto={`Mostrando ${formatarInteiro(primeiro)}–${formatarInteiro(ultimo)} de ${formatarInteiro(total)} cobranças`}
            paginacao={{ pagina, totalDePaginas, aoMudar: definirPagina }}
          />
        </div>
      </EstadoDaConsulta>

      {sincronizarAberto && (
        <DialogoSincronizarCobrancas
          aoFechar={() => definirSincronizarAberto(false)}
          ultimaSincronizacao={conciliacao?.ultimaSincronizacao ?? null}
        />
      )}
    </>
  )
}

export default PaginaCobrancas

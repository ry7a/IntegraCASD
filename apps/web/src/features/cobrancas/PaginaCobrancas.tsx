import { useState } from 'react'
import { Link } from 'react-router'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import SeloDaCobranca from '@/compartilhado/componentes/SeloDaCobranca'
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  haQuantoTempo,
  paraCentavos,
} from '@/compartilhado/formatacao'
import type { SituacaoCobranca } from '@/compartilhado/dominio'
import type { ResumoSituacaoDto } from './contrato'
import { useListarCobrancas, useResumoDasCobrancas } from './consultas'
import DialogoSincronizarCobrancas from './DialogoSincronizarCobrancas'

// Texto pequeno sob o número de cada cartão de resumo.
function legendaDoResumo(item: ResumoSituacaoDto): string {
  switch (item.situacao) {
    case 'ABERTA':
    case 'VENCIDA':
      return formatarMoeda(item.valorCentavos)
    case 'PAGA':
    case 'PAGA_COM_REGISTRO_MANUAL':
      return `${formatarMoeda(item.valorCentavos)} em outubro`
    case 'CANCELADA':
    case 'ESTORNADA':
      return 'em outubro'
  }
}

// Lista de cobranças. [Cobranças.RF002 a RF008]
// A lista abre só com abertas e vencidas, por vencimento; as demais situações se ligam pelos cartões de resumo.
function PaginaCobrancas() {
  const { abrirNovaCobranca } = useAcoesGlobais()
  const [situacoes, definirSituacoes] = useState<SituacaoCobranca[]>(['ABERTA', 'VENCIDA'])
  const [busca, definirBusca] = useState('')
  const [vencimentoDe, definirVencimentoDe] = useState('')
  const [vencimentoAte, definirVencimentoAte] = useState('')
  const [valorMinimo, definirValorMinimo] = useState('')
  const [valorMaximo, definirValorMaximo] = useState('')
  const [sincronizarAberto, definirSincronizarAberto] = useState(false)

  const resumo = useResumoDasCobrancas()
  const minimo = paraCentavos(valorMinimo)
  const maximo = paraCentavos(valorMaximo)
  const cobrancas = useListarCobrancas({
    situacoes,
    busca: busca || undefined,
    vencimentoDe: vencimentoDe || undefined,
    vencimentoAte: vencimentoAte || undefined,
    valorMinimoCentavos: Number.isNaN(minimo) ? undefined : minimo,
    valorMaximoCentavos: Number.isNaN(maximo) ? undefined : maximo,
  })
  const itens = cobrancas.data?.itens ?? []
  const conciliacao = resumo.data?.conciliacao

  function alternarSituacao(situacao: SituacaoCobranca) {
    definirSituacoes((atuais) =>
      atuais.includes(situacao) ? atuais.filter((s) => s !== situacao) : [...atuais, situacao],
    )
  }

  function limparFiltros() {
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
            <strong>{item.quantidade.toLocaleString('pt-BR')}</strong>
            <span>{legendaDoResumo(item)}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <div className="campo" style={{ flex: 1, maxWidth: 300 }}>
          <label htmlFor="cb-aluno">Aluno</label>
          {/* TODO [Cobranças.RF002]: buscar também por CPF (o backend tem o CPF; esta amostra só filtra pelo nome). */}
          <input
            id="cb-aluno"
            type="search"
            placeholder="Nome ou CPF"
            value={busca}
            onChange={(evento) => definirBusca(evento.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="cb-venc-de">Vencimento de</label>
          <input id="cb-venc-de" type="date" value={vencimentoDe} onChange={(evento) => definirVencimentoDe(evento.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cb-venc-ate">até</label>
          <input id="cb-venc-ate" type="date" value={vencimentoAte} onChange={(evento) => definirVencimentoAte(evento.target.value)} />
        </div>
        <div className="campo" style={{ width: 120 }}>
          <label htmlFor="cb-valor-min">Valor mínimo</label>
          <input id="cb-valor-min" placeholder="R$ 0,00" value={valorMinimo} onChange={(evento) => definirValorMinimo(evento.target.value)} />
        </div>
        <div className="campo" style={{ width: 120 }}>
          <label htmlFor="cb-valor-max">Valor máximo</label>
          <input id="cb-valor-max" placeholder="R$ 0,00" value={valorMaximo} onChange={(evento) => definirValorMaximo(evento.target.value)} />
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
                    {cobranca.origem === 'AVULSA' && <span className="secundario">Cobrança avulsa</span>}
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
          <RodapeDaTabela texto={`Mostrando ${itens.length} de ${cobrancas.data?.total ?? 0} cobranças`} />
        </div>
      </EstadoDaConsulta>

      <DialogoSincronizarCobrancas
        aberto={sincronizarAberto}
        aoFechar={() => definirSincronizarAberto(false)}
        ultimaSincronizacao={conciliacao?.ultimaSincronizacao ?? null}
      />
    </>
  )
}

export default PaginaCobrancas

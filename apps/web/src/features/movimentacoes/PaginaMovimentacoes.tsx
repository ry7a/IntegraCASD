import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useListarMovimentacoes, useListarOpcoesDaMovimentacao, type MovimentacaoDto } from '@integracasd/api-client'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import { CelulaDeOrigem } from '@/compartilhado/componentes/CelulasDeMovimentacao'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import { ROTULO_DA_FORMA, type FormaPagamento, type TipoMovimentacao } from '@/compartilhado/dominio'
import { formatarData, formatarMes, formatarMoeda, formatarMoedaComSinal, hojeIso } from '@/compartilhado/formatacao'
import DialogoEstornar from './DialogoEstornar'

// Os últimos 12 meses, do corrente para trás ("AAAA-MM").
function ultimosMeses(): string[] {
  const [ano, mes] = hojeIso().split('-').map(Number)
  return Array.from({ length: 12 }, (_, atras) => {
    const total = ano * 12 + (mes - 1) - atras
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  })
}
const MESES_PARA_ESCOLHER = ultimosMeses()

function rotuloDoVinculo(movimentacao: MovimentacaoDto): string | null {
  const vinculo = movimentacao.vinculo
  if (!vinculo) return null
  if (vinculo.tipo === 'CONTRATO') return `Contrato · ${vinculo.nome ?? ''}`
  if (vinculo.tipo === 'PROJETO') return `Projeto · ${vinculo.nome ?? ''}`
  if (vinculo.tipo === 'FUNCIONARIO') return `Funcionário · ${vinculo.nome ?? ''}`
  return `Cobrança · ${vinculo.nome ?? ''}`
}

// Entradas e saídas. [Movimentações.RF001 a RF003]
// Movimentação registrada não é editada nem excluída: correções são feitas por estorno.
function PaginaMovimentacoes() {
  const { abrirNovaMovimentacao } = useAcoesGlobais()
  // O mês e a categoria podem chegar pela URL (link "Gastos por categoria" dos Indicadores).
  const [parametros] = useSearchParams()
  const [mes, definirMes] = useState(parametros.get('mes') ?? MESES_PARA_ESCOLHER[0])
  const [tipo, definirTipo] = useState<TipoMovimentacao | ''>('')
  const [categoriaId, definirCategoriaId] = useState(parametros.get('categoriaId') ?? '')
  const [forma, definirForma] = useState<FormaPagamento | ''>('')
  const [ocultarEstornos, definirOcultarEstornos] = useState(false)
  // "contrato:<id>" ou "projeto:<id>"; vazio = todos.
  const [vinculoFiltro, definirVinculoFiltro] = useState('')
  const [tipoDoVinculo, idDoVinculo] = vinculoFiltro.split(':')
  const [paraEstornar, definirParaEstornar] = useState<MovimentacaoDto | null>(null)

  const opcoes = useListarOpcoesDaMovimentacao()
  const movimentacoes = useListarMovimentacoes({
    mes,
    tipo: tipo || undefined,
    categoriaId: categoriaId || undefined,
    forma: forma || undefined,
    ocultarEstornos: ocultarEstornos || undefined,
    contratoId: tipoDoVinculo === 'contrato' ? idDoVinculo : undefined,
    projetoId: tipoDoVinculo === 'projeto' ? idDoVinculo : undefined,
  })
  const dados = movimentacoes.data
  const itens = dados?.itens ?? []

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Movimentações</h1>
          <p>
            Entradas e saídas do CASD. Movimentação registrada não é editada nem excluída: correções são feitas por
            estorno.
          </p>
        </div>
        <div className="acoes">
          <button type="button" className="botao botao-principal" onClick={abrirNovaMovimentacao}>
            <Icone nome="mais" />
            Nova movimentação
          </button>
        </div>
      </div>

      <section className="grade grade-3" aria-label="Totais do recorte">
        <div className="cartao indicador">
          <div className="rotulo">Entradas</div>
          <div className="valor">{formatarMoeda(dados?.totais.entradasCentavos ?? 0)}</div>
          <div className="detalhe">{dados?.totais.quantidadeEntradas ?? 0} movimentações</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Saídas</div>
          <div className="valor">{formatarMoeda(dados?.totais.saidasCentavos ?? 0)}</div>
          <div className="detalhe">{dados?.totais.quantidadeSaidas ?? 0} movimentações</div>
        </div>
        <div className="cartao indicador indicador-destaque">
          <div className="rotulo">Saldo do recorte</div>
          <div className="valor">{formatarMoeda(dados?.totais.saldoCentavos ?? 0)}</div>
          <div className="detalhe">{formatarMes(mes)}, todos os filtros abaixo</div>
        </div>
      </section>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="mv-periodo">Período</label>
          <select id="mv-periodo" value={mes} onChange={(evento) => definirMes(evento.target.value)}>
            {[...new Set([...MESES_PARA_ESCOLHER, mes])].map((opcao) => (
              <option key={opcao} value={opcao}>
                {formatarMes(opcao)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="mv-tipo">Tipo</label>
          <select
            id="mv-tipo"
            value={tipo}
            onChange={(evento) => definirTipo(evento.target.value as TipoMovimentacao | '')}
          >
            <option value="">Entradas e saídas</option>
            <option value="ENTRADA">Só entradas</option>
            <option value="SAIDA">Só saídas</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="mv-categoria">Categoria</label>
          <select
            id="mv-categoria"
            value={categoriaId}
            onChange={(evento) => definirCategoriaId(evento.target.value)}
          >
            <option value="">Todas</option>
            {opcoes.data?.categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="mv-forma">Forma de pagamento</label>
          <select
            id="mv-forma"
            value={forma}
            onChange={(evento) => definirForma(evento.target.value as FormaPagamento | '')}
          >
            <option value="">Todas</option>
            {Object.entries(ROTULO_DA_FORMA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ flex: 1, maxWidth: 260 }}>
          <label htmlFor="mv-vinculo">Projeto ou contrato</label>
          <select
            id="mv-vinculo"
            value={vinculoFiltro}
            onChange={(evento) => definirVinculoFiltro(evento.target.value)}
          >
            <option value="">Todos</option>
            {opcoes.data?.contratos.map((contrato) => (
              <option key={contrato.id} value={`contrato:${contrato.id}`}>
                Contrato · {contrato.nome}
              </option>
            ))}
            {opcoes.data?.projetos.map((projeto) => (
              <option key={projeto.id} value={`projeto:${projeto.id}`}>
                Projeto · {projeto.nome}
              </option>
            ))}
          </select>
        </div>
        <label className="campo-check">
          <input
            type="checkbox"
            checked={ocultarEstornos}
            onChange={(evento) => definirOcultarEstornos(evento.target.checked)}
          />
          Ocultar estornos
        </label>
      </div>

      <EstadoDaConsulta
        carregando={movimentacoes.isPending}
        erro={movimentacoes.error}
        aoTentarDeNovo={() => void movimentacoes.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhuma movimentação neste período e filtro."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Forma</th>
                <th>Origem</th>
                <th className="numero">Valor</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((movimentacao) => {
                const estornada = movimentacao.estornadaEm !== null
                const vinculo = rotuloDoVinculo(movimentacao)
                return (
                  <tr key={movimentacao.id} className={estornada ? 'linha-estornada' : undefined}>
                    <td>{formatarData(movimentacao.data)}</td>
                    <td>
                      {estornada ? (
                        <span className="riscado">{movimentacao.descricao}</span>
                      ) : (
                        <span className="nome-principal">{movimentacao.descricao}</span>
                      )}
                      {(vinculo || movimentacao.motivoEstorno) && (
                        <span className="secundario">
                          {[vinculo, movimentacao.motivoEstorno && `motivo: ${movimentacao.motivoEstorno}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {estornada && movimentacao.estornadaEm && (
                        <span className="selo">
                          <Icone nome="estornar" />
                          Estornada em {formatarData(movimentacao.estornadaEm)}
                        </span>
                      )}
                    </td>
                    <td>
                      {movimentacao.categoriaNome}
                      <span className="secundario">{movimentacao.contaNome}</span>
                    </td>
                    <td>{ROTULO_DA_FORMA[movimentacao.forma]}</td>
                    <td>
                      <CelulaDeOrigem movimentacao={movimentacao} />
                    </td>
                    <td className="numero">
                      {estornada ? (
                        <span className="riscado">{formatarMoedaComSinal(movimentacao.tipo, movimentacao.valorCentavos)}</span>
                      ) : (
                        formatarMoedaComSinal(movimentacao.tipo, movimentacao.valorCentavos)
                      )}
                    </td>
                    <td className="acoes">
                      {movimentacao.podeEstornar && (
                        <button type="button" className="botao botao-pequeno" onClick={() => definirParaEstornar(movimentacao)}>
                          <Icone nome="estornar" />
                          Estornar
                        </button>
                      )}
                      {!movimentacao.podeEstornar && movimentacao.motivoSemEstorno && !estornada && (
                        <span data-dica={movimentacao.motivoSemEstorno}>
                          <button type="button" className="botao botao-pequeno" disabled>
                            <Icone nome="estornar" />
                            Estornar
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <RodapeDaTabela texto={`Mostrando ${itens.length} de ${dados?.total ?? 0} movimentações de ${formatarMes(mes).toLowerCase()}`} />
        </div>
      </EstadoDaConsulta>

      {paraEstornar && <DialogoEstornar movimentacao={paraEstornar} aoFechar={() => definirParaEstornar(null)} />}
    </>
  )
}

export default PaginaMovimentacoes

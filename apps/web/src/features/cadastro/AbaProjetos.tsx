import { useState } from 'react'
import { Link } from 'react-router'
import { useListarProjetos, type ListarProjetosSituacao, type ProjetoDto } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda } from '@/compartilhado/formatacao'
import DialogoProjeto from './DialogoProjeto'
import { ROTULO_DA_SITUACAO_DO_PROJETO } from './rotulos'

// [Cadastros.RF005] Orçamento previsto x movimentado.
function AbaProjetos() {
  const [situacao, definirSituacao] = useState<ListarProjetosSituacao>('em-andamento')
  // undefined = nenhum diálogo; null = novo projeto; um projeto = edição.
  const [emEdicao, definirEmEdicao] = useState<ProjetoDto | null | undefined>(undefined)
  const projetos = useListarProjetos({ situacao })
  const itens = projetos.data?.itens ?? []

  return (
    <>
      <div className="filtros">
        <div className="campo">
          <label htmlFor="pr-situacao">Situação</label>
          <select
            id="pr-situacao"
            value={situacao}
            onChange={(evento) => definirSituacao(evento.target.value as ListarProjetosSituacao)}
          >
            <option value="em-andamento">Em andamento</option>
            <option value="encerrados">Encerrados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirEmEdicao(null)}>
            <Icone nome="mais" />
            Novo projeto
          </button>
        </div>
      </div>

      <EstadoDaConsulta
        carregando={projetos.isPending}
        erro={projetos.error}
        aoTentarDeNovo={() => void projetos.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum projeto encontrado para este filtro."
      >
        <div className="grade grade-cartoes">
          {itens.map((projeto) => {
            const gasto = projeto.saidasCentavos
            const orcamento = projeto.orcamentoPrevistoCentavos
            const percentual = orcamento ? Math.min(100, Math.round((gasto / orcamento) * 100)) : null
            return (
              <div className="cartao" key={projeto.id}>
                <h3>{projeto.nome}</h3>
                <p className="texto-apoio" style={{ margin: '4px 0 12px' }}>
                  {projeto.codigo}
                  {projeto.responsavel && ` · Resp.: ${projeto.responsavel}`} · {formatarData(projeto.dataInicio)}
                  {projeto.dataFim ? ` a ${formatarData(projeto.dataFim)}` : ''}
                </p>
                <div className="texto-apoio">
                  Gasto <strong style={{ color: 'var(--foreground)' }}>{formatarMoeda(gasto)}</strong>
                  {orcamento ? ` de ${formatarMoeda(orcamento)} previstos` : ' · sem orçamento previsto'}
                  {projeto.entradasCentavos > 0 && ` · entradas ${formatarMoeda(projeto.entradasCentavos)}`}
                </div>
                {percentual !== null && (
                  <div className="progresso" data-dica={`${percentual}% do orçamento previsto`}>
                    <div style={{ width: `${percentual}%` }}></div>
                  </div>
                )}
                {/* Fluxo A1: encerrado, mostra o resultado contra o orçamento. */}
                {projeto.encerrado && orcamento !== null && (
                  <p className="texto-apoio" style={{ margin: '8px 0 0' }}>
                    {gasto <= orcamento
                      ? `Ficou ${formatarMoeda(orcamento - gasto)} abaixo do orçamento.`
                      : `Passou ${formatarMoeda(gasto - orcamento)} do orçamento.`}
                  </p>
                )}
                <p style={{ margin: '12px 0 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={projeto.encerrado ? 'selo' : 'selo selo-aberta'}>{ROTULO_DA_SITUACAO_DO_PROJETO[projeto.situacao]}</span>
                  <button type="button" className="botao botao-pequeno botao-fantasma" onClick={() => definirEmEdicao(projeto)}>
                    <Icone nome="editar" />
                    Editar
                  </button>
                  <Link className="botao botao-pequeno" to={`/movimentacoes?projetoId=${projeto.id}`}>
                    Movimentações
                  </Link>
                </p>
              </div>
            )
          })}
        </div>
      </EstadoDaConsulta>

      {emEdicao !== undefined && <DialogoProjeto projeto={emEdicao} aoFechar={() => definirEmEdicao(undefined)} />}
    </>
  )
}

export default AbaProjetos

import { useState } from 'react'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda } from '@/compartilhado/formatacao'
import type { SituacaoDoFiltroDeProjetos } from './contrato'
import { useListarProjetos } from './consultas'

// [Cadastros.RF005] Orçamento previsto x movimentado.
function AbaProjetos() {
  const [situacao, definirSituacao] = useState<SituacaoDoFiltroDeProjetos>('em-andamento')
  const projetos = useListarProjetos(situacao)
  const itens = projetos.data?.itens ?? []

  return (
    <>
      <div className="filtros">
        <div className="campo">
          <label htmlFor="pr-situacao">Situação</label>
          <select id="pr-situacao" value={situacao} onChange={(evento) => definirSituacao(evento.target.value as SituacaoDoFiltroDeProjetos)}>
            <option value="em-andamento">Em andamento</option>
            <option value="encerrados">Encerrados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          {/* TODO [Cadastros.RF005]: formulário de novo projeto. */}
          <button type="button" className="botao botao-principal">
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
        <div className="grade grade-3">
          {itens.map((projeto) => {
            const gasto = projeto.movimentadoCentavos
            const percentual = projeto.orcamentoCentavos
              ? Math.min(100, Math.round((gasto / projeto.orcamentoCentavos) * 100))
              : null
            return (
              <div className="cartao" key={projeto.id}>
                <h3>{projeto.nome}</h3>
                <p className="texto-apoio" style={{ margin: '4px 0 12px' }}>
                  Resp.: {projeto.responsavel} · {formatarData(projeto.dataInicio)} a {formatarData(projeto.dataFim)}
                </p>
                <div className="texto-apoio">
                  Movimentado <strong style={{ color: 'var(--foreground)' }}>{formatarMoeda(gasto)}</strong>
                  {projeto.orcamentoCentavos
                    ? ` de ${formatarMoeda(projeto.orcamentoCentavos)} previstos`
                    : ' · sem orçamento previsto'}
                </div>
                {percentual !== null && (
                  <div className="progresso" data-dica={`${percentual}% do orçamento previsto`}>
                    <div style={{ width: `${percentual}%` }}></div>
                  </div>
                )}
                <p style={{ margin: '12px 0 0' }}>
                  {projeto.situacao === 'EM_ANDAMENTO' ? (
                    <span className="selo selo-aberta">Em andamento</span>
                  ) : (
                    <span className="selo">Encerrado</span>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </EstadoDaConsulta>
    </>
  )
}

export default AbaProjetos

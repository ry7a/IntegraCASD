import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { useListarCategoriasDaAdministracao } from './consultas'
import type { AplicacaoCategoria } from './contrato'

const ROTULO_DA_APLICACAO: Record<AplicacaoCategoria, string> = {
  ENTRADAS: 'Entradas',
  SAIDAS: 'Saídas',
  ENTRADAS_E_SAIDAS: 'Entradas e saídas',
}

// Categorias de movimentação. [Administração.RF002]
function AbaCategorias() {
  const consulta = useListarCategoriasDaAdministracao()
  const itens = consulta.data?.itens ?? []

  return (
    <>
      <div className="filtros">
        <p className="texto-apoio" style={{ margin: 0 }}>
          Categoria em uso pode ser inativada, mas não excluída: os relatórios antigos continuam iguais.
        </p>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          {/* TODO [Administração.RF002]: formulário de nova categoria. */}
          <button type="button" className="botao botao-principal">
            <Icone nome="mais" />
            Nova categoria
          </button>
        </div>
      </div>
      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhuma categoria cadastrada."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Aplica-se a</th>
                <th className="numero">Movimentações</th>
                <th>Situação</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((categoria) => (
                <tr key={categoria.id}>
                  <td className="nome-principal">{categoria.nome}</td>
                  <td>{ROTULO_DA_APLICACAO[categoria.aplicaA]}</td>
                  <td className="numero">{categoria.quantidadeMovimentacoes.toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={categoria.ativa ? 'selo selo-paga' : 'selo'}>{categoria.ativa ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td className="acoes">
                    <button type="button" className="botao botao-pequeno botao-fantasma">
                      <Icone nome="editar" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>
    </>
  )
}

export default AbaCategorias

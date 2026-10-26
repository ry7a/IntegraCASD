import { useState } from 'react'
import { useListarCategoriasComUso, type CategoriaComUsoDto } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarInteiro } from '@/compartilhado/formatacao'
import DialogoCategoria from './DialogoCategoria'
import { ROTULO_DO_TIPO_DA_CATEGORIA } from './rotulos'

// Diálogo fechado = `null`. Aberto, guarda a categoria em edição (`categoria: null` = inclusão).
type EstadoDoDialogo = null | { categoria: CategoriaComUsoDto | null }

// Categorias de movimentação. [Administração.RF002]
function AbaCategorias() {
  const consulta = useListarCategoriasComUso()
  const itens = consulta.data?.itens ?? []
  const [dialogo, definirDialogo] = useState<EstadoDoDialogo>(null)

  return (
    <>
      <div className="filtros">
        <p className="texto-apoio" style={{ margin: 0 }}>
          Categoria em uso pode ser inativada, mas não excluída: os relatórios antigos continuam iguais.
        </p>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirDialogo({ categoria: null })}>
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
        mensagemVazia="Nenhuma categoria cadastrada. Use “Nova categoria” para incluir a primeira."
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
                  <td>{ROTULO_DO_TIPO_DA_CATEGORIA[categoria.tipo]}</td>
                  <td className="numero">{formatarInteiro(categoria.quantidadeMovimentacoes)}</td>
                  <td>
                    <span className={categoria.ativo ? 'selo selo-paga' : 'selo'}>{categoria.ativo ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="botao botao-pequeno botao-fantasma"
                      aria-label={`Editar a categoria ${categoria.nome}`}
                      onClick={() => definirDialogo({ categoria })}
                    >
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
      {dialogo && <DialogoCategoria categoria={dialogo.categoria} aoFechar={() => definirDialogo(null)} />}
    </>
  )
}

export default AbaCategorias

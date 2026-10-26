import { useState } from 'react'
import { useListarCategoriasComUso, type CategoriaComUsoDto } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarInteiro } from '@/compartilhado/formatacao'
import DialogoCategoria from './DialogoCategoria'
import DialogoExcluirCategoria from './DialogoExcluirCategoria'
import { ROTULO_DO_TIPO_DA_CATEGORIA } from './rotulos'

// Diálogo fechado = `null`. Aberto, diz qual é e com qual categoria
// (no de edição, `categoria: null` = inclusão).
type EstadoDoDialogo =
  | null
  | { tipo: 'editar'; categoria: CategoriaComUsoDto | null }
  | { tipo: 'excluir'; categoria: CategoriaComUsoDto }

// Categorias de movimentação. [Administração.RF002]
function AbaCategorias() {
  const consulta = useListarCategoriasComUso()
  const itens = consulta.data?.itens ?? []
  const [dialogo, definirDialogo] = useState<EstadoDoDialogo>(null)

  return (
    <>
      <div className="filtros">
        <p className="texto-apoio" style={{ margin: 0 }}>
          Só categoria nunca usada pode ser excluída. A que já tem movimentações se inativa em “Editar”: os
          relatórios antigos continuam iguais.
        </p>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirDialogo({ tipo: 'editar', categoria: null })}>
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
                      onClick={() => definirDialogo({ tipo: 'editar', categoria })}
                    >
                      <Icone nome="editar" />
                      Editar
                    </button>
                    {/* Só categoria sem movimentações pode ser excluída; a usada se inativa em "Editar". */}
                    {categoria.quantidadeMovimentacoes === 0 && (
                      <button
                        type="button"
                        className="botao botao-pequeno botao-fantasma"
                        aria-label={`Excluir a categoria ${categoria.nome}`}
                        onClick={() => definirDialogo({ tipo: 'excluir', categoria })}
                      >
                        <Icone nome="excluir" />
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>
      {dialogo?.tipo === 'editar' && (
        <DialogoCategoria categoria={dialogo.categoria} aoFechar={() => definirDialogo(null)} />
      )}
      {dialogo?.tipo === 'excluir' && (
        <DialogoExcluirCategoria categoria={dialogo.categoria} aoFechar={() => definirDialogo(null)} />
      )}
    </>
  )
}

export default AbaCategorias

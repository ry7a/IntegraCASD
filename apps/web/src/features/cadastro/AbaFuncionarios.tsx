import { useState } from 'react'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData } from '@/compartilhado/formatacao'
import { useListarFuncionarios } from './consultas'

// [Cadastros.RF002]
function AbaFuncionarios() {
  const [busca, definirBusca] = useState('')
  const funcionarios = useListarFuncionarios(busca)
  const itens = funcionarios.data?.itens ?? []

  return (
    <>
      <div className="filtros">
        <div className="campo" style={{ flex: 1, maxWidth: 360 }}>
          <label htmlFor="fu-busca">Nome ou CPF</label>
          <input id="fu-busca" type="search" value={busca} onChange={(evento) => definirBusca(evento.target.value)} />
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          {/* TODO [Cadastros.RF002]: formulário de novo funcionário. */}
          <button type="button" className="botao botao-principal">
            <Icone nome="mais" />
            Novo funcionário
          </button>
        </div>
      </div>

      <EstadoDaConsulta
        carregando={funcionarios.isPending}
        erro={funcionarios.error}
        aoTentarDeNovo={() => void funcionarios.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum funcionário encontrado."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Admissão</th>
                <th>Desligamento</th>
                <th>Situação</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((funcionario) => (
                <tr key={funcionario.id}>
                  <td className="nome-principal">{funcionario.nome}</td>
                  <td>{funcionario.cargo}</td>
                  <td>{formatarData(funcionario.dataAdmissao)}</td>
                  <td>{funcionario.dataDesligamento ? formatarData(funcionario.dataDesligamento) : '—'}</td>
                  <td>
                    <span className={funcionario.ativo ? 'selo selo-paga' : 'selo'}>
                      {funcionario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
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

export default AbaFuncionarios

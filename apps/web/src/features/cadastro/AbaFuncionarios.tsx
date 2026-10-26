import { useState } from 'react'
import { useListarFuncionarios, type FuncionarioDto, type ListarFuncionariosSituacao } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarCpf, formatarData, formatarMoeda } from '@/compartilhado/formatacao'
import DialogoFuncionario from './DialogoFuncionario'

const ROTULO_DO_FILTRO: Record<ListarFuncionariosSituacao, string> = {
  ativos: 'Ativos',
  inativos: 'Inativos',
  todos: 'Todos',
}

// Diálogo fechado = `null`. Aberto, guarda o funcionário em edição (`funcionario: null` = inclusão).
type EstadoDoDialogo = null | { funcionario: FuncionarioDto | null }

// [Cadastros.RF002]
function AbaFuncionarios() {
  const [busca, definirBusca] = useState('')
  const [situacao, definirSituacao] = useState<ListarFuncionariosSituacao>('ativos')
  const [dialogo, definirDialogo] = useState<EstadoDoDialogo>(null)
  const consulta = useListarFuncionarios({ situacao })

  // A busca por nome ou CPF é feita aqui, na lista que já veio (são poucos funcionários).
  const texto = busca.trim().toLowerCase()
  const textoSoDigitos = texto.replace(/\D/g, '')
  const itens = (consulta.data?.itens ?? []).filter(
    (funcionario) =>
      funcionario.nome.toLowerCase().includes(texto) ||
      (textoSoDigitos !== '' && funcionario.cpf.includes(textoSoDigitos)),
  )

  return (
    <>
      <div className="filtros">
        <div className="campo" style={{ flex: 1, maxWidth: 360 }}>
          <label htmlFor="fu-busca">Nome ou CPF</label>
          <input id="fu-busca" type="search" value={busca} onChange={(evento) => definirBusca(evento.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="fu-situacao">Situação</label>
          <select
            id="fu-situacao"
            value={situacao}
            onChange={(evento) => definirSituacao(evento.target.value as ListarFuncionariosSituacao)}
          >
            {Object.entries(ROTULO_DO_FILTRO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirDialogo({ funcionario: null })}>
            <Icone nome="mais" />
            Novo funcionário
          </button>
        </div>
      </div>

      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum funcionário encontrado. Confira a busca e o filtro de situação."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th className="numero">Salário de referência</th>
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
                  <td>
                    <span className="nome-principal">{funcionario.nome}</span>
                    <span className="secundario">CPF {formatarCpf(funcionario.cpf)}</span>
                  </td>
                  <td>{funcionario.cargo}</td>
                  <td className="numero">{formatarMoeda(funcionario.salarioReferenciaCentavos)}</td>
                  <td>{formatarData(funcionario.dataAdmissao)}</td>
                  <td>{funcionario.dataDesligamento ? formatarData(funcionario.dataDesligamento) : '—'}</td>
                  <td>
                    <span className={funcionario.ativo ? 'selo selo-paga' : 'selo'}>
                      {funcionario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="botao botao-pequeno botao-fantasma"
                      aria-label={`Editar o cadastro de ${funcionario.nome}`}
                      onClick={() => definirDialogo({ funcionario })}
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

      {dialogo && <DialogoFuncionario funcionario={dialogo.funcionario} aoFechar={() => definirDialogo(null)} />}
    </>
  )
}

export default AbaFuncionarios

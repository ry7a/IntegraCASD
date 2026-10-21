import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useListarAlunos, type SituacaoAluno } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import { formatarCpf } from '@/compartilhado/formatacao'
import DialogoNovoAluno from './DialogoNovoAluno'

// O banco guarda o enum sem acento; o texto exibido fica aqui.
const rotuloDaSituacao: Record<SituacaoAluno, string> = {
  MATRICULADO: 'Matriculado',
  TRANCADO: 'Trancado',
  DESLIGADO: 'Desligado',
  FORMADO: 'Formado',
  INTERCAMBIO: 'Intercâmbio',
}

// Lista de alunos ativos [Cadastros.RF001]. É a aba "Alunos" da tela de Cadastros.
function ListaDeAlunos() {
  // Hook gerado pelo orval: busca GET /api/alunos e guarda no cache do TanStack Query.
  const { data, error, isPending, refetch } = useListarAlunos()
  // O texto da busca fica na URL: a busca da barra do topo chega aqui por ?busca=...
  const [parametros, definirParametros] = useSearchParams()
  const busca = parametros.get('busca') ?? ''
  const [novoAlunoAberto, definirNovoAlunoAberto] = useState(false)

  function mudarBusca(texto: string) {
    const novos = new URLSearchParams(parametros)
    if (texto) novos.set('busca', texto)
    else novos.delete('busca')
    definirParametros(novos, { replace: true })
  }

  // A API ainda não filtra: a busca por nome ou CPF é feita aqui, só na lista que já veio.
  // TODO [Cadastros.RF001]: filtro de situação (ativos/inativos/todos), coluna "Em aberto" e paginação
  // dependem de a API aceitar esses parâmetros e devolver esses campos.
  const texto = busca.trim().toLowerCase()
  const textoSoDigitos = texto.replace(/\D/g, '')
  const itens = (data?.itens ?? []).filter(
    (aluno) => aluno.nome.toLowerCase().includes(texto) || (textoSoDigitos !== '' && aluno.cpf.includes(textoSoDigitos)),
  )

  return (
    <>
      <div className="filtros">
        <div className="campo" style={{ flex: 1, maxWidth: 360 }}>
          <label htmlFor="al-busca">Nome ou CPF</label>
          <input
            id="al-busca"
            type="search"
            placeholder="Ex.: Lucas ou 123.456"
            value={busca}
            onChange={(evento) => mudarBusca(evento.target.value)}
          />
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirNovoAlunoAberto(true)}>
            <Icone nome="mais" />
            Novo aluno
          </button>
        </div>
      </div>

      <EstadoDaConsulta
        carregando={isPending}
        erro={error}
        aoTentarDeNovo={() => void refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum aluno encontrado. Confira a busca."
      >
        <div className="tabela-envoltorio">
          <table>
            <caption className="sr-only">Alunos ativos</caption>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>E-mail</th>
                <th>Situação</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((aluno) => (
                <tr key={aluno.id}>
                  <td>
                    <Link className="nome-principal" to={`/cadastros/alunos/${aluno.id}`}>
                      {aluno.nome}
                    </Link>
                    <span className="secundario">{aluno.turma ? `Turma ${aluno.turma}` : 'Sem turma'}</span>
                  </td>
                  <td>{formatarCpf(aluno.cpf)}</td>
                  <td>
                    {aluno.email ? (
                      aluno.email
                    ) : (
                      <span className="selo selo-alerta">
                        <Icone nome="alerta" />
                        Falta e-mail
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={aluno.situacao === 'MATRICULADO' ? 'selo selo-paga' : 'selo'}>
                      {aluno.situacao ? rotuloDaSituacao[aluno.situacao] : '—'}
                    </span>
                  </td>
                  <td className="acoes">
                    <Link className="botao botao-pequeno botao-fantasma" to={`/cadastros/alunos/${aluno.id}`}>
                      <Icone nome="editar" />
                      Editar
                    </Link>{' '}
                    <Link className="botao botao-pequeno" to={`/cadastros/alunos/${aluno.id}?aba=cobrancas`}>
                      Cobranças
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <RodapeDaTabela texto={`${itens.length} ${itens.length === 1 ? 'aluno ativo' : 'alunos ativos'}`} />
        </div>
      </EstadoDaConsulta>

      <DialogoNovoAluno aberto={novoAlunoAberto} aoFechar={() => definirNovoAlunoAberto(false)} />
    </>
  )
}

export default ListaDeAlunos

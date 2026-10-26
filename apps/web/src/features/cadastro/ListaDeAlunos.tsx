import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useListarAlunos, useListarTotaisEmAbertoPorAluno, type ListarAlunosSituacao } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import { formatarCpf, formatarMoeda } from '@/compartilhado/formatacao'
import DialogoNovoAluno from './DialogoNovoAluno'

const ROTULO_DO_FILTRO: Record<ListarAlunosSituacao, string> = {
  ativos: 'Ativos',
  inativos: 'Inativos',
  todos: 'Todos',
}

// Lista de alunos [Cadastros.RF001]. É a aba "Alunos" da tela de Cadastros.
function ListaDeAlunos() {
  // O texto da busca e o filtro de situação ficam na URL: a busca da barra do topo chega aqui por ?busca=...
  const [parametros, definirParametros] = useSearchParams()
  const busca = parametros.get('busca') ?? ''
  const situacaoNaUrl = parametros.get('situacao')
  // Valor desconhecido na URL (ex.: link antigo) cai no padrão, em vez de virar erro da API.
  const situacao: ListarAlunosSituacao =
    situacaoNaUrl === 'inativos' || situacaoNaUrl === 'todos' ? situacaoNaUrl : 'ativos'
  // Hook gerado pelo orval: busca GET /api/alunos?situacao=... e guarda no cache do TanStack Query.
  const { data, error, isPending, refetch } = useListarAlunos({ situacao })
  const [novoAlunoAberto, definirNovoAlunoAberto] = useState(false)
  // Coluna "Em aberto": vem de Cobranças, só com os alunos que têm cobrança aberta.
  const totais = useListarTotaisEmAbertoPorAluno()
  const totaisPorAluno = new Map((totais.data?.itens ?? []).map((item) => [item.alunoId, item]))

  function mudarSituacao(nova: ListarAlunosSituacao) {
    const novos = new URLSearchParams(parametros)
    if (nova === 'ativos') novos.delete('situacao')
    else novos.set('situacao', nova)
    definirParametros(novos, { replace: true })
  }

  function mudarBusca(texto: string) {
    const novos = new URLSearchParams(parametros)
    if (texto) novos.set('busca', texto)
    else novos.delete('busca')
    definirParametros(novos, { replace: true })
  }

  // A busca por nome, apelido ou CPF é feita aqui, na lista que já veio (são cerca de mil alunos).
  const texto = busca.trim().toLowerCase()
  const textoSoDigitos = texto.replace(/\D/g, '')
  const itens = (data?.itens ?? []).filter(
    (aluno) =>
      aluno.nome.toLowerCase().includes(texto) ||
      (aluno.apelido ?? '').toLowerCase().includes(texto) ||
      (textoSoDigitos !== '' && aluno.cpf.includes(textoSoDigitos)),
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
        <div className="campo">
          <label htmlFor="al-situacao">Situação</label>
          <select
            id="al-situacao"
            value={situacao}
            onChange={(evento) => mudarSituacao(evento.target.value as ListarAlunosSituacao)}
          >
            {Object.entries(ROTULO_DO_FILTRO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
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
            <caption className="sr-only">Alunos ({ROTULO_DO_FILTRO[situacao].toLowerCase()})</caption>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>E-mail</th>
                <th>Situação</th>
                <th className="numero">Em aberto</th>
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
                    {aluno.email || '—'}
                    {aluno.cadastroIncompleto && (
                      <span className="selo selo-alerta">
                        <Icone nome="alerta" />
                        {aluno.email ? 'CPF inválido' : 'Falta e-mail'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={aluno.ativo ? 'selo selo-paga' : 'selo'}>{aluno.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <ColunaEmAberto totais={totaisPorAluno.get(aluno.id)} />
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
          <RodapeDaTabela texto={`${itens.length} ${itens.length === 1 ? 'aluno' : 'alunos'}`} />
        </div>
      </EstadoDaConsulta>

      {novoAlunoAberto && <DialogoNovoAluno aoFechar={() => definirNovoAlunoAberto(false)} />}
    </>
  )
}

interface TotaisDoAluno {
  totalEmAbertoCentavos: number
  quantidadeVencidas: number
}

function ColunaEmAberto({ totais }: { totais: TotaisDoAluno | undefined }) {
  if (!totais) return <td className="numero">—</td>
  return (
    <td className="numero">
      {formatarMoeda(totais.totalEmAbertoCentavos)}
      {totais.quantidadeVencidas > 0 && (
        <span className="secundario">
          {totais.quantidadeVencidas === 1 ? '1 vencida' : `${totais.quantidadeVencidas} vencidas`}
        </span>
      )}
    </td>
  )
}

export default ListaDeAlunos

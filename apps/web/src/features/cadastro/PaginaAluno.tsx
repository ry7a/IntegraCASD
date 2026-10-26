import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  getBuscarAlunoQueryKey,
  getListarAlunosQueryKey,
  useAlterarAluno,
  useBuscarAluno,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import { Abas, PainelDaAba } from '@/compartilhado/componentes/Abas'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarCpf } from '@/compartilhado/formatacao'
import { useAbaDaUrl } from '@/compartilhado/hooks'
import CobrancasDoAluno from './CobrancasDoAluno'
import DadosDoAluno from './DadosDoAluno'
import DialogoInativarAluno from './DialogoInativarAluno'
import MovimentacoesDoAluno from './MovimentacoesDoAluno'

const ABAS = [
  { id: 'dados', titulo: 'Dados' },
  { id: 'cobrancas', titulo: 'Cobranças' },
  { id: 'movimentacoes', titulo: 'Movimentações' },
] as const

// Detalhe do aluno. [Cadastros.RF001]
function PaginaAluno() {
  const { id = '' } = useParams()
  const consulta = useBuscarAluno(id, { query: { retry: false } })
  const alterar = useAlterarAluno()
  const queryClient = useQueryClient()
  const [aba, mudarAba] = useAbaDaUrl(ABAS.map((a) => a.id), 'dados')
  const [inativarAberto, definirInativarAberto] = useState(false)
  const { abrirNovaCobranca } = useAcoesGlobais()

  const aluno = consulta.data

  // Reativar não precisa de confirmação: não tem efeito irreversível. A API confere se o CPF ou a vaga
  // foram para outro aluno ativo nesse meio-tempo e, se foram, a mensagem aparece no cabeçalho.
  async function reativar() {
    try {
      const reativado = await alterar.mutateAsync({ id, data: { ativo: true } })
      queryClient.setQueryData(getBuscarAlunoQueryKey(id), reativado)
      await queryClient.invalidateQueries({ queryKey: getListarAlunosQueryKey() })
    } catch {
      // Mensagem exibida abaixo do cabeçalho.
    }
  }

  return (
    <>
      <nav className="trilha-navegacao" aria-label="Você está em">
        <Link to="/cadastros">Cadastros</Link>
        <span aria-hidden="true">›</span>
        <Link to="/cadastros?aba=alunos">Alunos</Link>
        <span aria-hidden="true">›</span>
        <span>{aluno?.nome ?? 'Aluno'}</span>
      </nav>

      <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
        {aluno && (
          <>
            <div className="cabecalho-pagina">
              <div>
                <h1>
                  {aluno.nome}{' '}
                  <span className={aluno.ativo ? 'selo selo-paga' : 'selo'} style={{ verticalAlign: 'middle' }}>
                    {aluno.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </h1>
                <p>
                  CPF {formatarCpf(aluno.cpf)} · {aluno.email || 'sem e-mail cadastrado'}
                  {aluno.turma && ` · Turma ${aluno.turma}`}
                </p>
              </div>
              <div className="acoes">
                {aluno.ativo ? (
                  <button type="button" className="botao" onClick={() => definirInativarAberto(true)}>
                    <Icone nome="fechar" />
                    Inativar aluno
                  </button>
                ) : (
                  <button type="button" className="botao" disabled={alterar.isPending} onClick={() => void reativar()}>
                    <Icone nome="check" />
                    {alterar.isPending ? 'Reativando…' : 'Reativar aluno'}
                  </button>
                )}
                <button
                  type="button"
                  className="botao botao-principal"
                  disabled={!aluno.ativo || aluno.cadastroIncompleto}
                  title={aluno.cadastroIncompleto ? 'Complete CPF e e-mail para emitir cobranças.' : undefined}
                  onClick={() => abrirNovaCobranca(aluno.nome)}
                >
                  <Icone nome="mais" />
                  Nova cobrança
                </button>
              </div>
            </div>

            {aluno.cadastroIncompleto && (
              <div className="aviso aviso-perigo" role="status">
                <Icone nome="alerta" />
                <span>
                  <strong>Cadastro incompleto:</strong> sem e-mail ou com CPF inválido. Este aluno não recebe cobranças até
                  ser corrigido na aba Dados.
                </span>
              </div>
            )}
            {alterar.error && (
              <p className="erro-formulario" role="alert">
                {alterar.error.message}
              </p>
            )}

            <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Informações do aluno" />

            <PainelDaAba id={aba}>
              {aba === 'dados' && <DadosDoAluno aluno={aluno} />}
              {aba === 'cobrancas' && <CobrancasDoAluno alunoId={aluno.id} />}
              {aba === 'movimentacoes' && <MovimentacoesDoAluno alunoId={aluno.id} />}
            </PainelDaAba>

            {inativarAberto && <DialogoInativarAluno aoFechar={() => definirInativarAberto(false)} aluno={aluno} />}
          </>
        )}
      </EstadoDaConsulta>
    </>
  )
}

export default PaginaAluno

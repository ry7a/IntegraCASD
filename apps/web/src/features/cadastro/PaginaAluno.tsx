import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import { Abas, PainelDaAba } from '@/compartilhado/componentes/Abas'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarCpf } from '@/compartilhado/formatacao'
import { useAbaDaUrl } from '@/compartilhado/hooks'
import CobrancasDoAluno from './CobrancasDoAluno'
import { useBuscarAluno } from './consultas'
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
  const consulta = useBuscarAluno(id)
  const [aba, mudarAba] = useAbaDaUrl(ABAS.map((a) => a.id), 'dados')
  const [inativarAberto, definirInativarAberto] = useState(false)
  const { abrirNovaCobranca } = useAcoesGlobais()

  const aluno = consulta.data

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
                <button type="button" className="botao" onClick={() => definirInativarAberto(true)}>
                  <Icone nome="fechar" />
                  Inativar aluno
                </button>
                <button type="button" className="botao botao-principal" onClick={() => abrirNovaCobranca(aluno.nome)}>
                  <Icone nome="mais" />
                  Nova cobrança
                </button>
              </div>
            </div>

            <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Informações do aluno" />

            <PainelDaAba id={aba}>
              {aba === 'dados' && <DadosDoAluno aluno={aluno} />}
              {aba === 'cobrancas' && <CobrancasDoAluno alunoId={aluno.id} />}
              {aba === 'movimentacoes' && <MovimentacoesDoAluno alunoId={aluno.id} />}
            </PainelDaAba>

            <DialogoInativarAluno
              aberto={inativarAberto}
              aoFechar={() => definirInativarAberto(false)}
              aluno={aluno}
            />
          </>
        )}
      </EstadoDaConsulta>
    </>
  )
}

export default PaginaAluno

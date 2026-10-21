import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import Icone from '@/compartilhado/componentes/Icone'

// Ações rápidas em todas as telas: buscar aluno, nova movimentação e nova cobrança
// (a até três interações da página inicial, [Usabilidade.NF001]).
function BarraDoTopo() {
  const [busca, definirBusca] = useState('')
  const navegar = useNavigate()
  const { abrirNovaCobranca, abrirNovaMovimentacao } = useAcoesGlobais()

  // Decisão provisória (em aberto no README do protótipo): a busca leva à lista de alunos já filtrada.
  function buscarAluno(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const texto = busca.trim()
    navegar(texto ? `/cadastros?aba=alunos&busca=${encodeURIComponent(texto)}` : '/cadastros')
  }

  return (
    <header className="barra-topo">
      <form className="busca-global" role="search" onSubmit={buscarAluno}>
        <Icone nome="busca" />
        <input
          type="search"
          placeholder="Buscar aluno por nome ou CPF"
          aria-label="Buscar aluno por nome ou CPF"
          value={busca}
          onChange={(evento) => definirBusca(evento.target.value)}
        />
      </form>
      <div className="acoes-rapidas">
        <button type="button" className="botao" onClick={abrirNovaMovimentacao}>
          <Icone nome="mais" />
          Nova movimentação
        </button>
        <button type="button" className="botao botao-principal" onClick={() => abrirNovaCobranca()}>
          <Icone nome="mais" />
          Nova cobrança
        </button>
      </div>
    </header>
  )
}

export default BarraDoTopo

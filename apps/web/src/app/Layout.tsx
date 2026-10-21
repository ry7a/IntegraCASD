import { useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { AcoesGlobaisContexto, type AcoesGlobais } from '@/compartilhado/acoes-globais'
import DicaFlutuante from '@/compartilhado/componentes/DicaFlutuante'
import DialogoNovaCobranca from '@/features/cobrancas/DialogoNovaCobranca'
import DialogoNovaMovimentacao from '@/features/movimentacoes/DialogoNovaMovimentacao'
import BarraDoTopo from './BarraDoTopo'
import FaixaDeAmbiente from './FaixaDeAmbiente'
import MenuLateral from './MenuLateral'

// Estrutura comum a todas as telas: faixa de ambiente, menu lateral, barra do topo e o conteúdo da rota.
// Também guarda os dois diálogos da barra do topo, que podem ser abertos de qualquer tela.
function Layout() {
  const [cobrancaAberta, definirCobrancaAberta] = useState(false)
  const [alunoDaCobranca, definirAlunoDaCobranca] = useState('')
  const [movimentacaoAberta, definirMovimentacaoAberta] = useState(false)

  const acoes = useMemo<AcoesGlobais>(
    () => ({
      abrirNovaCobranca: (nomeDoAluno = '') => {
        definirAlunoDaCobranca(nomeDoAluno)
        definirCobrancaAberta(true)
      },
      abrirNovaMovimentacao: () => definirMovimentacaoAberta(true),
    }),
    [],
  )

  return (
    <AcoesGlobaisContexto.Provider value={acoes}>
      <FaixaDeAmbiente />
      <div className="app">
        <MenuLateral />
        <div className="conteudo">
          <BarraDoTopo />
          <main className="pagina">
            <Outlet />
          </main>
        </div>
      </div>

      <DialogoNovaCobranca
        aberto={cobrancaAberta}
        alunoInicial={alunoDaCobranca}
        aoFechar={() => definirCobrancaAberta(false)}
      />
      <DialogoNovaMovimentacao aberto={movimentacaoAberta} aoFechar={() => definirMovimentacaoAberta(false)} />
      <DicaFlutuante />
    </AcoesGlobaisContexto.Provider>
  )
}

export default Layout

import { CelulaDeOrigem } from '@/compartilhado/componentes/CelulasDeMovimentacao'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import { ROTULO_DA_FORMA } from '@/compartilhado/dominio'
import { formatarData, formatarMoedaComSinal } from '@/compartilhado/formatacao'
import { useListarMovimentacoesDoAluno } from './consultas'

// Aba "Movimentações" da tela do aluno: as entradas geradas pelas cobranças pagas dele.
function MovimentacoesDoAluno({ alunoId }: { alunoId: string }) {
  const consulta = useListarMovimentacoesDoAluno(alunoId)
  const itens = consulta.data?.itens ?? []

  return (
    <>
      <p className="texto-apoio" style={{ margin: '0 0 12px' }}>
        Entradas geradas pelas cobranças pagas deste aluno. Para corrigir uma delas, trate a cobrança em Cobranças.
      </p>
      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Este aluno ainda não tem movimentações."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Forma</th>
                <th>Origem</th>
                <th className="numero">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((movimentacao) => (
                <tr key={movimentacao.id}>
                  <td>{formatarData(movimentacao.data)}</td>
                  <td>
                    <span className="nome-principal">{movimentacao.descricao}</span>
                    <span className="secundario">Cobrança</span>
                  </td>
                  <td>{ROTULO_DA_FORMA[movimentacao.forma]}</td>
                  <td>
                    <CelulaDeOrigem movimentacao={movimentacao} />
                  </td>
                  <td className="numero">{formatarMoedaComSinal(movimentacao.tipo, movimentacao.valorCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>
    </>
  )
}

export default MovimentacoesDoAluno

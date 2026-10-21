import { Link } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import SeloDaCobranca from '@/compartilhado/componentes/SeloDaCobranca'
import { formatarData, formatarMoeda } from '@/compartilhado/formatacao'
import { useListarCobrancasDoAluno } from './consultas'

// Aba "Cobranças" da tela do aluno. Os dados são de Cobranças: a API os entrega em /alunos/:id/cobrancas.
function CobrancasDoAluno({ alunoId }: { alunoId: string }) {
  const consulta = useListarCobrancasDoAluno(alunoId)
  const dados = consulta.data

  return (
    <EstadoDaConsulta
      carregando={consulta.isPending}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      vazio={dados?.itens.length === 0}
      mensagemVazia="Este aluno ainda não tem cobranças."
    >
      {dados && (
        <>
          {dados.quantidadeVencidas > 0 && (
            <div className="alerta" role="status">
              <Icone nome="alerta" />
              <p>
                <strong>Total em aberto: {formatarMoeda(dados.totalEmAbertoCentavos)}.</strong> São{' '}
                {dados.quantidadeVencidas} cobranças vencidas. Abra uma cobrança para sincronizar, reenviar o boleto ou
                registrar pagamento.
              </p>
            </div>
          )}
          <div className="tabela-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="numero">Valor</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th className="numero">Atraso</th>
                  <th>
                    <span hidden>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((cobranca) => (
                  <tr key={cobranca.id}>
                    <td>
                      <Link className="nome-principal" to={`/cobrancas/${cobranca.id}`}>
                        {cobranca.descricao}
                      </Link>
                    </td>
                    <td className="numero">{formatarMoeda(cobranca.valorCentavos)}</td>
                    <td>{formatarData(cobranca.vencimento)}</td>
                    <td>
                      <SeloDaCobranca situacao={cobranca.situacao} />
                      {cobranca.situacao === 'PAGA' && cobranca.pagaEm && (
                        <span className="secundario">Conciliada em {formatarData(cobranca.pagaEm)}</span>
                      )}
                    </td>
                    <td className="numero">{cobranca.diasDeAtraso !== null ? `${cobranca.diasDeAtraso} dias` : '—'}</td>
                    <td className="acoes">
                      <Link className="botao botao-pequeno" to={`/cobrancas/${cobranca.id}`}>
                        <Icone nome="trilha" />
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rodape-tabela">
              <span>{dados.itens.length} cobranças</span>
              <span>
                Total em aberto: <strong style={{ color: 'var(--foreground)' }}>{formatarMoeda(dados.totalEmAbertoCentavos)}</strong>
              </span>
            </div>
          </div>
        </>
      )}
    </EstadoDaConsulta>
  )
}

export default CobrancasDoAluno

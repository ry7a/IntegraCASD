import { Link } from 'react-router'
import { useConsultarInadimplencia } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMoeda } from '@/compartilhado/formatacao'

// [Indicadores.RF002] Valores originais, sem multa e juros.
function BlocoDeInadimplencia() {
  const consulta = useConsultarInadimplencia()
  const dados = consulta.data

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h2>Inadimplência</h2>
          <p>Valores originais, sem multa e juros.</p>
        </div>
      </div>
      <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
        {dados && (
          <>
            <div className="grade grade-1-1" style={{ marginBottom: 8 }}>
              <div className="indicador">
                <div className="rotulo">Alunos inadimplentes</div>
                <div className="valor">{dados.alunosInadimplentes}</div>
              </div>
              <div className="indicador">
                <div className="rotulo">Valor em aberto</div>
                <div className="valor">{formatarMoeda(dados.valorEmAbertoCentavos)}</div>
              </div>
            </div>
            <p className="texto-apoio" style={{ margin: '0 0 4px' }}>
              Por tempo de atraso: até 30 dias, {dados.alunosPorFaixa.ate30Dias} alunos · 31 a 60 dias,{' '}
              {dados.alunosPorFaixa.de31a60Dias} · mais de 60 dias, {dados.alunosPorFaixa.acimaDe60Dias}
            </p>
            <h3 style={{ marginTop: 14 }}>Maiores devedores</h3>
            {dados.maioresDevedores.length === 0 ? (
              <p className="texto-apoio">Nenhum aluno com cobrança vencida.</p>
            ) : (
              <ul className="lista-linhas">
                {dados.maioresDevedores.map((devedor) => (
                  <li key={devedor.alunoId}>
                    <span>
                      <Link className="nome-principal" to={`/cadastros/alunos/${devedor.alunoId}`}>
                        {devedor.alunoNome}
                      </Link>
                      <span className="secundario">
                        {devedor.quantidade === 1
                          ? `1 cobrança · ${devedor.diasDeAtrasoMaisAntigo} dias de atraso`
                          : `${devedor.quantidade} cobranças · a mais antiga com ${devedor.diasDeAtrasoMaisAntigo} dias de atraso`}
                      </span>
                    </span>
                    <span className="numero">{formatarMoeda(devedor.valorCentavos)}</span>
                    {/* Fluxo A1: o boleto se obtém no detalhe da cobrança; o reenvio por e-mail depende da issue #29. */}
                    <Link
                      className="botao botao-pequeno botao-fantasma"
                      to={`/cadastros/alunos/${devedor.alunoId}?aba=cobrancas`}
                      aria-label={`Ver as cobranças de ${devedor.alunoNome} para obter o boleto`}
                      data-dica="Ver as cobranças e obter o boleto"
                    >
                      <Icone nome="baixar" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className="botao botao-pequeno" to="/cobrancas?situacoes=VENCIDA" style={{ marginTop: 10 }}>
              Ver todas as cobranças vencidas
            </Link>
          </>
        )}
      </EstadoDaConsulta>
    </div>
  )
}

export default BlocoDeInadimplencia

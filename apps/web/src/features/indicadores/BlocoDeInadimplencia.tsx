import { Link } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMoeda } from '@/compartilhado/formatacao'
import { useInadimplencia } from './consultas'

// [Indicadores.RF002] Valores originais, sem multa e juros.
function BlocoDeInadimplencia() {
  const consulta = useInadimplencia()
  const dados = consulta.data

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h2>Inadimplência</h2>
          <p>Valores originais, sem multa e juros. [Indicadores.RF002]</p>
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
                    {/* TODO [Cobranças.RF005]: reenviar o boleto da cobrança vencida (POST na cobrança). */}
                    <button
                      type="button"
                      className="botao botao-pequeno botao-fantasma"
                      aria-label={`Reenviar boleto da cobrança vencida de ${devedor.alunoNome} por e-mail`}
                      data-dica="Reenviar boleto da cobrança vencida por e-mail"
                    >
                      <Icone nome="email" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link className="botao botao-pequeno" to="/cobrancas" style={{ marginTop: 10 }}>
              Ver todas as cobranças vencidas
            </Link>
          </>
        )}
      </EstadoDaConsulta>
    </div>
  )
}

export default BlocoDeInadimplencia

import { Link } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarDataHora, formatarHora, formatarMoeda } from '@/compartilhado/formatacao'
import { useBuscarParametrosDeCobranca } from './consultas'
import type { ParametrosCobrancaDto } from './contrato'

// Parâmetros das cobranças recorrentes. [Administração.RF003]
function AbaParametros() {
  const consulta = useBuscarParametrosDeCobranca()
  const parametros = consulta.data

  return (
    <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
      {parametros && (
        <div className="grade grade-2-1">
          <FormularioDeParametros parametros={parametros} />
          <ConferenciaDosParametros parametros={parametros} />
        </div>
      )}
    </EstadoDaConsulta>
  )
}

function FormularioDeParametros({ parametros }: { parametros: ParametrosCobrancaDto }) {
  // TODO [Administração.RF003]: PUT /api/administracao/parametros-cobranca (React Hook Form + Zod). Por enquanto
  // os campos só mostram os valores atuais.
  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h2>Mensalidade</h2>
          <p>
            Última alteração em {formatarData(parametros.alteradoEm)} por {parametros.alteradoPor}
          </p>
        </div>
      </div>
      <div className="formulario">
        <div className="campo">
          <label htmlFor="pa-valor">Valor da mensalidade</label>
          <input id="pa-valor" defaultValue={formatarMoeda(parametros.valorMensalidadeCentavos)} />
        </div>
        <div className="campo">
          <label htmlFor="pa-vencimento">Dia de vencimento</label>
          <input id="pa-vencimento" type="number" min={1} max={28} defaultValue={parametros.diaVencimento} />
        </div>
        <div className="campo">
          <label htmlFor="pa-geracao">Dia de geração</label>
          <input id="pa-geracao" type="number" min={1} max={28} defaultValue={parametros.diaGeracao} />
          <span className="dica">Precisa ser antes do dia de vencimento.</span>
        </div>
        <div className="campo"></div>
        <div className="campo">
          <label htmlFor="pa-multa">Multa por atraso</label>
          <input id="pa-multa" defaultValue={`${parametros.multaPercentual}%`} />
        </div>
        <div className="campo">
          <label htmlFor="pa-juros">Juros ao mês</label>
          <input id="pa-juros" defaultValue={`${parametros.jurosMensalPercentual}%`} />
          <span className="dica">Multa e juros são calculados pelo Asaas no pagamento.</span>
        </div>
      </div>
      <div className="aviso" style={{ marginTop: 16 }}>
        <Icone nome="alerta" />
        <span>
          Um novo valor vale só para as próximas cobranças. As já emitidas, inclusive as vencidas, mantêm o valor
          anterior.
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="botao botao-principal">
          Salvar parâmetros
        </button>
      </div>
    </div>
  )
}

function ConferenciaDosParametros({ parametros }: { parametros: ParametrosCobrancaDto }) {
  const { conferencia, ultimasExecucoes } = parametros
  return (
    <div className="cartao">
      <h2>Conferência</h2>
      <ul className="lista-linhas" style={{ marginTop: 8 }}>
        <li>
          <span>Próxima geração</span>
          <span className="numero">{formatarData(conferencia.proximaGeracao)}</span>
        </li>
        <li>
          <span>Vencimento</span>
          <span className="numero">{formatarData(conferencia.proximoVencimento)}</span>
        </li>
        <li>
          <span>Alunos que serão cobrados</span>
          <span className="numero">{conferencia.alunosCobrados.toLocaleString('pt-BR')}</span>
        </li>
        <li>
          <span>Total previsto</span>
          <span className="numero">{formatarMoeda(conferencia.totalPrevistoCentavos)}</span>
        </li>
      </ul>
      <h3 style={{ marginTop: 18 }}>Últimas execuções</h3>
      {ultimasExecucoes.length === 0 ? (
        <p className="texto-apoio">Nenhuma execução registrada.</p>
      ) : (
        <ul className="lista-linhas">
          {ultimasExecucoes.map((execucao) => (
            <li key={execucao.id}>
              <span>
                {formatarDataHora(execucao.iniciadaEm).replace(' ', ' · ')}
                {execucao.finalizadaEm && ` a ${formatarHora(execucao.finalizadaEm)}`}
                <span className="secundario">
                  {execucao.totalProcessado} criadas ·{' '}
                  {execucao.totalFalhas === 0
                    ? 'nenhuma falha'
                    : `${execucao.totalFalhas} falharam${execucao.motivoFalhas ? ` por ${execucao.motivoFalhas}` : ''}`}
                </span>
              </span>
              {execucao.totalFalhas > 0 ? (
                <Link className="botao botao-pequeno" to="/cadastros">
                  Ver falhas
                </Link>
              ) : (
                <span className="selo selo-paga">
                  <Icone nome="check" />
                  Concluída
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AbaParametros

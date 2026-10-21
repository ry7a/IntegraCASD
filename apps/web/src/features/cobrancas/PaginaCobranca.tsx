import { useState } from 'react'
import { Link, useParams } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import SeloDaCobranca from '@/compartilhado/componentes/SeloDaCobranca'
import { formatarData, formatarDataHora, formatarMoeda } from '@/compartilhado/formatacao'
import { useBuscarCobranca } from './consultas'
import { DialogosDaCobranca, type DialogoDaCobranca } from './DialogosDaCobranca'

// Detalhe da cobrança: o centro das ações (boleto, reenvio, sincronização, pagamento manual, cancelar).
// [Cobranças.RF003 a RF008] Todas as ações abaixo ainda não têm efeito: só abrem os diálogos.
function PaginaCobranca() {
  const { id = '' } = useParams()
  const consulta = useBuscarCobranca(id)
  const [dialogo, definirDialogo] = useState<DialogoDaCobranca | null>(null)
  const cobranca = consulta.data

  return (
    <>
      <nav className="trilha-navegacao" aria-label="Você está em">
        <Link to="/cobrancas">Cobranças</Link>
        <span aria-hidden="true">›</span>
        <span>{cobranca ? `${cobranca.descricao} · ${cobranca.alunoNome}` : 'Cobrança'}</span>
      </nav>

      <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
        {cobranca && (
          <>
            <div className="cabecalho-pagina">
              <div>
                <h1>{cobranca.descricao}</h1>
                <p>Detalhe da cobrança: daqui saem todas as ações sobre ela.</p>
              </div>
              <div className="acoes">
                <Link className="botao" to="/cobrancas">
                  <Icone nome="voltar" />
                  Voltar para a lista
                </Link>
              </div>
            </div>

            <section className="cartao" style={{ marginBottom: 16 }} aria-labelledby="titulo-acoes">
              <div className="cartao-cabecalho">
                <div>
                  <h2 id="titulo-acoes">Ações</h2>
                  <p>Sincronize antes de cobrar o aluno ou registrar pagamento: o pagamento pode já estar no Asaas.</p>
                </div>
              </div>
              <div className="bloco-acoes">
                <button type="button" className="botao botao-principal" onClick={() => definirDialogo('sincronizar')}>
                  <Icone nome="sincronizar" />
                  Sincronizar esta cobrança
                </button>
                {/* TODO [Cobranças.RF005]: baixar o boleto e reenviar por e-mail. */}
                <button type="button" className="botao">
                  <Icone nome="baixar" />
                  Baixar boleto
                </button>
                <button type="button" className="botao">
                  <Icone nome="email" />
                  Reenviar boleto por e-mail
                </button>
                <button
                  type="button"
                  className="botao"
                  disabled={!cobranca.podeRegistrarPagamentoManual}
                  onClick={() => definirDialogo('pagamento-manual')}
                >
                  <Icone nome="editar" />
                  Registrar pagamento manualmente
                </button>
                <button
                  type="button"
                  className="botao separador"
                  disabled={!cobranca.podeCancelar}
                  onClick={() => definirDialogo('cancelar')}
                >
                  <Icone nome="fechar" />
                  Cancelar / renegociar
                </button>
              </div>
            </section>

            <div className="grade grade-2-1">
              <section className="cartao" aria-labelledby="titulo-dados">
                <div className="cartao-cabecalho">
                  <h2 id="titulo-dados">Dados da cobrança</h2>
                  <SeloDaCobranca situacao={cobranca.situacao} />
                </div>
                <dl className="dados-lista">
                  <dt>Aluno</dt>
                  <dd>
                    <Link to={`/cadastros/alunos/${cobranca.alunoId}`}>{cobranca.alunoNome}</Link>
                  </dd>
                  <dt>Descrição</dt>
                  <dd>{cobranca.descricao}</dd>
                  <dt>Valor original</dt>
                  <dd>{formatarMoeda(cobranca.valorCentavos)}</dd>
                  <dt>Vencimento</dt>
                  <dd>{formatarData(cobranca.vencimento)}</dd>
                  {cobranca.diasDeAtraso !== null && (
                    <>
                      <dt>Atraso</dt>
                      <dd>{cobranca.diasDeAtraso} dias</dd>
                    </>
                  )}
                  {cobranca.pagaEm && (
                    <>
                      <dt>Pagamento</dt>
                      <dd>{formatarDataHora(cobranca.pagaEm)}</dd>
                    </>
                  )}
                  {cobranca.justificativaManual && (
                    <>
                      <dt>Justificativa do registro manual</dt>
                      <dd>{cobranca.justificativaManual}</dd>
                    </>
                  )}
                  <dt>Identificação no Asaas</dt>
                  <dd>{cobranca.asaasId ?? '—'}</dd>
                </dl>
                <div className="aviso" style={{ marginTop: 16 }}>
                  <Icone nome="relogio" />
                  <span>
                    Multa de 2% e juros de 1% ao mês são aplicados pelo Asaas no boleto. O IntegraCASD mostra sempre o{' '}
                    <strong>valor original</strong>, sem multa e juros.
                  </span>
                </div>
              </section>

              <section className="cartao" aria-labelledby="titulo-sincronizacao">
                <div className="cartao-cabecalho">
                  <h2 id="titulo-sincronizacao">Sincronização com o Asaas</h2>
                </div>
                <p style={{ margin: '0 0 12px' }}>
                  Última sincronização desta cobrança:{' '}
                  {cobranca.ultimaSincronizacaoEm ? (
                    <strong>
                      {formatarData(cobranca.ultimaSincronizacaoEm)}, há {cobranca.diasDesdeUltimaSincronizacao} dias
                    </strong>
                  ) : (
                    <strong>nunca sincronizada</strong>
                  )}
                  .
                </p>
                {cobranca.sincronizacaoAntiga && (
                  <div className="alerta" role="status" style={{ marginBottom: 0 }}>
                    <Icone nome="alerta" />
                    <p>
                      Sincronização antiga. O aluno pode ter pago e a notificação não ter chegado. Sincronize antes de
                      cobrar.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <section className="cartao" aria-labelledby="titulo-historico" style={{ marginTop: 16 }}>
              <div className="cartao-cabecalho">
                <div>
                  <h2 id="titulo-historico">Histórico de eventos do Asaas</h2>
                  <p>Do mais recente para o mais antigo.</p>
                </div>
              </div>
              <ol className="linha-tempo">
                {cobranca.eventos.map((evento) => (
                  <li key={evento.id}>
                    <time dateTime={evento.ocorridoEm}>{formatarDataHora(evento.ocorridoEm)}</time>
                    <span>{evento.descricao}</span>
                    <span className="selo">{evento.origem === 'ASAAS' ? 'Asaas' : 'Usuário'}</span>
                  </li>
                ))}
              </ol>
            </section>

            <DialogosDaCobranca cobranca={cobranca} aberto={dialogo} aoFechar={() => definirDialogo(null)} aoTrocar={definirDialogo} />
          </>
        )}
      </EstadoDaConsulta>
    </>
  )
}

export default PaginaCobranca

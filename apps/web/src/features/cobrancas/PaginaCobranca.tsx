import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getBuscarCobrancaQueryKey, useBuscarCobranca, useObterBoleto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import SeloDaCobranca from '@/compartilhado/componentes/SeloDaCobranca'
import { MARCA_DA_ORIGEM } from '@/compartilhado/dominio'
import { formatarData, formatarDataHora, formatarMoeda } from '@/compartilhado/formatacao'
import { useUsuarioAtual } from '@/compartilhado/use-usuario-atual'
import { DialogosDaCobranca, type DialogoDaCobranca } from './DialogosDaCobranca'

// Detalhe da cobrança: o centro das ações (boleto, reenvio, sincronização, pagamento manual, cancelar).
// [Cobranças.RF003 a RF008] Os dados vêm da API; as ações (sincronizar, cancelar, pagamento manual) ainda
// só abrem os diálogos: entram com as suas issues.
function PaginaCobranca() {
  const { id = '' } = useParams()
  const usuario = useUsuarioAtual()
  const consulta = useBuscarCobranca(id, { query: { retry: false } })
  const [dialogo, definirDialogo] = useState<DialogoDaCobranca | null>(null)
  const cobranca = consulta.data
  const boleto = useObterBoleto()
  const queryClient = useQueryClient()

  // [Cobranças.RF003] A API devolve o link e registra no histórico quem obteve o boleto.
  async function obterBoleto() {
    try {
      await boleto.mutateAsync({ id })
      await queryClient.invalidateQueries({ queryKey: getBuscarCobrancaQueryKey(id) })
    } catch {
      // Mensagem da API (ex.: cobrança já paga) abaixo das ações.
    }
  }

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
                  {cobranca.existeNoAsaas ? (
                    <p>Sincronize antes de cobrar o aluno ou registrar pagamento: o pagamento pode já estar no Asaas.</p>
                  ) : (
                    <p>
                      Débito herdado da planilha: não existe no Asaas e não tem boleto. Se o aluno já pagou, registre o
                      pagamento; para cobrar com boleto, cancele e renegocie.
                    </p>
                  )}
                </div>
              </div>
              <div className="bloco-acoes">
                {/* A herdada (ADR-0005) não existe no Asaas: sem sincronização nem boleto. A API também recusa. */}
                {cobranca.existeNoAsaas && (
                  <>
                    <button type="button" className="botao botao-principal" onClick={() => definirDialogo('sincronizar')}>
                      <Icone nome="sincronizar" />
                      Sincronizar esta cobrança
                    </button>
                    {boleto.data ? (
                      <a className="botao" href={boleto.data.url} target="_blank" rel="noreferrer">
                        <Icone nome="baixar" />
                        Abrir o boleto
                      </a>
                    ) : (
                      <button type="button" className="botao" disabled={boleto.isPending} onClick={() => void obterBoleto()}>
                        <Icone nome="baixar" />
                        {boleto.isPending ? 'Obtendo…' : 'Baixar boleto'}
                      </button>
                    )}
                    {/* TODO [Cobranças.RF003]: o Asaas não oferece reenvio da notificação pela API (issue #29). */}
                    <button
                      type="button"
                      className="botao"
                      disabled
                      data-dica="O Asaas não permite reenviar o e-mail pela integração. Baixe o boleto e envie ao aluno."
                    >
                      <Icone nome="email" />
                      Reenviar boleto por e-mail
                    </button>
                  </>
                )}
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
              {boleto.error && (
                <p className="erro-formulario" role="alert">
                  {boleto.error.message}
                </p>
              )}
            </section>

            <div className="grade grade-2-1">
              <section className="cartao" aria-labelledby="titulo-dados">
                <div className="cartao-cabecalho">
                  <h2 id="titulo-dados">Dados da cobrança</h2>
                  <div className="acoes">
                    {MARCA_DA_ORIGEM[cobranca.origem] && <span className="selo">{MARCA_DA_ORIGEM[cobranca.origem]}</span>}
                    <SeloDaCobranca situacao={cobranca.situacao} />
                  </div>
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
                      <dd>{formatarData(cobranca.pagaEm)}</dd>
                    </>
                  )}
                  {cobranca.justificativaManual && (
                    <>
                      <dt>Justificativa do registro manual</dt>
                      <dd>{cobranca.justificativaManual}</dd>
                    </>
                  )}
                  <dt>Identificação no Asaas</dt>
                  <dd>{cobranca.existeNoAsaas ? (cobranca.asaasId ?? '—') : 'Nenhuma: herdada da planilha'}</dd>
                  {cobranca.canceladaEm && (
                    <>
                      <dt>Cancelamento</dt>
                      <dd>
                        {formatarDataHora(cobranca.canceladaEm)}: {cobranca.motivoCancelamento}
                      </dd>
                    </>
                  )}
                  {cobranca.renegociacaoDeId && (
                    <>
                      <dt>Renegociação</dt>
                      <dd>
                        Substitui a <Link to={`/cobrancas/${cobranca.renegociacaoDeId}`}>cobrança cancelada</Link>
                      </dd>
                    </>
                  )}
                  {cobranca.renegociadaPorId && (
                    <>
                      <dt>Renegociada</dt>
                      <dd>
                        Substituída pela <Link to={`/cobrancas/${cobranca.renegociadaPorId}`}>nova cobrança</Link>
                      </dd>
                    </>
                  )}
                </dl>
                <div className="aviso" style={{ marginTop: 16 }}>
                  <Icone nome="relogio" />
                  {cobranca.existeNoAsaas ? (
                    <span>
                      Multa de {cobranca.multaPercentual}% e juros de {cobranca.jurosMensalPercentual}% ao mês são aplicados
                      pelo Asaas no boleto. O IntegraCASD mostra sempre o <strong>valor original</strong>, sem multa e juros.
                    </span>
                  ) : (
                    <span>
                      Valor e vencimento como estavam na planilha, sem multa e juros. Na renegociação, a nova cobrança
                      segue os parâmetros de cobrança atuais.
                    </span>
                  )}
                </div>
              </section>

              <section className="cartao" aria-labelledby="titulo-sincronizacao">
                <div className="cartao-cabecalho">
                  <h2 id="titulo-sincronizacao">Sincronização com o Asaas</h2>
                </div>
                {cobranca.existeNoAsaas ? (
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
                ) : (
                  <p style={{ margin: 0 }}>Esta cobrança veio da planilha e não existe no Asaas: não há o que sincronizar.</p>
                )}
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
                {/* [Administração.RF005] fluxo A1: a trilha só da cobrança. A trilha é da diretoria. */}
                {usuario.perfil === 'DIRETORIA' && (
                  <Link className="botao botao-pequeno" to={`/administracao?aba=trilha&registroId=${cobranca.id}`}>
                    <Icone nome="trilha" />
                    Ver na trilha de auditoria
                  </Link>
                )}
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

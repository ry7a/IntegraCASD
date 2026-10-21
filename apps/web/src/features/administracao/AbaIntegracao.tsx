import { useState } from 'react'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarDataHora, haQuantoTempo } from '@/compartilhado/formatacao'
import { useBuscarIntegracaoComOAsaas } from './consultas'

// Integração com o Asaas. [Administração.RF004]
// A chave de acesso nunca é exibida: a API só informa quando ela foi cadastrada.
function AbaIntegracao() {
  const consulta = useBuscarIntegracaoComOAsaas()
  const [chaveAberta, definirChaveAberta] = useState(false)
  const integracao = consulta.data

  async function copiarEndereco(endereco: string) {
    try {
      await navigator.clipboard.writeText(endereco)
    } catch {
      // Sem permissão para copiar (ex.: página sem HTTPS): o usuário ainda pode selecionar o texto.
    }
  }

  return (
    <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
      {integracao && (
        <div className="grade grade-1-1">
          <div className="cartao">
            <div className="cartao-cabecalho">
              <div>
                <h2>Situação da integração</h2>
                <p>
                  {integracao.ultimoTesteEm
                    ? `Testada pela última vez em ${formatarDataHora(integracao.ultimoTesteEm).replace(' ', ' às ')}`
                    : 'Ainda não testada'}
                </p>
              </div>
              {integracao.conectada ? (
                <span className="selo selo-paga">
                  <Icone nome="check" />
                  Conectada
                </span>
              ) : (
                <span className="selo selo-vencida">
                  <Icone nome="alerta" />
                  Desconectada
                </span>
              )}
            </div>
            <ul className="lista-linhas">
              <li>
                <span>Ambiente</span>
                {integracao.ambiente === 'SANDBOX' ? (
                  <span className="selo selo-alerta">
                    <Icone nome="alerta" />
                    Testes (sandbox)
                  </span>
                ) : (
                  <span className="selo selo-paga">Produção</span>
                )}
              </li>
              <li>
                <span>Última notificação recebida</span>
                <span className="numero">
                  {integracao.ultimaNotificacaoEm ? haQuantoTempo(integracao.ultimaNotificacaoEm) : 'nenhuma ainda'}
                </span>
              </li>
              <li>
                <span>Falhas de entrega seguidas</span>
                <span className="numero">
                  {integracao.falhasSeguidas} de {integracao.limiteFalhas}
                </span>
              </li>
              <li>
                <span>
                  Chave de acesso
                  <span className="secundario">
                    {integracao.chaveCadastradaEm ? `Cadastrada em ${formatarData(integracao.chaveCadastradaEm)}. ` : ''}
                    Por segurança, nunca é exibida.
                  </span>
                </span>
                <button type="button" className="botao botao-pequeno" onClick={() => definirChaveAberta(true)}>
                  <Icone nome="cadeado" />
                  Substituir chave
                </button>
              </li>
            </ul>
          </div>
          <div className="cartao">
            <h2>Endereço de notificação</h2>
            <p className="texto-apoio" style={{ margin: '4px 0 12px' }}>
              Cadastre este endereço no painel do Asaas, em Integrações › Webhooks.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={integracao.enderecoNotificacao} aria-label="Endereço de notificação" />
              <button
                type="button"
                className="botao"
                aria-label="Copiar endereço"
                data-dica="Copiar endereço"
                onClick={() => void copiarEndereco(integracao.enderecoNotificacao)}
              >
                <Icone nome="copiar" />
              </button>
            </div>
            <div className="campo" style={{ marginTop: 18 }}>
              <label htmlFor="in-alerta">Alertar a diretoria se ficar sem notificações por</label>
              {/* TODO [Administração.RF004]: salvar o tempo de alerta. */}
              <select id="in-alerta" defaultValue={integracao.horasAlertaSemNotificacao}>
                <option value={12}>12 horas</option>
                <option value={24}>24 horas</option>
                <option value={48}>48 horas</option>
              </select>
              <span className="dica">No máximo 48 horas. Depois de 14 dias o Asaas descarta os eventos não entregues.</span>
            </div>
          </div>
        </div>
      )}

      <Dialogo
        aberto={chaveAberta}
        aoFechar={() => definirChaveAberta(false)}
        titulo="Substituir chave do Asaas"
        descricao="O sistema testa a nova chave antes de salvar. Se o teste falhar, a chave atual continua valendo."
        // TODO [Administração.RF004]: PUT /api/administracao/integracao-asaas/chave. A chave vai cifrada para o
        // banco e nunca aparece em tela, resposta, log nem trilha de auditoria.
        rodape={
          <>
            <button type="button" className="botao" onClick={() => definirChaveAberta(false)}>
              Cancelar
            </button>
            <button type="submit" className="botao botao-principal">
              Testar e salvar
            </button>
          </>
        }
      >
        <div className="campo">
          <label htmlFor="ch-chave">Nova chave de acesso</label>
          <input id="ch-chave" type="password" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="ch-ambiente">Ambiente</label>
          <select id="ch-ambiente">
            <option>Testes (sandbox)</option>
            <option>Produção</option>
          </select>
          <span className="dica">Em testes, uma faixa no topo avisa que as cobranças não são reais.</span>
        </div>
      </Dialogo>
    </EstadoDaConsulta>
  )
}

export default AbaIntegracao

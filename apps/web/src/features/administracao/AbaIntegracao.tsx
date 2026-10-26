import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  getBuscarAmbienteDaIntegracaoQueryKey,
  getBuscarIntegracaoAsaasQueryKey,
  useAlterarPrazoDoAlertaAsaas,
  useBuscarIntegracaoAsaas,
  useSubstituirChaveAsaas,
  PrazoDoAlertaHoras,
  type IntegracaoAsaasDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarDataHora } from '@/compartilhado/formatacao'

// Endereço que o Asaas chama a cada pagamento. É o mesmo servidor que entrega esta tela.
const ENDERECO_DE_NOTIFICACAO = `${window.location.origin}/api/webhooks/asaas`

// Integração com o Asaas. [Administração.RF004]
// A chave de acesso nunca é exibida: a API só informa quando ela foi cadastrada e por quem.
function AbaIntegracao() {
  const consulta = useBuscarIntegracaoAsaas()
  const [chaveAberta, definirChaveAberta] = useState(false)
  const integracao = consulta.data

  async function copiarEndereco() {
    try {
      await navigator.clipboard.writeText(ENDERECO_DE_NOTIFICACAO)
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
                    ? `Chave testada em ${formatarDataHora(integracao.ultimoTesteEm).replace(' ', ' às ')}`
                    : 'Nenhuma chave cadastrada nesta tela'}
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
                <SeloDoAmbiente ambiente={integracao.ambiente} />
              </li>
              <li>
                <span>
                  Chave de acesso
                  <span className="secundario">{descreverChave(integracao)} Por segurança, nunca é exibida.</span>
                </span>
                <button type="button" className="botao botao-pequeno" onClick={() => definirChaveAberta(true)}>
                  <Icone nome="cadeado" />
                  {integracao.origemDaChave === 'TELA' ? 'Substituir chave' : 'Cadastrar chave'}
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
              <input readOnly value={ENDERECO_DE_NOTIFICACAO} aria-label="Endereço de notificação" />
              <button
                type="button"
                className="botao"
                aria-label="Copiar endereço"
                data-dica="Copiar endereço"
                onClick={() => void copiarEndereco()}
              >
                <Icone nome="copiar" />
              </button>
            </div>
            <PrazoDoAlerta integracao={integracao} />
          </div>
        </div>
      )}

      {/* Montado só enquanto aberto: cada abertura começa com o formulário limpo. */}
      {chaveAberta && integracao && (
        <DialogoSubstituirChave ambienteAtual={integracao.ambiente} aoFechar={() => definirChaveAberta(false)} />
      )}
    </EstadoDaConsulta>
  )
}

function descreverChave(integracao: IntegracaoAsaasDto): string {
  if (integracao.origemDaChave === 'TELA' && integracao.chaveCadastradaEm) {
    return `Cadastrada em ${formatarData(integracao.chaveCadastradaEm)} por ${integracao.alteradoPor ?? '—'}.`
  }
  if (integracao.origemDaChave === 'ARQUIVO_ENV') {
    return 'Lida do arquivo de configuração do servidor (desenvolvimento). Cadastre aqui para valer em produção.'
  }
  return 'Nenhuma chave: as cobranças não podem ser emitidas.'
}

function SeloDoAmbiente({ ambiente }: { ambiente: IntegracaoAsaasDto['ambiente'] }) {
  if (ambiente === 'SANDBOX') {
    return (
      <span className="selo selo-alerta">
        <Icone nome="alerta" />
        Testes (sandbox)
      </span>
    )
  }
  if (ambiente === 'PRODUCAO') return <span className="selo selo-paga">Produção</span>
  return <span className="secundario">—</span>
}

// Fluxo A2: o prazo é salvo assim que escolhido. Só existe depois de haver chave cadastrada na tela.
function PrazoDoAlerta({ integracao }: { integracao: IntegracaoAsaasDto }) {
  const alterar = useAlterarPrazoDoAlertaAsaas()
  const queryClient = useQueryClient()
  const semChaveNaTela = integracao.origemDaChave !== 'TELA'

  async function salvar(valor: string) {
    // O <select> devolve texto; só os prazos que a API aceita (12, 24 ou 48) seguem adiante.
    const prazoAlertaHoras = Object.values(PrazoDoAlertaHoras).find((prazo) => String(prazo) === valor)
    if (prazoAlertaHoras === undefined) return
    try {
      await alterar.mutateAsync({ data: { prazoAlertaHoras } })
      await queryClient.invalidateQueries({ queryKey: getBuscarIntegracaoAsaasQueryKey() })
    } catch {
      // A mensagem da API aparece abaixo do campo.
    }
  }

  return (
    <div className="campo" style={{ marginTop: 18 }}>
      <label htmlFor="in-alerta">Alertar a diretoria se ficar sem notificações por</label>
      <select
        id="in-alerta"
        value={integracao.prazoAlertaHoras}
        disabled={semChaveNaTela || alterar.isPending}
        onChange={(evento) => void salvar(evento.target.value)}
      >
        <option value={12}>12 horas</option>
        <option value={24}>24 horas</option>
        <option value={48}>48 horas</option>
      </select>
      <span className="dica" role={alterar.error ? 'alert' : undefined}>
        {alterar.error?.message ??
          (semChaveNaTela
            ? 'Disponível depois de cadastrar a chave nesta tela.'
            : 'No máximo 48 horas. Depois de 14 dias o Asaas descarta os eventos não entregues.')}
      </span>
    </div>
  )
}

// Validação só para retorno rápido; quem decide é a API, que testa a chave no Asaas antes de salvar.
const esquema = z.object({
  chave: z.string().trim().min(20, 'Cole a chave completa, como aparece no painel do Asaas.'),
  ambiente: z.enum(['SANDBOX', 'PRODUCAO']),
})
type Formulario = z.infer<typeof esquema>

interface PropsDoDialogo {
  ambienteAtual: IntegracaoAsaasDto['ambiente']
  aoFechar: () => void
}

function DialogoSubstituirChave({ ambienteAtual, aoFechar }: PropsDoDialogo) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { chave: '', ambiente: ambienteAtual ?? 'SANDBOX' },
  })
  const substituir = useSubstituirChaveAsaas()
  const queryClient = useQueryClient()
  const erros = formState.errors

  async function testarESalvar(formulario: Formulario) {
    try {
      await substituir.mutateAsync({ data: formulario })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getBuscarIntegracaoAsaasQueryKey() }),
        // A faixa "ambiente de testes" muda junto.
        queryClient.invalidateQueries({ queryKey: getBuscarAmbienteDaIntegracaoQueryKey() }),
      ])
      aoFechar()
    } catch {
      // A mensagem da API (ex.: chave recusada) aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Substituir chave do Asaas"
      descricao="O sistema testa a nova chave antes de salvar. Se o teste falhar, a chave atual continua valendo."
      aoEnviar={(evento) => void handleSubmit(testarESalvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={substituir.isPending}>
            {substituir.isPending ? 'Testando…' : 'Testar e salvar'}
          </button>
        </>
      }
    >
      <div className="campo">
        <label htmlFor="ch-chave">Nova chave de acesso</label>
        <input id="ch-chave" type="password" autoComplete="off" aria-invalid={!!erros.chave} {...register('chave')} />
        {erros.chave && (
          <span className="dica" role="alert">
            {erros.chave.message}
          </span>
        )}
      </div>
      <div className="campo">
        <label htmlFor="ch-ambiente">Ambiente</label>
        <select id="ch-ambiente" {...register('ambiente')}>
          <option value="SANDBOX">Testes (sandbox)</option>
          <option value="PRODUCAO">Produção</option>
        </select>
        <span className="dica">Em testes, uma faixa no topo avisa que as cobranças não são reais.</span>
      </div>
      {substituir.error && (
        <p className="erro-formulario" role="alert">
          {substituir.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default AbaIntegracao

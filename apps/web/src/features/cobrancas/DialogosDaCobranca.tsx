import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda, formatarValorParaCampo, hojeIso, paraCentavos } from '@/compartilhado/formatacao'
import {
  getBuscarCobrancaQueryKey,
  useCancelarCobranca,
  useRegistrarPagamentoManual,
  useSincronizarCobranca,
  type CobrancaDetalheDto,
  type FormaDePagamentoManual,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'

export type DialogoDaCobranca = 'sincronizar' | 'cancelar' | 'pagamento-manual'

interface Props {
  cobranca: CobrancaDetalheDto
  aberto: DialogoDaCobranca | null
  aoFechar: () => void
  aoTrocar: (dialogo: DialogoDaCobranca) => void
}

// Os três diálogos da tela de detalhe. Os que mudam dados passam por confirmação com o resumo do
// efeito ([Usabilidade.NF003]).
export function DialogosDaCobranca({ cobranca, aberto, aoFechar, aoTrocar }: Props) {
  const resumoDaCobranca = `${cobranca.descricao} · ${formatarMoeda(cobranca.valorCentavos)}`
  const dias = cobranca.diasDesdeUltimaSincronizacao
  const textoDaUltimaSincronizacao = cobranca.ultimaSincronizacaoEm
    ? `${formatarData(cobranca.ultimaSincronizacaoEm)} (${dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`})`
    : 'nunca sincronizada'

  return (
    <>
      {/* Sincronizar só esta cobrança [Cobranças.RF007] fluxo A1 */}
      {aberto === 'sincronizar' && (
        <DialogoDeSincronizacao cobranca={cobranca} aoFechar={aoFechar} textoDaUltimaSincronizacao={textoDaUltimaSincronizacao} />
      )}

      {/* Cancelar cobrança [Cobranças.RF004]: operação irreversível */}
      {aberto === 'cancelar' && (
        <DialogoDeCancelamento cobranca={cobranca} aoFechar={aoFechar} resumoDaCobranca={resumoDaCobranca} />
      )}

      {aberto === 'pagamento-manual' && (
        <DialogoDePagamentoManual
          cobranca={cobranca}
          aoFechar={aoFechar}
          aoSincronizarPrimeiro={() => aoTrocar('sincronizar')}
          resumoDaCobranca={resumoDaCobranca}
          textoDaUltimaSincronizacao={textoDaUltimaSincronizacao}
        />
      )}
    </>
  )
}

interface PropsDaSincronizacao {
  cobranca: CobrancaDetalheDto
  aoFechar: () => void
  textoDaUltimaSincronizacao: string
}

// Consulta o Asaas só para esta cobrança: é o passo recomendado antes de cobrar o aluno ou de registrar
// pagamento manual ([Cobranças.RF006] fluxo A1).
function DialogoDeSincronizacao({ cobranca, aoFechar, textoDaUltimaSincronizacao }: PropsDaSincronizacao) {
  const sincronizar = useSincronizarCobranca()
  const queryClient = useQueryClient()
  const resultado = sincronizar.data

  async function confirmar() {
    try {
      await sincronizar.mutateAsync({ id: cobranca.id })
      await queryClient.invalidateQueries({ queryKey: getBuscarCobrancaQueryKey(cobranca.id) })
    } catch {
      // A mensagem da API (ex.: Asaas fora do ar) aparece no diálogo.
    }
  }

  function descreverResultado(): string {
    if (!resultado) return ''
    if (resultado.falha) return resultado.falha
    if (resultado.atualizadas > 0) return 'A situação foi atualizada conforme o Asaas. Confira o histórico abaixo.'
    if (resultado.paraConferir > 0) return 'Há divergência com o Asaas que precisa de conferência (veja o histórico e o Asaas).'
    return 'Nada mudou: a cobrança já estava igual ao Asaas.'
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Sincronizar esta cobrança"
      descricao={`Consulta o Asaas e atualiza a situação de ${cobranca.descricao}.`}
      aoEnviar={(evento) => {
        evento.preventDefault()
        if (resultado) aoFechar()
        else void confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
          {!resultado && (
            <button type="submit" className="botao botao-principal" disabled={sincronizar.isPending}>
              {sincronizar.isPending ? 'Consultando o Asaas…' : 'Sincronizar agora'}
            </button>
          )}
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{cobranca.alunoNome}</dd>
          <dt>Última sincronização</dt>
          <dd>{textoDaUltimaSincronizacao}</dd>
        </dl>
        <p>Se o Asaas indicar que o boleto foi pago, a cobrança passa a Paga e a entrada é criada em Movimentações.</p>
      </div>
      {resultado && (
        <p className="texto-apoio" role="status">
          {descreverResultado()}
        </p>
      )}
      {sincronizar.error && (
        <p className="erro-formulario" role="alert">
          {sincronizar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

const esquemaDoPagamento = z.object({
  data: z.string().min(1, 'Informe a data do pagamento.'),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe o valor pago, por exemplo R$ 85,00.'),
  justificativa: z.string().trim().min(10, 'A justificativa é obrigatória: explique como o pagamento foi comprovado.'),
  formaPagamento: z.enum(['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO']),
})
type FormularioDoPagamento = z.infer<typeof esquemaDoPagamento>

interface PropsDoPagamento {
  cobranca: CobrancaDetalheDto
  aoFechar: () => void
  aoSincronizarPrimeiro: () => void
  resumoDaCobranca: string
  textoDaUltimaSincronizacao: string
}

// Registrar pagamento fora do Asaas [Cobranças.RF006]: operação com efeito, justificativa obrigatória.
// Montado só enquanto aberto: cada abertura começa com hoje, o valor da cobrança e a justificativa vazia.
function DialogoDePagamentoManual({
  cobranca,
  aoFechar,
  aoSincronizarPrimeiro,
  resumoDaCobranca,
  textoDaUltimaSincronizacao,
}: PropsDoPagamento) {
  const { register, handleSubmit, formState } = useForm<FormularioDoPagamento>({
    resolver: zodResolver(esquemaDoPagamento),
    defaultValues: { data: hojeIso(), valor: formatarMoeda(cobranca.valorCentavos), justificativa: '', formaPagamento: 'PIX' },
  })
  const registrarPagamento = useRegistrarPagamentoManual()
  const queryClient = useQueryClient()

  async function registrar(dados: FormularioDoPagamento) {
    const formaPagamento: FormaDePagamentoManual = dados.formaPagamento
    try {
      await registrarPagamento.mutateAsync({
        id: cobranca.id,
        data: { pagoEm: dados.data, valorCentavos: paraCentavos(dados.valor), formaPagamento, justificativa: dados.justificativa },
      })
      await queryClient.invalidateQueries({ queryKey: getBuscarCobrancaQueryKey(cobranca.id) })
      aoFechar()
    } catch {
      // A mensagem da API (ex.: parâmetros sem conta de recebimento) aparece no diálogo; nada foi gravado.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Registrar pagamento manualmente"
      descricao="Use só quando o valor comprovadamente entrou e a conciliação não refletiu."
      aoEnviar={(evento) => void handleSubmit(registrar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={registrarPagamento.isPending}>
            {registrarPagamento.isPending ? 'Registrando…' : 'Registrar pagamento'}
          </button>
        </>
      }
    >
      {cobranca.existeNoAsaas ? (
        <div className="aviso">
          <Icone nome="relogio" />
          <span>
            Última sincronização desta cobrança com o Asaas: <strong>{textoDaUltimaSincronizacao}</strong>.{' '}
            {/* Botão com cara de link: leva ao diálogo de sincronização sem sair deste. */}
            <button
              type="button"
              onClick={aoSincronizarPrimeiro}
              style={{ all: 'unset', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              Sincronize primeiro
            </button>
            {': o pagamento pode já estar lá.'}
          </span>
        </div>
      ) : (
        <div className="aviso">
          <Icone nome="relogio" />
          <span>Débito herdado da planilha: registre aqui o pagamento que o CASD recebeu diretamente do aluno.</span>
        </div>
      )}
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{cobranca.alunoNome}</dd>
          <dt>Cobrança</dt>
          <dd>{resumoDaCobranca}</dd>
        </dl>
      </div>
      <div className="formulario">
        <div className="campo">
          <label htmlFor="pm-data">Data do pagamento</label>
          <input id="pm-data" type="date" aria-invalid={!!formState.errors.data} {...register('data')} />
          {formState.errors.data && <span className="dica" role="alert">{formState.errors.data.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="pm-valor">Valor pago</label>
          <input id="pm-valor" aria-invalid={!!formState.errors.valor} {...register('valor')} />
          {formState.errors.valor && <span className="dica" role="alert">{formState.errors.valor.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="pm-forma">Forma do pagamento</label>
          <select id="pm-forma" {...register('formaPagamento')}>
            <option value="PIX">Pix</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO">Cartão</option>
          </select>
        </div>
        <div className="campo inteiro">
          <label htmlFor="pm-justificativa">Justificativa (obrigatória)</label>
          <textarea
            id="pm-justificativa"
            placeholder="Ex.: Pix recebido na conta do CASD em 12/08, comprovante enviado pelo aluno"
            aria-invalid={!!formState.errors.justificativa}
            {...register('justificativa')}
          />
          {formState.errors.justificativa && (
            <span className="dica" role="alert">{formState.errors.justificativa.message}</span>
          )}
        </div>
      </div>
      <div className="aviso aviso-perigo">
        <Icone nome="alerta" />
        <span>
          A cobrança ficará como <strong>Paga com registro manual</strong>
          {cobranca.existeNoAsaas && ' e o IntegraCASD passará a divergir do Asaas'}. A entrada do valor pago será criada
          em Movimentações.
        </span>
      </div>
      {registrarPagamento.error && (
        <p className="erro-formulario" role="alert">
          {registrarPagamento.error.message}
        </p>
      )}
    </Dialogo>
  )
}

const esquemaDoCancelamento = z.object({
  motivo: z.string().trim().min(5, 'Informe o motivo do cancelamento, por exemplo: renegociação em 3 parcelas.'),
  renegociar: z.boolean(),
})
type FormularioDoCancelamento = z.infer<typeof esquemaDoCancelamento>

interface PropsDoCancelamento {
  cobranca: CobrancaDetalheDto
  aoFechar: () => void
  resumoDaCobranca: string
}

// [Cobranças.RF004] Cancela no Asaas e aqui. Com "renegociar" marcado, abre em seguida a nova cobrança
// para o mesmo aluno, já preenchida e vinculada a esta (fluxo A1).
function DialogoDeCancelamento({ cobranca, aoFechar, resumoDaCobranca }: PropsDoCancelamento) {
  const { register, handleSubmit, formState } = useForm<FormularioDoCancelamento>({
    resolver: zodResolver(esquemaDoCancelamento),
    defaultValues: { motivo: '', renegociar: true },
  })
  const cancelar = useCancelarCobranca()
  const queryClient = useQueryClient()
  const { abrirNovaCobranca } = useAcoesGlobais()

  async function confirmar(dados: FormularioDoCancelamento) {
    try {
      await cancelar.mutateAsync({ id: cobranca.id, data: { motivo: dados.motivo } })
      await queryClient.invalidateQueries({ queryKey: getBuscarCobrancaQueryKey(cobranca.id) })
      aoFechar()
      if (dados.renegociar) {
        abrirNovaCobranca({
          aluno: cobranca.alunoNome,
          valor: formatarValorParaCampo(cobranca.valorCentavos),
          descricao: `${cobranca.descricao} (renegociação)`,
          renegociacaoDeId: cobranca.id,
        })
      }
    } catch {
      // A mensagem da API (ex.: Asaas indisponível) aparece no diálogo; nada foi cancelado.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Cancelar cobrança?"
      descricao="Esta operação não pode ser desfeita."
      aoEnviar={(evento) => void handleSubmit(confirmar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={cancelar.isPending}>
            {cancelar.isPending ? (cobranca.existeNoAsaas ? 'Cancelando no Asaas…' : 'Cancelando…') : 'Cancelar cobrança'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{cobranca.alunoNome}</dd>
          <dt>Cobrança</dt>
          <dd>{resumoDaCobranca}</dd>
          <dt>Vencimento</dt>
          <dd>
            {formatarData(cobranca.vencimento)}
            {cobranca.diasDeAtraso !== null && ` (vencida há ${cobranca.diasDeAtraso} dias)`}
          </dd>
        </dl>
        {cobranca.existeNoAsaas ? (
          <p>
            A cobrança será cancelada <strong>no Asaas e no IntegraCASD</strong>. O boleto perde a validade e a cobrança
            deixa de contar na inadimplência.
          </p>
        ) : (
          <p>
            O débito herdado da planilha será cancelado <strong>no IntegraCASD</strong> (ele não existe no Asaas) e deixa
            de contar na inadimplência. Para cobrar com boleto, mantenha a renegociação marcada.
          </p>
        )}
      </div>
      <div className="campo">
        <label htmlFor="ca-motivo">Motivo do cancelamento</label>
        <textarea
          id="ca-motivo"
          placeholder="Ex.: renegociação em 3 parcelas, acordada com o aluno"
          aria-invalid={!!formState.errors.motivo}
          {...register('motivo')}
        />
        {formState.errors.motivo && (
          <span className="dica" role="alert">
            {formState.errors.motivo.message}
          </span>
        )}
      </div>
      <label className="campo-check">
        <input type="checkbox" {...register('renegociar')} />
        Emitir nova cobrança para o aluno em seguida (renegociação)
      </label>
      {cancelar.error && (
        <p className="erro-formulario" role="alert">
          {cancelar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

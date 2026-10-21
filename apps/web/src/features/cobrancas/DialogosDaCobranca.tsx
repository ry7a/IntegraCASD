import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda, hojeIso, paraCentavos } from '@/compartilhado/formatacao'
import type { CobrancaDetalheDto } from './contrato'

export type DialogoDaCobranca = 'sincronizar' | 'cancelar' | 'pagamento-manual'

interface Props {
  cobranca: CobrancaDetalheDto
  aberto: DialogoDaCobranca | null
  aoFechar: () => void
  aoTrocar: (dialogo: DialogoDaCobranca) => void
}

// Os três diálogos da tela de detalhe. Os que mudam dados passam por confirmação com o resumo do
// efeito ([Usabilidade.NF003]). Nenhum tem efeito ainda: ao confirmar, só fecham.
export function DialogosDaCobranca({ cobranca, aberto, aoFechar, aoTrocar }: Props) {
  const resumoDaCobranca = `${cobranca.descricao} · ${formatarMoeda(cobranca.valorCentavos)}`
  const textoDaUltimaSincronizacao = cobranca.ultimaSincronizacaoEm
    ? `${formatarData(cobranca.ultimaSincronizacaoEm)} (há ${cobranca.diasDesdeUltimaSincronizacao} dias)`
    : 'nunca sincronizada'

  function confirmarSemEfeito(evento: { preventDefault: () => void }) {
    evento.preventDefault()
    aoFechar()
  }

  return (
    <>
      {/* Sincronizar só esta cobrança [Cobranças.RF007] */}
      <Dialogo
        aberto={aberto === 'sincronizar'}
        aoFechar={aoFechar}
        titulo="Sincronizar esta cobrança"
        descricao={`Consulta o Asaas e atualiza a situação de ${cobranca.descricao}.`}
        // TODO [Cobranças.RF007]: POST /api/cobrancas/:id/sincronizar.
        aoEnviar={confirmarSemEfeito}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>
              Fechar
            </button>
            <button type="submit" className="botao botao-principal">
              Sincronizar agora
            </button>
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
      </Dialogo>

      {/* Cancelar cobrança [Cobranças.RF004]: operação irreversível */}
      <Dialogo
        aberto={aberto === 'cancelar'}
        aoFechar={aoFechar}
        titulo="Cancelar cobrança?"
        descricao="Esta operação não pode ser desfeita."
        // TODO [Cobranças.RF004]: POST /api/cobrancas/:id/cancelar (no Asaas e aqui), com motivo e auditoria.
        aoEnviar={confirmarSemEfeito}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>
              Voltar
            </button>
            <button type="submit" className="botao botao-destrutivo">
              Cancelar cobrança
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
          <p>
            A cobrança será cancelada <strong>no Asaas e no IntegraCASD</strong>. O boleto perde a validade e a cobrança
            deixa de contar na inadimplência.
          </p>
        </div>
        <div className="campo">
          <label htmlFor="ca-motivo">Motivo do cancelamento</label>
          <textarea id="ca-motivo" placeholder="Ex.: renegociação em 3 parcelas, acordada com o aluno em 19/10/2026" />
        </div>
        <label className="campo-check">
          <input type="checkbox" defaultChecked />
          Emitir nova cobrança para o aluno em seguida (renegociação)
        </label>
      </Dialogo>

      <DialogoDePagamentoManual
        cobranca={cobranca}
        aberto={aberto === 'pagamento-manual'}
        aoFechar={aoFechar}
        aoSincronizarPrimeiro={() => aoTrocar('sincronizar')}
        resumoDaCobranca={resumoDaCobranca}
        textoDaUltimaSincronizacao={textoDaUltimaSincronizacao}
      />
    </>
  )
}

const esquemaDoPagamento = z.object({
  data: z.string().min(1, 'Informe a data do pagamento.'),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe o valor pago, por exemplo R$ 85,00.'),
  justificativa: z.string().min(1, 'A justificativa é obrigatória: explique como o pagamento foi comprovado.'),
})
type FormularioDoPagamento = z.infer<typeof esquemaDoPagamento>

interface PropsDoPagamento {
  cobranca: CobrancaDetalheDto
  aberto: boolean
  aoFechar: () => void
  aoSincronizarPrimeiro: () => void
  resumoDaCobranca: string
  textoDaUltimaSincronizacao: string
}

// Registrar pagamento fora do Asaas [Cobranças.RF006]: operação com efeito, justificativa obrigatória.
function DialogoDePagamentoManual({
  cobranca,
  aberto,
  aoFechar,
  aoSincronizarPrimeiro,
  resumoDaCobranca,
  textoDaUltimaSincronizacao,
}: PropsDoPagamento) {
  const { register, handleSubmit, reset, formState } = useForm<FormularioDoPagamento>({
    resolver: zodResolver(esquemaDoPagamento),
    defaultValues: { data: '', valor: '', justificativa: '' },
  })

  useEffect(() => {
    if (aberto) reset({ data: hojeIso(), valor: formatarMoeda(cobranca.valorCentavos), justificativa: '' })
  }, [aberto, cobranca.valorCentavos, reset])

  function registrar() {
    // TODO [Cobranças.RF006]: POST /api/cobrancas/:id/pagamento-manual. Marca como "Paga com registro manual"
    // e cria a entrada em Movimentações na mesma transação ([Confiabilidade.NF004]).
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Registrar pagamento manualmente"
      descricao="Use só quando o valor comprovadamente entrou e a conciliação não refletiu."
      aoEnviar={(evento) => void handleSubmit(registrar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo">
            Registrar pagamento
          </button>
        </>
      }
    >
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
          A cobrança ficará como <strong>Paga com registro manual</strong> e o IntegraCASD passará a divergir do Asaas.
          Uma entrada de {formatarMoeda(cobranca.valorCentavos)} será criada em Movimentações.
        </span>
      </div>
    </Dialogo>
  )
}

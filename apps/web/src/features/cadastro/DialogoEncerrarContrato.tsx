import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getListarContratosQueryKey, useEncerrarContrato, type ContratoDto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarMoeda, hojeIso } from '@/compartilhado/formatacao'

const esquema = z.object({
  dataEncerramento: z.string().min(1, 'Informe a data efetiva do encerramento.'),
  justificativa: z.string().trim().min(5, 'Informe a justificativa, por exemplo: serviço passou a ser feito pela AEITA.'),
})
type Formulario = z.infer<typeof esquema>

// [Cadastros.RF004] fluxo A1: encerramento antecipado. As movimentações já registradas não mudam.
function DialogoEncerrarContrato({ contrato, aoFechar }: { contrato: ContratoDto; aoFechar: () => void }) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { dataEncerramento: hojeIso(), justificativa: '' },
  })
  const encerrar = useEncerrarContrato()
  const queryClient = useQueryClient()

  async function confirmar(dados: Formulario) {
    try {
      await encerrar.mutateAsync({ id: contrato.id, data: dados })
      await queryClient.invalidateQueries({ queryKey: getListarContratosQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Encerrar contrato?"
      descricao="O contrato deixa de aparecer entre os vigentes. Esta operação não pode ser desfeita."
      aoEnviar={(evento) => void handleSubmit(confirmar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={encerrar.isPending}>
            {encerrar.isPending ? 'Encerrando…' : 'Encerrar contrato'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Contrato</dt>
          <dd>
            {contrato.codigo} · {contrato.contraparte}
          </dd>
          <dt>Pago no ano</dt>
          <dd>{formatarMoeda(contrato.pagoNoAnoCentavos)}</dd>
        </dl>
        <p>As movimentações já registradas neste contrato continuam como estão.</p>
      </div>
      <div className="campo">
        <label htmlFor="ec-data">Data efetiva do encerramento</label>
        <input id="ec-data" type="date" aria-invalid={!!formState.errors.dataEncerramento} {...register('dataEncerramento')} />
        {formState.errors.dataEncerramento && (
          <span className="dica" role="alert">
            {formState.errors.dataEncerramento.message}
          </span>
        )}
      </div>
      <div className="campo">
        <label htmlFor="ec-justificativa">Justificativa</label>
        <textarea id="ec-justificativa" aria-invalid={!!formState.errors.justificativa} {...register('justificativa')} />
        {formState.errors.justificativa && (
          <span className="dica" role="alert">
            {formState.errors.justificativa.message}
          </span>
        )}
      </div>
      {encerrar.error && (
        <p className="erro-formulario" role="alert">
          {encerrar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoEncerrarContrato

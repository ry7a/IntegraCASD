import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useEstornarMovimentacao, type MovimentacaoDto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { useAcoesGlobais } from '@/compartilhado/acoes-globais'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { ROTULO_DA_FORMA } from '@/compartilhado/dominio'
import { formatarData, formatarMoeda, formatarMoedaComSinal } from '@/compartilhado/formatacao'

const esquema = z.object({
  motivo: z.string().trim().min(5, 'Informe o motivo do estorno, por exemplo: valor lançado errado.'),
  lancarCorreta: z.boolean(),
})
type Formulario = z.infer<typeof esquema>

const ROTULO_DO_VINCULO = { COBRANCA: 'Cobrança', CONTRATO: 'Contrato', PROJETO: 'Projeto', FUNCIONARIO: 'Funcionário' }

interface Props {
  movimentacao: MovimentacaoDto
  aoFechar: () => void
}

// Estornar movimentação [Movimentações.RF002]: operação irreversível, com resumo do efeito.
// Montado só enquanto aberto: cada abertura começa com o motivo vazio.
function DialogoEstornar({ movimentacao, aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { motivo: '', lancarCorreta: true },
  })
  const estornar = useEstornarMovimentacao()
  const queryClient = useQueryClient()
  const { abrirNovaMovimentacao } = useAcoesGlobais()
  const sinalOposto = movimentacao.tipo === 'SAIDA' ? '+' : '−'

  async function confirmar(dados: Formulario) {
    try {
      await estornar.mutateAsync({ id: movimentacao.id, data: { motivo: dados.motivo } })
      // A lista, os totais e os indicadores mudam.
      await queryClient.invalidateQueries()
      aoFechar()
      if (dados.lancarCorreta) abrirNovaMovimentacao()
    } catch {
      // A mensagem da API (ex.: já estornada) aparece no diálogo; nada foi criado.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Estornar movimentação?"
      descricao="Esta operação não pode ser desfeita."
      aoEnviar={(evento) => void handleSubmit(confirmar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={estornar.isPending}>
            {estornar.isPending ? 'Estornando…' : 'Estornar'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Movimentação</dt>
          <dd>{movimentacao.descricao}</dd>
          <dt>Valor</dt>
          <dd>
            {formatarMoedaComSinal(movimentacao.tipo, movimentacao.valorCentavos)} · {ROTULO_DA_FORMA[movimentacao.forma]} ·{' '}
            {formatarData(movimentacao.data)}
          </dd>
          {movimentacao.vinculo?.nome && (
            <>
              <dt>Vínculo</dt>
              <dd>
                {ROTULO_DO_VINCULO[movimentacao.vinculo.tipo]} · {movimentacao.vinculo.nome}
              </dd>
            </>
          )}
        </dl>
        <p>
          A movimentação original continua visível, marcada como estornada. Será criada uma{' '}
          {movimentacao.tipo === 'SAIDA' ? 'entrada' : 'saída'} de{' '}
          <strong>
            {sinalOposto} {formatarMoeda(movimentacao.valorCentavos)}
          </strong>{' '}
          que anula o efeito dela no saldo.
        </p>
      </div>
      <div className="campo">
        <label htmlFor="es-motivo">Motivo do estorno</label>
        <textarea
          id="es-motivo"
          placeholder="Ex.: valor lançado errado, o correto é R$ 1.020,00"
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
        <input type="checkbox" {...register('lancarCorreta')} />
        Lançar a movimentação correta em seguida
      </label>
      {estornar.error && (
        <p className="erro-formulario" role="alert">
          {estornar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoEstornar

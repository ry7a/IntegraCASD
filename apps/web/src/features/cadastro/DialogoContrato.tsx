import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getListarContratosQueryKey, useAlterarContrato, useCriarContrato, type ContratoDto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarValorParaCampo, paraCentavos } from '@/compartilhado/formatacao'
import { ROTULO_DA_PERIODICIDADE } from './rotulos'

// Validação só para retorno rápido; a que vale (vigência, limites) é a da API.
const esquema = z.object({
  contraparte: z.string().trim().min(2, 'Informe a contraparte, por exemplo: Limpeza Fictícia Ltda.'),
  objeto: z.string().trim().min(2, 'Informe o objeto do contrato.'),
  valor: z.string().refine((texto) => paraCentavos(texto) >= 0 && texto.trim() !== '', 'Informe o valor, por exemplo R$ 1.200,00.'),
  periodicidade: z.enum(['MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA']),
  dataInicio: z.string().min(1, 'Informe a data de início.'),
  dataFim: z.string(),
})
type Formulario = z.infer<typeof esquema>

interface Props {
  // Nulo = novo contrato.
  contrato: ContratoDto | null
  aoFechar: () => void
}

// [Cadastros.RF004] Inclusão e alteração de contrato. A contraparte é só um texto.
function DialogoContrato({ contrato, aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: contrato
      ? {
          contraparte: contrato.contraparte,
          objeto: contrato.objeto,
          valor: formatarValorParaCampo(contrato.valorCentavos),
          periodicidade: contrato.periodicidade,
          dataInicio: contrato.dataInicio,
          dataFim: contrato.dataFim ?? '',
        }
      : { contraparte: '', objeto: '', valor: '', periodicidade: 'MENSAL', dataInicio: '', dataFim: '' },
  })
  const erros = formState.errors
  const criar = useCriarContrato()
  const alterar = useAlterarContrato()
  const queryClient = useQueryClient()
  const mutacao = contrato ? alterar : criar

  async function salvar(dados: Formulario) {
    const corpo = {
      contraparte: dados.contraparte,
      objeto: dados.objeto,
      valorCentavos: paraCentavos(dados.valor),
      periodicidade: dados.periodicidade,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim === '' ? null : dados.dataFim,
    }
    try {
      if (contrato) await alterar.mutateAsync({ id: contrato.id, data: corpo })
      else await criar.mutateAsync({ data: corpo })
      await queryClient.invalidateQueries({ queryKey: getListarContratosQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={contrato ? `Editar contrato ${contrato.codigo}` : 'Novo contrato'}
      descricao="Os pagamentos do contrato são lançados como movimentações de saída vinculadas a ele."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando…' : 'Salvar contrato'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="ct-contraparte">Contraparte</label>
          <input id="ct-contraparte" aria-invalid={!!erros.contraparte} {...register('contraparte')} />
          {erros.contraparte && (
            <span className="dica" role="alert">
              {erros.contraparte.message}
            </span>
          )}
        </div>
        <div className="campo inteiro">
          <label htmlFor="ct-objeto">Objeto</label>
          <input id="ct-objeto" aria-invalid={!!erros.objeto} {...register('objeto')} />
          {erros.objeto && (
            <span className="dica" role="alert">
              {erros.objeto.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="ct-valor">Valor</label>
          <input id="ct-valor" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.valor} {...register('valor')} />
          {erros.valor && (
            <span className="dica" role="alert">
              {erros.valor.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="ct-periodicidade">Periodicidade</label>
          <select id="ct-periodicidade" {...register('periodicidade')}>
            {(['MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA'] as const).map((periodicidade) => (
              <option key={periodicidade} value={periodicidade}>
                {ROTULO_DA_PERIODICIDADE[periodicidade]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ct-inicio">Início</label>
          <input id="ct-inicio" type="date" aria-invalid={!!erros.dataInicio} {...register('dataInicio')} />
          {erros.dataInicio && (
            <span className="dica" role="alert">
              {erros.dataInicio.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="ct-fim">Término</label>
          <input id="ct-fim" type="date" {...register('dataFim')} />
          <span className="dica">Em branco: prazo indeterminado.</span>
        </div>
        {mutacao.error && (
          <p className="erro-formulario inteiro" role="alert">
            {mutacao.error.message}
          </p>
        )}
      </div>
    </Dialogo>
  )
}

export default DialogoContrato

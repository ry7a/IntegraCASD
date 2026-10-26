import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getListarProjetosQueryKey, useAlterarProjeto, useCriarProjeto, type ProjetoDto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarValorParaCampo, paraCentavos } from '@/compartilhado/formatacao'
import { ROTULO_DA_SITUACAO_DO_PROJETO } from './rotulos'

// Validação só para retorno rápido; a que vale (período, limites) é a da API.
const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome do projeto.'),
  responsavel: z.string(),
  dataInicio: z.string().min(1, 'Informe a data de início.'),
  dataFim: z.string(),
  orcamento: z.string(),
  situacao: z.enum(['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO', 'EXECUTADO', 'CANCELADO']),
})
type Formulario = z.infer<typeof esquema>

interface Props {
  // Nulo = novo projeto.
  projeto: ProjetoDto | null
  aoFechar: () => void
}

// [Cadastros.RF005] Inclusão e alteração de projeto. Encerrar = escolher "Executado" ou "Cancelado"
// (fluxo A1); o projeto continua aceitando movimentações (fluxo E1).
function DialogoProjeto({ projeto, aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: projeto
      ? {
          nome: projeto.nome,
          responsavel: projeto.responsavel ?? '',
          dataInicio: projeto.dataInicio,
          dataFim: projeto.dataFim ?? '',
          orcamento: projeto.orcamentoPrevistoCentavos === null ? '' : formatarValorParaCampo(projeto.orcamentoPrevistoCentavos),
          situacao: projeto.situacao,
        }
      : { nome: '', responsavel: '', dataInicio: '', dataFim: '', orcamento: '', situacao: 'A_LIBERAR' },
  })
  const erros = formState.errors
  const criar = useCriarProjeto()
  const alterar = useAlterarProjeto()
  const queryClient = useQueryClient()
  const mutacao = projeto ? alterar : criar

  async function salvar(dados: Formulario) {
    const corpo = {
      nome: dados.nome,
      responsavel: dados.responsavel.trim() === '' ? null : dados.responsavel,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim === '' ? null : dados.dataFim,
      orcamentoPrevistoCentavos: dados.orcamento.trim() === '' ? null : paraCentavos(dados.orcamento),
      situacao: dados.situacao,
    }
    try {
      if (projeto) await alterar.mutateAsync({ id: projeto.id, data: corpo })
      else await criar.mutateAsync({ data: corpo })
      await queryClient.invalidateQueries({ queryKey: getListarProjetosQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={projeto ? `Editar projeto ${projeto.codigo}` : 'Novo projeto'}
      descricao="Despesas e receitas do projeto são lançadas como movimentações vinculadas a ele."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando…' : 'Salvar projeto'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="pj-nome">Nome</label>
          <input id="pj-nome" aria-invalid={!!erros.nome} {...register('nome')} />
          {erros.nome && (
            <span className="dica" role="alert">
              {erros.nome.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="pj-responsavel">Responsável</label>
          <input id="pj-responsavel" {...register('responsavel')} />
          <span className="dica">Opcional.</span>
        </div>
        <div className="campo">
          <label htmlFor="pj-orcamento">Orçamento previsto</label>
          <input id="pj-orcamento" inputMode="decimal" placeholder="R$ 0,00" {...register('orcamento')} />
          <span className="dica">Em branco: sem orçamento previsto.</span>
        </div>
        <div className="campo">
          <label htmlFor="pj-inicio">Início</label>
          <input id="pj-inicio" type="date" aria-invalid={!!erros.dataInicio} {...register('dataInicio')} />
          {erros.dataInicio && (
            <span className="dica" role="alert">
              {erros.dataInicio.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="pj-fim">Término</label>
          <input id="pj-fim" type="date" {...register('dataFim')} />
        </div>
        <div className="campo">
          <label htmlFor="pj-situacao">Situação</label>
          <select id="pj-situacao" {...register('situacao')}>
            {(['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO', 'EXECUTADO', 'CANCELADO'] as const).map((situacao) => (
              <option key={situacao} value={situacao}>
                {ROTULO_DA_SITUACAO_DO_PROJETO[situacao]}
              </option>
            ))}
          </select>
          <span className="dica">Executado ou cancelado: o projeto passa para os encerrados.</span>
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

export default DialogoProjeto

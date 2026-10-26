import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  getListarCategoriasComUsoQueryKey,
  useAlterarCategoria,
  useCriarCategoria,
  type CategoriaComUsoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { ROTULO_DO_TIPO_DA_CATEGORIA } from './rotulos'

// Validação só para retorno rápido; a regra que vale (nome único, troca de tipo) é a da API.
const esquema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome da categoria, com ao menos 2 caracteres.')
    .max(60, 'Use no máximo 60 caracteres.'),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AMBOS']),
  ativo: z.boolean(),
})
type Formulario = z.infer<typeof esquema>

interface Props {
  // Nulo = nova categoria.
  categoria: CategoriaComUsoDto | null
  aoFechar: () => void
}

// [Administração.RF002] Inclusão e alteração de categoria. Inativar é desmarcar "Ativa".
// A aba só monta este diálogo enquanto ele está aberto: cada abertura começa com o formulário limpo.
function DialogoCategoria({ categoria, aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: categoria
      ? { nome: categoria.nome, tipo: categoria.tipo, ativo: categoria.ativo }
      : { nome: '', tipo: 'SAIDA', ativo: true },
  })
  const erros = formState.errors
  const criar = useCriarCategoria()
  const alterar = useAlterarCategoria()
  const queryClient = useQueryClient()
  const mutacao = categoria ? alterar : criar

  async function salvar(dados: Formulario) {
    try {
      if (categoria) {
        await alterar.mutateAsync({ id: categoria.id, data: dados })
      } else {
        await criar.mutateAsync({ data: { nome: dados.nome, tipo: dados.tipo } })
      }
      await queryClient.invalidateQueries({ queryKey: getListarCategoriasComUsoQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo (mutacao.error).
    }
  }

  const emUso = (categoria?.quantidadeMovimentacoes ?? 0) > 0

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={categoria ? 'Editar categoria' : 'Nova categoria'}
      descricao="As categorias classificam entradas e saídas e são a base dos relatórios de gastos."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando…' : 'Salvar categoria'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="categoria-nome">Nome</label>
          <input id="categoria-nome" autoComplete="off" aria-invalid={!!erros.nome} {...register('nome')} />
          {erros.nome && (
            <span className="dica" role="alert">
              {erros.nome.message}
            </span>
          )}
        </div>
        <div className="campo inteiro">
          <label htmlFor="categoria-tipo">Aplica-se a</label>
          <select id="categoria-tipo" {...register('tipo')}>
            {Object.entries(ROTULO_DO_TIPO_DA_CATEGORIA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          {emUso && (
            <span className="dica">
              Já há movimentações nesta categoria: o tipo escolhido precisa continuar valendo para elas.
            </span>
          )}
        </div>
        {categoria && (
          <label className="campo-check inteiro">
            <input type="checkbox" {...register('ativo')} />
            Ativa (inativa deixa de aparecer em novos lançamentos, mas não é excluída)
          </label>
        )}
        {mutacao.error && (
          <p className="erro-formulario inteiro" role="alert">
            {mutacao.error.message}
          </p>
        )}
      </div>
    </Dialogo>
  )
}

export default DialogoCategoria

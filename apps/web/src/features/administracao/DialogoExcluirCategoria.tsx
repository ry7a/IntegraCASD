import {
  getListarCategoriasComUsoQueryKey,
  useExcluirCategoria,
  type CategoriaComUsoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { ROTULO_DO_TIPO_DA_CATEGORIA } from './rotulos'

interface Props {
  categoria: CategoriaComUsoDto
  aoFechar: () => void
}

// Exclusão é irreversível: passa pelo diálogo de confirmação, com o resumo do efeito ([Usabilidade.NF003]).
// A tela só oferece excluir categoria sem movimentações; a API confere de novo e recusa se houver.
function DialogoExcluirCategoria({ categoria, aoFechar }: Props) {
  const excluir = useExcluirCategoria()
  const queryClient = useQueryClient()

  async function confirmar() {
    try {
      await excluir.mutateAsync({ id: categoria.id })
      await queryClient.invalidateQueries({ queryKey: getListarCategoriasComUsoQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo (excluir.error).
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Excluir categoria?"
      descricao="A exclusão não pode ser desfeita."
      aoEnviar={(evento) => {
        evento.preventDefault()
        void confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={excluir.isPending}>
            {excluir.isPending ? 'Excluindo…' : 'Excluir categoria'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Categoria</dt>
          <dd>{categoria.nome}</dd>
          <dt>Aplica-se a</dt>
          <dd>{ROTULO_DO_TIPO_DA_CATEGORIA[categoria.tipo]}</dd>
        </dl>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Nenhuma movimentação usa esta categoria, por isso ela pode ser excluída.</li>
          <li>
            Se o problema for só o nome, prefira <strong>Editar</strong>: a categoria continua a mesma.
          </li>
          <li>A exclusão fica registrada na trilha de auditoria.</li>
        </ul>
      </div>
      {excluir.error && (
        <p className="erro-formulario" role="alert">
          {excluir.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoExcluirCategoria

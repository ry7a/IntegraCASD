import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { getListarAlunosQueryKey, useCriarAluno } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import CamposDoAluno from './CamposDoAluno'
import { esquemaDoAluno, FORMULARIO_VAZIO, paraCorpoDaApi, type FormularioDoAluno } from './esquema-do-aluno'

interface Props {
  aoFechar: () => void
}

// [Cadastros.RF001] Inclusão de aluno. A lista só monta este diálogo enquanto ele está aberto:
// cada abertura começa com o formulário limpo. Ao salvar, abre o cadastro criado.
function DialogoNovoAluno({ aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<FormularioDoAluno>({
    resolver: zodResolver(esquemaDoAluno),
    defaultValues: FORMULARIO_VAZIO,
  })
  const criar = useCriarAluno()
  const queryClient = useQueryClient()
  const navegar = useNavigate()

  async function salvar(formulario: FormularioDoAluno) {
    try {
      const criado = await criar.mutateAsync({ data: paraCorpoDaApi(formulario) })
      await queryClient.invalidateQueries({ queryKey: getListarAlunosQueryKey() })
      aoFechar()
      void navegar(`/cadastros/alunos/${criado.id}`)
    } catch {
      // A mensagem da API (ex.: CPF já cadastrado, com o nome de quem tem) aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Novo aluno"
      descricao="Nome, CPF e e-mail são obrigatórios: o Asaas exige CPF e e-mail para emitir a cobrança."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={criar.isPending}>
            {criar.isPending ? 'Salvando…' : 'Salvar aluno'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <CamposDoAluno prefixo="al" register={register} erros={formState.errors} />
        {criar.error && (
          <p className="erro-formulario inteiro" role="alert">
            {criar.error.message}
          </p>
        )}
      </div>
    </Dialogo>
  )
}

export default DialogoNovoAluno

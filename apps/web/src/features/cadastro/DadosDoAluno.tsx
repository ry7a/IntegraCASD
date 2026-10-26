import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  getBuscarAlunoQueryKey,
  getListarAlunosQueryKey,
  useAlterarAluno,
  type AlunoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import CamposDoAluno from './CamposDoAluno'
import { esquemaDoAluno, paraCorpoDaApi, paraFormulario, type FormularioDoAluno } from './esquema-do-aluno'

// Aba "Dados": o formulário já vem preenchido com o cadastro. [Cadastros.RF001]
function DadosDoAluno({ aluno }: { aluno: AlunoDto }) {
  const { register, handleSubmit, formState, reset } = useForm<FormularioDoAluno>({
    resolver: zodResolver(esquemaDoAluno),
    defaultValues: paraFormulario(aluno),
  })
  const alterar = useAlterarAluno()
  const queryClient = useQueryClient()

  async function salvar(formulario: FormularioDoAluno) {
    try {
      const alterado = await alterar.mutateAsync({ id: aluno.id, data: paraCorpoDaApi(formulario) })
      queryClient.setQueryData(getBuscarAlunoQueryKey(aluno.id), alterado)
      await queryClient.invalidateQueries({ queryKey: getListarAlunosQueryKey() })
      // O formulário passa a considerar os dados salvos como o novo ponto de partida.
      reset(paraFormulario(alterado))
    } catch {
      // A mensagem da API aparece abaixo do formulário.
    }
  }

  return (
    <div className="cartao" style={{ maxWidth: 720 }}>
      <div className="cartao-cabecalho">
        <div>
          <h2>Dados cadastrais</h2>
          <p>E-mail e CPF são obrigatórios: o Asaas exige os dois para emitir a cobrança.</p>
        </div>
      </div>
      <form className="formulario" noValidate onSubmit={(evento) => void handleSubmit(salvar)(evento)}>
        <CamposDoAluno prefixo="ad" register={register} erros={formState.errors} />
        {alterar.error && (
          <p className="erro-formulario inteiro" role="alert">
            {alterar.error.message}
          </p>
        )}
        {alterar.isSuccess && !formState.isDirty && (
          <p className="texto-apoio inteiro" role="status">
            Alterações salvas.
          </p>
        )}
        <div className="inteiro">
          <button type="submit" className="botao botao-principal" disabled={alterar.isPending || !formState.isDirty}>
            {alterar.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default DadosDoAluno

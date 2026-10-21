import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import CamposDoAluno from './CamposDoAluno'
import { esquemaDoAluno, type FormularioDoAluno } from './esquema-do-aluno'

const VALORES_INICIAIS: FormularioDoAluno = {
  nome: '',
  cpf: '',
  nascimento: '',
  email: '',
  telefone: '',
  situacao: 'ATIVO',
}

interface Props {
  aberto: boolean
  aoFechar: () => void
}

function DialogoNovoAluno({ aberto, aoFechar }: Props) {
  const { register, handleSubmit, reset, formState } = useForm<FormularioDoAluno>({
    resolver: zodResolver(esquemaDoAluno),
    defaultValues: VALORES_INICIAIS,
  })

  useEffect(() => {
    if (aberto) reset(VALORES_INICIAIS)
  }, [aberto, reset])

  function salvar() {
    // TODO [Cadastros.RF001]: POST /api/alunos. Se o CPF já existir entre os ativos, a API recusa com a
    // mensagem "Já existe um cadastro ativo com o CPF ... Abra esse cadastro para atualizá-lo": mostrar aqui.
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo aluno"
      descricao="E-mail e CPF são obrigatórios: o Asaas exige os dois para emitir a cobrança."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal">
            Salvar aluno
          </button>
        </>
      }
    >
      <div className="formulario">
        <CamposDoAluno prefixo="al" register={register} erros={formState.errors} />
      </div>
    </Dialogo>
  )
}

export default DialogoNovoAluno

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { formatarCpf } from '@/compartilhado/formatacao'
import CamposDoAluno from './CamposDoAluno'
import type { AlunoDetalheDto } from './contrato'
import { esquemaDoAluno, type FormularioDoAluno } from './esquema-do-aluno'

// Aba "Dados": o formulário já vem preenchido com o cadastro.
function DadosDoAluno({ aluno }: { aluno: AlunoDetalheDto }) {
  const { register, handleSubmit, formState } = useForm<FormularioDoAluno>({
    resolver: zodResolver(esquemaDoAluno),
    defaultValues: {
      nome: aluno.nome,
      cpf: formatarCpf(aluno.cpf),
      nascimento: aluno.dataNascimento ?? '',
      email: aluno.email,
      telefone: aluno.celular ?? '',
      situacao: aluno.ativo ? 'ATIVO' : 'INATIVO',
    },
  })

  function salvar() {
    // TODO [Cadastros.RF001]: PUT /api/alunos/:id (com auditoria). Por enquanto o formulário só valida.
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
        <div className="inteiro">
          <button type="submit" className="botao botao-principal">
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  )
}

export default DadosDoAluno

import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { FormularioDoAluno } from './esquema-do-aluno'

interface Props {
  prefixo: string
  register: UseFormRegister<FormularioDoAluno>
  erros: FieldErrors<FormularioDoAluno>
}

// Os campos do formulário de aluno, iguais no diálogo "Novo aluno" e na aba "Dados".
// `prefixo` evita ids repetidos quando os dois existem na mesma página.
function CamposDoAluno({ prefixo, register, erros }: Props) {
  return (
    <>
      <div className="campo inteiro">
        <label htmlFor={`${prefixo}-nome`}>Nome completo</label>
        <input id={`${prefixo}-nome`} aria-invalid={!!erros.nome} {...register('nome')} />
        {erros.nome && <span className="dica" role="alert">{erros.nome.message}</span>}
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-cpf`}>CPF</label>
        <input
          id={`${prefixo}-cpf`}
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-invalid={!!erros.cpf}
          {...register('cpf')}
        />
        {erros.cpf && <span className="dica" role="alert">{erros.cpf.message}</span>}
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-nascimento`}>Data de nascimento</label>
        <input id={`${prefixo}-nascimento`} type="date" {...register('nascimento')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-email`}>E-mail</label>
        <input id={`${prefixo}-email`} type="email" aria-invalid={!!erros.email} {...register('email')} />
        {erros.email && <span className="dica" role="alert">{erros.email.message}</span>}
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-telefone`}>Telefone</label>
        <input id={`${prefixo}-telefone`} inputMode="tel" placeholder="(12) 90000-0000" {...register('telefone')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-situacao`}>Situação</label>
        <select id={`${prefixo}-situacao`} {...register('situacao')}>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <span className="dica">Só alunos ativos recebem a mensalidade automática.</span>
      </div>
    </>
  )
}

export default CamposDoAluno

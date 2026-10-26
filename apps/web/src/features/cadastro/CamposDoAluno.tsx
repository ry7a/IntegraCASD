import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { useListarTurmas } from '@integracasd/api-client'
import type { FormularioDoAluno } from './esquema-do-aluno'
import { ROTULO_DO_CURSO, ROTULO_DO_POSTO } from './rotulos'

interface Props {
  prefixo: string
  register: UseFormRegister<FormularioDoAluno>
  erros: FieldErrors<FormularioDoAluno>
}

// Os campos do formulário de aluno, iguais no diálogo "Novo aluno" e na aba "Dados".
// `prefixo` evita ids repetidos quando os dois existem na mesma página.
function CamposDoAluno({ prefixo, register, erros }: Props) {
  // Turmas já cadastradas viram sugestões; uma turma nova (ex.: T30) é criada ao salvar.
  const turmas = useListarTurmas().data?.itens ?? []

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
        <label htmlFor={`${prefixo}-email`}>E-mail</label>
        <input id={`${prefixo}-email`} type="email" aria-invalid={!!erros.email} {...register('email')} />
        {erros.email && <span className="dica" role="alert">{erros.email.message}</span>}
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-celular`}>Celular</label>
        <input id={`${prefixo}-celular`} inputMode="tel" placeholder="(12) 90000-0000" {...register('celular')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-apelido`}>Apelido</label>
        <input id={`${prefixo}-apelido`} {...register('apelido')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-matricula`}>Matrícula</label>
        <input id={`${prefixo}-matricula`} inputMode="numeric" aria-invalid={!!erros.matricula} {...register('matricula')} />
        {erros.matricula && <span className="dica" role="alert">{erros.matricula.message}</span>}
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-turma`}>Turma</label>
        <input id={`${prefixo}-turma`} placeholder="T28" list={`${prefixo}-turmas`} {...register('turma')} />
        <datalist id={`${prefixo}-turmas`}>
          {turmas.map((turma) => (
            <option key={turma} value={turma} />
          ))}
        </datalist>
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-curso`}>Curso</label>
        <select id={`${prefixo}-curso`} {...register('curso')}>
          <option value="">Não informado</option>
          {Object.entries(ROTULO_DO_CURSO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-posto`}>Posto</label>
        <select id={`${prefixo}-posto`} {...register('posto')}>
          <option value="">Não informado</option>
          {Object.entries(ROTULO_DO_POSTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {/* Alojamento = uma vaga: bloco, apartamento e vaga juntos. */}
      <div className="campo">
        <label htmlFor={`${prefixo}-bloco`}>Alojamento: bloco</label>
        <input id={`${prefixo}-bloco`} placeholder="A" {...register('bloco')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-apto`}>Alojamento: apartamento</label>
        <input id={`${prefixo}-apto`} placeholder="101" {...register('apto')} />
      </div>
      <div className="campo">
        <label htmlFor={`${prefixo}-vaga`}>Alojamento: vaga</label>
        <input id={`${prefixo}-vaga`} placeholder="1" {...register('vaga')} />
        <span className="dica">Preencha bloco, apartamento e vaga juntos, ou deixe os três em branco.</span>
      </div>
    </>
  )
}

export default CamposDoAluno

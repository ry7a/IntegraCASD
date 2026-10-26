import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  getListarFuncionariosQueryKey,
  useAlterarFuncionario,
  useCriarFuncionario,
  type FuncionarioDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarCpf, formatarValorParaCampo, paraCentavos } from '@/compartilhado/formatacao'

// Validação só para retorno rápido; a que vale (dígito do CPF, CPF repetido, datas) é a da API.
const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  cpf: z
    .string()
    .refine((texto) => texto.replace(/\D/g, '').length === 11, 'O CPF precisa ter 11 números, por exemplo 000.000.000-00.'),
  cargo: z.string().trim().min(2, 'Informe o cargo.'),
  salario: z
    .string()
    .refine((texto) => paraCentavos(texto) >= 0, 'Informe o salário de referência, por exemplo R$ 2.450,00.'),
  dataAdmissao: z.string().min(1, 'Informe a data de admissão.'),
  dataDesligamento: z.string(),
})
type Formulario = z.infer<typeof esquema>

interface Props {
  // Nulo = novo funcionário.
  funcionario: FuncionarioDto | null
  aoFechar: () => void
}

// [Cadastros.RF002] Inclusão e alteração de funcionário. Desligar = informar a data de desligamento:
// a partir dela o funcionário fica inativo (fluxo A1). Apagar a data readmite.
function DialogoFuncionario({ funcionario, aoFechar }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: funcionario
      ? {
          nome: funcionario.nome,
          cpf: formatarCpf(funcionario.cpf),
          cargo: funcionario.cargo,
          salario: formatarValorParaCampo(funcionario.salarioReferenciaCentavos),
          dataAdmissao: funcionario.dataAdmissao,
          dataDesligamento: funcionario.dataDesligamento ?? '',
        }
      : { nome: '', cpf: '', cargo: '', salario: '', dataAdmissao: '', dataDesligamento: '' },
  })
  const erros = formState.errors
  const criar = useCriarFuncionario()
  const alterar = useAlterarFuncionario()
  const queryClient = useQueryClient()
  const mutacao = funcionario ? alterar : criar

  async function salvar(dados: Formulario) {
    const corpo = {
      nome: dados.nome,
      cpf: dados.cpf,
      cargo: dados.cargo,
      salarioReferenciaCentavos: paraCentavos(dados.salario),
      dataAdmissao: dados.dataAdmissao,
      dataDesligamento: dados.dataDesligamento === '' ? null : dados.dataDesligamento,
    }
    try {
      if (funcionario) await alterar.mutateAsync({ id: funcionario.id, data: corpo })
      else await criar.mutateAsync({ data: corpo })
      await queryClient.invalidateQueries({ queryKey: getListarFuncionariosQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={funcionario ? 'Editar funcionário' : 'Novo funcionário'}
      descricao="O salário de referência é informativo: o pagamento é lançado como movimentação de saída."
      aoEnviar={(evento) => void handleSubmit(salvar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando…' : 'Salvar funcionário'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="fu-nome">Nome completo</label>
          <input id="fu-nome" aria-invalid={!!erros.nome} {...register('nome')} />
          {erros.nome && <span className="dica" role="alert">{erros.nome.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="fu-cpf">CPF</label>
          <input id="fu-cpf" inputMode="numeric" placeholder="000.000.000-00" aria-invalid={!!erros.cpf} {...register('cpf')} />
          {erros.cpf && <span className="dica" role="alert">{erros.cpf.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="fu-cargo">Cargo</label>
          <input id="fu-cargo" aria-invalid={!!erros.cargo} {...register('cargo')} />
          {erros.cargo && <span className="dica" role="alert">{erros.cargo.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="fu-salario">Salário de referência</label>
          <input id="fu-salario" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.salario} {...register('salario')} />
          {erros.salario && <span className="dica" role="alert">{erros.salario.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="fu-admissao">Admissão</label>
          <input id="fu-admissao" type="date" aria-invalid={!!erros.dataAdmissao} {...register('dataAdmissao')} />
          {erros.dataAdmissao && <span className="dica" role="alert">{erros.dataAdmissao.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="fu-desligamento">Desligamento</label>
          <input id="fu-desligamento" type="date" {...register('dataDesligamento')} />
          <span className="dica">Inativa a partir desta data. Deixe em branco para manter (ou readmitir) o funcionário.</span>
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

export default DialogoFuncionario

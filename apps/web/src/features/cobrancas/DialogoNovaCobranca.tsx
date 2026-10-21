import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useListarAlunos } from '@integracasd/api-client'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { paraCentavos } from '@/compartilhado/formatacao'

// Zod descreve o formato do formulário e as mensagens de erro. É só retorno rápido ao usuário:
// a validação que vale é a da API ([Cobranças.RF003]).
const esquema = z.object({
  aluno: z.string().min(1, 'Informe o aluno: digite o nome ou o CPF e escolha na lista.'),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe um valor maior que zero, por exemplo R$ 85,00.'),
  vencimento: z.string().min(1, 'Informe a data de vencimento.'),
  descricao: z.string().min(1, 'Descreva a cobrança, por exemplo: Camiseta do CASD.'),
})
type Formulario = z.infer<typeof esquema>

const VALORES_INICIAIS: Formulario = { aluno: '', valor: '', vencimento: '', descricao: '' }

interface Props {
  aberto: boolean
  alunoInicial: string
  aoFechar: () => void
}

function DialogoNovaCobranca({ aberto, alunoInicial, aoFechar }: Props) {
  // React Hook Form cuida do estado e dos erros dos campos; o zodResolver aplica o esquema acima.
  const { register, handleSubmit, reset, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: VALORES_INICIAIS,
  })

  // Cada vez que o diálogo abre, começa limpo (ou já com o aluno de quem abriu, como na tela do aluno).
  useEffect(() => {
    if (aberto) reset({ ...VALORES_INICIAIS, aluno: alunoInicial })
  }, [aberto, alunoInicial, reset])

  // Sugestões de aluno: hook REAL gerado pelo orval (GET /api/alunos), pedido só quando o diálogo abre.
  // TODO [Cobranças.RF003]: buscar por nome ou CPF no backend quando a lista aceitar o parâmetro de busca.
  const sugestoes = useListarAlunos({ query: { enabled: aberto } })

  const erros = formState.errors

  function emitir() {
    // TODO [Cobranças.RF003]: POST /api/cobrancas. O Asaas emite o boleto; se ele falhar, nada é gravado.
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova cobrança avulsa"
      descricao="O Asaas emite o boleto e envia por e-mail ao aluno."
      aoEnviar={(evento) => void handleSubmit(emitir)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal">
            Emitir cobrança
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="nc-aluno">Aluno</label>
          <input
            id="nc-aluno"
            list="nc-alunos-sugeridos"
            placeholder="Digite o nome ou o CPF"
            aria-invalid={!!erros.aluno}
            {...register('aluno')}
          />
          <datalist id="nc-alunos-sugeridos">
            {sugestoes.data?.itens.map((aluno) => <option key={aluno.id} value={aluno.nome} />)}
          </datalist>
          {erros.aluno && <span className="dica" role="alert">{erros.aluno.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="nc-valor">Valor</label>
          <input id="nc-valor" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.valor} {...register('valor')} />
          {erros.valor && <span className="dica" role="alert">{erros.valor.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="nc-vencimento">Vencimento</label>
          <input id="nc-vencimento" type="date" aria-invalid={!!erros.vencimento} {...register('vencimento')} />
          {erros.vencimento ? (
            <span className="dica" role="alert">{erros.vencimento.message}</span>
          ) : (
            <span className="dica">Sugerido pelos parâmetros de cobrança.</span>
          )}
        </div>
        <div className="campo inteiro">
          <label htmlFor="nc-descricao">Descrição</label>
          <input
            id="nc-descricao"
            placeholder="Ex.: Camiseta do CASD, inscrição no evento"
            aria-invalid={!!erros.descricao}
            {...register('descricao')}
          />
          {erros.descricao && <span className="dica" role="alert">{erros.descricao.message}</span>}
        </div>
      </div>
      <div className="aviso">
        <Icone nome="relogio" />
        <span>
          Multa de 2% e juros de 1% ao mês em caso de atraso, aplicados pelo Asaas conforme os parâmetros vigentes.
        </span>
      </div>
    </Dialogo>
  )
}

export default DialogoNovaCobranca

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useEmitirCobrancaAvulsa,
  useListarAlunos,
  useSugerirNovaCobranca,
  type AlunoDto,
  type CobrancaDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarCpf, formatarData, formatarMoeda, paraCentavos } from '@/compartilhado/formatacao'

// Zod descreve o formato do formulário e as mensagens de erro. É só retorno rápido ao usuário:
// a validação que vale é a da API ([Cobranças.RF002]).
const esquema = z.object({
  aluno: z.string().min(1, 'Informe o aluno: digite o nome ou o CPF e escolha na lista.'),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe um valor maior que zero, por exemplo R$ 85,00.'),
  vencimento: z.string().min(1, 'Informe a data de vencimento.'),
  descricao: z.string().trim().min(3, 'Descreva a cobrança, por exemplo: Camiseta do CASD.'),
})
type Formulario = z.infer<typeof esquema>

// Texto de cada sugestão de aluno: nome e CPF, para diferenciar homônimos.
function rotuloDoAluno(aluno: AlunoDto): string {
  return `${aluno.nome} (${formatarCpf(aluno.cpf)})`
}

// Acha o aluno escolhido: pelo texto da sugestão ou, se for único, só pelo nome (vindo da tela do aluno).
function acharAluno(alunos: AlunoDto[], texto: string): AlunoDto | undefined {
  const pelaSugestao = alunos.find((aluno) => rotuloDoAluno(aluno) === texto)
  if (pelaSugestao) return pelaSugestao
  const peloNome = alunos.filter((aluno) => aluno.nome === texto.trim())
  return peloNome.length === 1 ? peloNome[0] : undefined
}

interface Props {
  alunoInicial: string
  aoFechar: () => void
}

// [Cobranças.RF002] Nova cobrança avulsa. O Layout só monta este diálogo enquanto ele está aberto.
function DialogoNovaCobranca({ alunoInicial, aoFechar }: Props) {
  const sugestao = useSugerirNovaCobranca().data
  // Sugestões de aluno: os ativos (o filtro padrão da API).
  const alunos = useListarAlunos().data?.itens ?? []
  const emitir = useEmitirCobrancaAvulsa()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState, setError } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    // O vencimento sugerido chega depois; `values` atualiza o campo quando ele chegar.
    values: { aluno: alunoInicial, valor: '', vencimento: sugestao?.vencimentoSugerido ?? '', descricao: '' },
    resetOptions: { keepDirtyValues: true },
  })
  const erros = formState.errors

  async function enviar(formulario: Formulario) {
    const aluno = acharAluno(alunos, formulario.aluno)
    if (!aluno) {
      setError('aluno', { message: 'Escolha o aluno na lista de sugestões (nome e CPF).' })
      return
    }
    try {
      await emitir.mutateAsync({
        data: {
          alunoId: aluno.id,
          valorCentavos: paraCentavos(formulario.valor),
          vencimento: formulario.vencimento,
          descricao: formulario.descricao,
        },
      })
      // As listas de cobranças (e o resumo) passam a mostrar a nova cobrança.
      await queryClient.invalidateQueries({ predicate: (consulta) => String(consulta.queryKey[0]).includes('cobranca') })
    } catch {
      // A mensagem da API (ex.: cadastro incompleto, Asaas indisponível) aparece no diálogo.
    }
  }

  if (emitir.data) return <ConfirmacaoDeEmissao cobranca={emitir.data} aoFechar={aoFechar} />

  const semParametros = sugestao?.parametrosCadastrados === false

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Nova cobrança avulsa"
      descricao="O Asaas emite o boleto e envia por e-mail ao aluno."
      aoEnviar={(evento) => void handleSubmit(enviar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={emitir.isPending || semParametros}>
            {emitir.isPending ? 'Emitindo no Asaas…' : 'Emitir cobrança'}
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
            autoComplete="off"
            aria-invalid={!!erros.aluno}
            {...register('aluno')}
          />
          <datalist id="nc-alunos-sugeridos">
            {alunos.map((aluno) => (
              <option key={aluno.id} value={rotuloDoAluno(aluno)} />
            ))}
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
        {emitir.error && (
          <p className="erro-formulario inteiro" role="alert">
            {emitir.error.message}
          </p>
        )}
      </div>
      {semParametros ? (
        <div className="aviso aviso-perigo">
          <Icone nome="alerta" />
          <span>
            Os parâmetros de cobrança ainda não foram cadastrados. Peça à diretoria para cadastrá-los em Administração.
          </span>
        </div>
      ) : (
        sugestao && (
          <div className="aviso">
            <Icone nome="relogio" />
            <span>
              Multa de {sugestao.multaPercentual}% e juros de {sugestao.jurosMensalPercentual}% ao mês em caso de atraso,
              aplicados pelo Asaas conforme os parâmetros vigentes.
            </span>
          </div>
        )
      )}
    </Dialogo>
  )
}

// Passo 6 do requisito: confirmação com a opção de obter o boleto.
function ConfirmacaoDeEmissao({ cobranca, aoFechar }: { cobranca: CobrancaDto; aoFechar: () => void }) {
  const link = cobranca.urlBoleto ?? cobranca.urlFatura
  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Cobrança emitida"
      descricao="O Asaas enviou o boleto por e-mail ao aluno."
      rodape={
        <button type="submit" className="botao botao-principal">
          Fechar
        </button>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{cobranca.alunoNome}</dd>
          <dt>Descrição</dt>
          <dd>{cobranca.descricao}</dd>
          <dt>Valor</dt>
          <dd>{formatarMoeda(cobranca.valorCentavos)}</dd>
          <dt>Vencimento</dt>
          <dd>{formatarData(cobranca.vencimento)}</dd>
        </dl>
      </div>
      {link && (
        <p>
          <a className="botao" href={link} target="_blank" rel="noreferrer">
            <Icone nome="baixar" />
            Abrir o boleto
          </a>
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoNovaCobranca

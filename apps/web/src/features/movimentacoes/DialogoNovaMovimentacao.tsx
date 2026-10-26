import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { ROTULO_DA_FORMA } from '@/compartilhado/dominio'
import { formatarMoeda, hojeIso, paraCentavos } from '@/compartilhado/formatacao'
import { useOpcoesDaMovimentacao } from './consultas'

const esquema = z.object({
  tipo: z.enum(['SAIDA', 'ENTRADA']),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe um valor maior que zero, por exemplo R$ 1.200,00.'),
  data: z.string().min(1, 'Informe a data da movimentação.'),
  categoriaId: z.string(),
  forma: z.enum(['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO']),
  vinculoTipo: z.enum(['CONTRATO', 'PROJETO', 'FUNCIONARIO', 'NENHUM']),
  vinculoId: z.string(),
  descricao: z.string().min(1, 'Descreva a movimentação.'),
})
type Formulario = z.infer<typeof esquema>

const VALORES_INICIAIS: Formulario = {
  tipo: 'SAIDA',
  valor: '',
  data: '',
  categoriaId: '',
  forma: 'PIX',
  vinculoTipo: 'NENHUM',
  vinculoId: '',
  descricao: '',
}

const ROTULO_DO_VINCULO = { CONTRATO: 'Contrato', PROJETO: 'Projeto', FUNCIONARIO: 'Funcionário' }

// Completa a frase "Valor previsto no contrato: R$ X ...".
const SUFIXO_DA_PERIODICIDADE = {
  MENSAL: 'por mês',
  ANUAL: 'por ano',
  POR_DEMANDA: '(por demanda)',
  UNICA: '(pagamento único)',
}

interface Props {
  aberto: boolean
  aoFechar: () => void
}

function DialogoNovaMovimentacao({ aberto, aoFechar }: Props) {
  const { register, handleSubmit, reset, control, setValue, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: VALORES_INICIAIS,
  })

  useEffect(() => {
    if (aberto) reset({ ...VALORES_INICIAIS, data: hojeIso() })
  }, [aberto, reset])

  const opcoes = useOpcoesDaMovimentacao().data

  const vinculoTipo = useWatch({ control, name: 'vinculoTipo' })
  const vinculoId = useWatch({ control, name: 'vinculoId' })

  const opcoesDoVinculo =
    vinculoTipo === 'CONTRATO'
      ? opcoes?.contratos
      : vinculoTipo === 'PROJETO'
        ? opcoes?.projetos
        : vinculoTipo === 'FUNCIONARIO'
          ? opcoes?.funcionarios
          : []

  // Aviso do contrato escolhido: valor previsto e quanto já foi pago no ano.
  const contrato = vinculoTipo === 'CONTRATO' ? opcoes?.contratos.find((c) => c.id === vinculoId) : undefined

  const erros = formState.errors

  function registrar() {
    // TODO [Movimentações.RF001]: POST /api/movimentacoes, com auditoria.
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova movimentação"
      descricao="Lançamento manual de entrada ou saída (Pix, dinheiro, cartão, transferência)."
      aoEnviar={(evento) => void handleSubmit(registrar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal">
            Registrar movimentação
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <span className="rotulo-campo" id="nm-tipo">Tipo</span>
          <div className="segmentado" role="radiogroup" aria-labelledby="nm-tipo">
            <label>
              <input type="radio" value="SAIDA" {...register('tipo')} />
              Saída
            </label>
            <label>
              <input type="radio" value="ENTRADA" {...register('tipo')} />
              Entrada
            </label>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="nm-valor">Valor</label>
          <input id="nm-valor" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.valor} {...register('valor')} />
          {erros.valor && <span className="dica" role="alert">{erros.valor.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="nm-data">Data</label>
          <input id="nm-data" type="date" aria-invalid={!!erros.data} {...register('data')} />
          {erros.data && <span className="dica" role="alert">{erros.data.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="nm-categoria">Categoria</label>
          <select id="nm-categoria" {...register('categoriaId')}>
            <option value="">Sem categoria</option>
            {opcoes?.categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nm-forma">Forma de pagamento</label>
          <select id="nm-forma" {...register('forma')}>
            {(['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'] as const).map((forma) => (
              <option key={forma} value={forma}>{ROTULO_DA_FORMA[forma]}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nm-vinculo-tipo">Vincular a</label>
          <select
            id="nm-vinculo-tipo"
            {...register('vinculoTipo', { onChange: () => setValue('vinculoId', '') })}
          >
            <option value="CONTRATO">Contrato</option>
            <option value="PROJETO">Projeto</option>
            <option value="FUNCIONARIO">Funcionário</option>
            <option value="NENHUM">Nenhum</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nm-vinculo">{vinculoTipo === 'NENHUM' ? 'Vínculo' : ROTULO_DO_VINCULO[vinculoTipo]}</label>
          <select id="nm-vinculo" disabled={vinculoTipo === 'NENHUM'} {...register('vinculoId')}>
            <option value="">Escolha…</option>
            {opcoesDoVinculo?.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo inteiro">
          <label htmlFor="nm-descricao">Descrição</label>
          <input id="nm-descricao" aria-invalid={!!erros.descricao} {...register('descricao')} />
          {erros.descricao && <span className="dica" role="alert">{erros.descricao.message}</span>}
        </div>
      </div>
      {contrato && (
        <div className="aviso">
          <Icone nome="check" />
          <span>
            Valor previsto no contrato: <strong>{formatarMoeda(contrato.valorCentavos)}</strong>{' '}
            {SUFIXO_DA_PERIODICIDADE[contrato.periodicidade]}.
            Já pago neste contrato em 2026: <strong>{formatarMoeda(contrato.pagoNoAnoCentavos)}</strong>.
          </span>
        </div>
      )}
    </Dialogo>
  )
}

export default DialogoNovaMovimentacao

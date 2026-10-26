import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  useListarOpcoesDaMovimentacao,
  useRegistrarMovimentacao,
  type OpcoesDaMovimentacaoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { ROTULO_DA_FORMA } from '@/compartilhado/dominio'
import { formatarMoeda, hojeIso, paraCentavos } from '@/compartilhado/formatacao'

// Validação só para retorno rápido; a que vale (data futura, categoria compatível, vínculo único) é a da API.
const esquema = z.object({
  tipo: z.enum(['SAIDA', 'ENTRADA']),
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe um valor maior que zero, por exemplo R$ 1.200,00.'),
  data: z.string().min(1, 'Informe a data da movimentação.'),
  contaId: z.string().min(1, 'Escolha a conta.'),
  categoriaId: z.string().min(1, 'Escolha a categoria.'),
  forma: z.enum(['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO']),
  vinculoTipo: z.enum(['CONTRATO', 'PROJETO', 'FUNCIONARIO', 'NENHUM']),
  vinculoId: z.string(),
  descricao: z.string().trim().min(3, 'Descreva a movimentação, por exemplo: NF 685, limpeza de outubro.'),
})
type Formulario = z.infer<typeof esquema>

const ROTULO_DO_VINCULO = { CONTRATO: 'Contrato', PROJETO: 'Projeto', FUNCIONARIO: 'Funcionário' }

// Completa a frase "Valor previsto no contrato: R$ X ...".
const SUFIXO_DA_PERIODICIDADE = {
  MENSAL: 'por mês',
  ANUAL: 'por ano',
  POR_DEMANDA: '(por demanda)',
  UNICA: '(pagamento único)',
}

interface Props {
  aoFechar: () => void
}

// [Movimentações.RF001] Aberta pela barra superior de qualquer tela. Montada só enquanto aberta:
// cada abertura começa com a data de hoje e a conta corrente sugeridas.
function DialogoNovaMovimentacao({ aoFechar }: Props) {
  const opcoes = useListarOpcoesDaMovimentacao()

  if (!opcoes.data) {
    return (
      <Dialogo
        aberto
        aoFechar={aoFechar}
        titulo="Nova movimentação"
        rodape={
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
        }
      >
        <p className="texto-apoio" role="status">
          {opcoes.error ? opcoes.error.message : 'Carregando contas e categorias…'}
        </p>
      </Dialogo>
    )
  }
  return <FormularioDaMovimentacao opcoes={opcoes.data} aoFechar={aoFechar} />
}

function FormularioDaMovimentacao({ opcoes, aoFechar }: { opcoes: OpcoesDaMovimentacaoDto; aoFechar: () => void }) {
  const contaSugerida = opcoes.contas.find((conta) => conta.tipo === 'CORRENTE') ?? opcoes.contas[0]
  const { register, handleSubmit, control, setValue, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      tipo: 'SAIDA',
      valor: '',
      data: hojeIso(),
      contaId: contaSugerida?.id ?? '',
      categoriaId: '',
      forma: 'PIX',
      vinculoTipo: 'NENHUM',
      vinculoId: '',
      descricao: '',
    },
  })
  const registrar = useRegistrarMovimentacao()
  const queryClient = useQueryClient()
  const [aviso, definirAviso] = useState<string | null>(null)

  const [tipo, vinculoTipo, vinculoId] = useWatch({ control, name: ['tipo', 'vinculoTipo', 'vinculoId'] })
  // Só as categorias que aceitam o tipo escolhido (a API confere de novo).
  const categorias = opcoes.categorias.filter((categoria) => categoria.tipo === 'AMBOS' || categoria.tipo === tipo)
  const opcoesDoVinculo =
    vinculoTipo === 'CONTRATO'
      ? opcoes.contratos
      : vinculoTipo === 'PROJETO'
        ? opcoes.projetos
        : vinculoTipo === 'FUNCIONARIO'
          ? opcoes.funcionarios
          : []
  // Fluxo A1: valor previsto do contrato e quanto já foi pago no ano.
  const contrato = vinculoTipo === 'CONTRATO' ? opcoes.contratos.find((item) => item.id === vinculoId) : undefined
  // Fluxo A2: projeto executado aceita lançamento, mas avisa.
  const projetoExecutado = vinculoTipo === 'PROJETO' && opcoes.projetos.find((item) => item.id === vinculoId)?.encerrado

  const erros = formState.errors

  async function enviar(dados: Formulario) {
    const vinculo = dados.vinculoTipo !== 'NENHUM' && dados.vinculoId ? dados.vinculoId : null
    try {
      const registrada = await registrar.mutateAsync({
        data: {
          contaId: dados.contaId,
          tipo: dados.tipo,
          valorCentavos: paraCentavos(dados.valor),
          data: dados.data,
          categoriaId: dados.categoriaId,
          forma: dados.forma,
          descricao: dados.descricao,
          contratoId: dados.vinculoTipo === 'CONTRATO' ? vinculo : null,
          projetoId: dados.vinculoTipo === 'PROJETO' ? vinculo : null,
          funcionarioId: dados.vinculoTipo === 'FUNCIONARIO' ? vinculo : null,
        },
      })
      // A lista, os totais e os indicadores mudam.
      await queryClient.invalidateQueries()
      if (registrada.aviso) definirAviso(registrada.aviso)
      else aoFechar()
    } catch {
      // A mensagem da API aparece no diálogo.
    }
  }

  if (aviso) {
    return (
      <Dialogo
        aberto
        aoFechar={aoFechar}
        titulo="Movimentação registrada"
        rodape={
          <button type="button" className="botao botao-principal" onClick={aoFechar}>
            Fechar
          </button>
        }
      >
        <div className="aviso" role="status">
          <Icone nome="alerta" />
          <span>{aviso}</span>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Nova movimentação"
      descricao="Lançamento manual de entrada ou saída (Pix, dinheiro, cartão, transferência)."
      aoEnviar={(evento) => void handleSubmit(enviar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={registrar.isPending}>
            {registrar.isPending ? 'Registrando…' : 'Registrar movimentação'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <span className="rotulo-campo" id="nm-tipo">
            Tipo
          </span>
          <div className="segmentado" role="radiogroup" aria-labelledby="nm-tipo">
            <label>
              <input type="radio" value="SAIDA" {...register('tipo', { onChange: () => setValue('categoriaId', '') })} />
              Saída
            </label>
            <label>
              <input type="radio" value="ENTRADA" {...register('tipo', { onChange: () => setValue('categoriaId', '') })} />
              Entrada
            </label>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="nm-valor">Valor</label>
          <input id="nm-valor" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.valor} {...register('valor')} />
          {erros.valor && (
            <span className="dica" role="alert">
              {erros.valor.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="nm-data">Data</label>
          <input id="nm-data" type="date" max={hojeIso()} aria-invalid={!!erros.data} {...register('data')} />
          {erros.data && (
            <span className="dica" role="alert">
              {erros.data.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="nm-conta">Conta</label>
          <select id="nm-conta" aria-invalid={!!erros.contaId} {...register('contaId')}>
            {opcoes.contas.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
            {opcoes.contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </select>
          {erros.contaId && (
            <span className="dica" role="alert">
              {erros.contaId.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="nm-categoria">Categoria</label>
          <select id="nm-categoria" aria-invalid={!!erros.categoriaId} {...register('categoriaId')}>
            <option value="">Escolha…</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
          {erros.categoriaId && (
            <span className="dica" role="alert">
              {erros.categoriaId.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="nm-forma">Forma de pagamento</label>
          <select id="nm-forma" {...register('forma')}>
            {(['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'] as const).map((forma) => (
              <option key={forma} value={forma}>
                {ROTULO_DA_FORMA[forma]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nm-vinculo-tipo">Vincular a</label>
          <select id="nm-vinculo-tipo" {...register('vinculoTipo', { onChange: () => setValue('vinculoId', '') })}>
            <option value="NENHUM">Nenhum</option>
            <option value="CONTRATO">Contrato</option>
            <option value="PROJETO">Projeto</option>
            <option value="FUNCIONARIO">Funcionário</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nm-vinculo">{vinculoTipo === 'NENHUM' ? 'Vínculo' : ROTULO_DO_VINCULO[vinculoTipo]}</label>
          <select id="nm-vinculo" disabled={vinculoTipo === 'NENHUM'} {...register('vinculoId')}>
            <option value="">Escolha…</option>
            {opcoesDoVinculo.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo inteiro">
          <label htmlFor="nm-descricao">Descrição</label>
          <input id="nm-descricao" aria-invalid={!!erros.descricao} {...register('descricao')} />
          {erros.descricao && (
            <span className="dica" role="alert">
              {erros.descricao.message}
            </span>
          )}
        </div>
      </div>
      {contrato && (
        <div className="aviso">
          <Icone nome="check" />
          <span>
            Valor previsto no contrato: <strong>{formatarMoeda(contrato.valorCentavos)}</strong>{' '}
            {SUFIXO_DA_PERIODICIDADE[contrato.periodicidade]}. Já pago neste contrato no ano:{' '}
            <strong>{formatarMoeda(contrato.pagoNoAnoCentavos)}</strong>.
          </span>
        </div>
      )}
      {projetoExecutado && (
        <div className="aviso">
          <Icone nome="alerta" />
          <span>Este projeto já foi executado. O lançamento é aceito, mas confira se é mesmo deste projeto.</span>
        </div>
      )}
      {registrar.error && (
        <p className="erro-formulario" role="alert">
          {registrar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoNovaMovimentacao

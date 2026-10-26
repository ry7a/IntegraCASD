import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  getBuscarParametrosDeCobrancaQueryKey,
  getListarExecucoesDaGeracaoQueryKey,
  useAlterarParametrosDeCobranca,
  useBuscarParametrosDeCobranca,
  useConferirParametrosDeCobranca,
  useListarExecucoesDaGeracao,
  usePedirGeracaoAgora,
  type ConferenciaDto,
  type ExecucaoGeracaoDto,
  type ParametrosDeCobrancaDto,
  type ParametrosVigentesDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import {
  formatarData,
  formatarDataHora,
  formatarHora,
  formatarInteiro,
  formatarMes,
  formatarMoeda,
  formatarValorParaCampo,
  paraCentavos,
} from '@/compartilhado/formatacao'

// Validação só para retorno rápido; a que vale (limites legais, geração antes do vencimento) é a da API.
const inteiro = (mensagem: string) => z.string().refine((texto) => /^\d+$/.test(texto.trim()), mensagem)
const esquema = z.object({
  valor: z.string().refine((texto) => paraCentavos(texto) > 0, 'Informe o valor da mensalidade, por exemplo R$ 85,00.'),
  diaVencimento: inteiro('Informe o dia de vencimento, de 1 a 28.'),
  diaGeracao: inteiro('Informe o dia de geração, de 1 a 28.'),
  multaPercentual: inteiro('Informe a multa em % inteiro, de 0 a 2.'),
  jurosMensalPercentual: inteiro('Informe os juros em % inteiro ao mês, de 0 a 1.'),
})
type Formulario = z.infer<typeof esquema>

function paraFormulario(vigentes: ParametrosVigentesDto | null): Formulario {
  if (vigentes === null) {
    return { valor: '', diaVencimento: '10', diaGeracao: '1', multaPercentual: '2', jurosMensalPercentual: '1' }
  }
  return {
    valor: formatarValorParaCampo(vigentes.valorMensalidadeCentavos),
    diaVencimento: String(vigentes.diaVencimento),
    diaGeracao: String(vigentes.diaGeracao),
    multaPercentual: String(vigentes.multaPercentual),
    jurosMensalPercentual: String(vigentes.jurosMensalPercentual),
  }
}

function paraCorpo(formulario: Formulario): ParametrosDeCobrancaDto {
  return {
    valorMensalidadeCentavos: paraCentavos(formulario.valor),
    diaVencimento: Number(formulario.diaVencimento),
    diaGeracao: Number(formulario.diaGeracao),
    multaPercentual: Number(formulario.multaPercentual),
    jurosMensalPercentual: Number(formulario.jurosMensalPercentual),
  }
}

// Parâmetros das cobranças recorrentes. [Administração.RF003]
function AbaParametros() {
  const consulta = useBuscarParametrosDeCobranca()
  const dados = consulta.data

  return (
    <EstadoDaConsulta carregando={consulta.isPending} erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()}>
      {dados && (
        <div className="grade grade-2-1">
          {/* `key` recria o formulário quando os vigentes mudam (depois de salvar). */}
          <FormularioDeParametros key={dados.vigentes?.alteradoEm ?? 'novo'} vigentes={dados.vigentes} />
          <ConferenciaDosParametros conferencia={dados.conferencia} />
        </div>
      )}
    </EstadoDaConsulta>
  )
}

function FormularioDeParametros({ vigentes }: { vigentes: ParametrosVigentesDto | null }) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: paraFormulario(vigentes),
  })
  const erros = formState.errors
  const conferir = useConferirParametrosDeCobranca()
  // Valores conferidos, à espera da confirmação no diálogo (passos 4 e 5 do requisito).
  const [aConfirmar, definirAConfirmar] = useState<{ corpo: ParametrosDeCobrancaDto; conferencia: ConferenciaDto } | null>(null)

  async function conferirAntesDeSalvar(formulario: Formulario) {
    const corpo = paraCorpo(formulario)
    try {
      const conferencia = await conferir.mutateAsync({ data: corpo })
      definirAConfirmar({ corpo, conferencia })
    } catch {
      // A mensagem da API (ex.: geração depois do vencimento) aparece abaixo do formulário.
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h2>Mensalidade</h2>
          <p>
            {vigentes
              ? `Última alteração em ${formatarDataHora(vigentes.alteradoEm)} por ${vigentes.alteradoPor}`
              : 'Ainda não há parâmetros: a geração recorrente só começa depois deste cadastro.'}
          </p>
        </div>
      </div>
      <form className="formulario" noValidate onSubmit={(evento) => void handleSubmit(conferirAntesDeSalvar)(evento)}>
        <div className="campo">
          <label htmlFor="pa-valor">Valor da mensalidade</label>
          <input id="pa-valor" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={!!erros.valor} {...register('valor')} />
          {erros.valor && <span className="dica" role="alert">{erros.valor.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="pa-vencimento">Dia de vencimento</label>
          <input id="pa-vencimento" type="number" min={1} max={28} aria-invalid={!!erros.diaVencimento} {...register('diaVencimento')} />
          {erros.diaVencimento && <span className="dica" role="alert">{erros.diaVencimento.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="pa-geracao">Dia de geração</label>
          <input id="pa-geracao" type="number" min={1} max={28} aria-invalid={!!erros.diaGeracao} {...register('diaGeracao')} />
          <span className="dica" role={erros.diaGeracao ? 'alert' : undefined}>
            {erros.diaGeracao?.message ?? 'Precisa ser antes do dia de vencimento.'}
          </span>
        </div>
        <div className="campo"></div>
        <div className="campo">
          <label htmlFor="pa-multa">Multa por atraso (%)</label>
          <input id="pa-multa" type="number" min={0} max={2} aria-invalid={!!erros.multaPercentual} {...register('multaPercentual')} />
          {erros.multaPercentual && <span className="dica" role="alert">{erros.multaPercentual.message}</span>}
        </div>
        <div className="campo">
          <label htmlFor="pa-juros">Juros ao mês (%)</label>
          <input
            id="pa-juros"
            type="number"
            min={0}
            max={1}
            aria-invalid={!!erros.jurosMensalPercentual}
            {...register('jurosMensalPercentual')}
          />
          <span className="dica" role={erros.jurosMensalPercentual ? 'alert' : undefined}>
            {erros.jurosMensalPercentual?.message ?? 'Multa e juros são calculados pelo Asaas no pagamento.'}
          </span>
        </div>
        {conferir.error && (
          <p className="erro-formulario inteiro" role="alert">
            {conferir.error.message}
          </p>
        )}
        <div className="aviso inteiro">
          <Icone nome="alerta" />
          <span>
            Um novo valor vale só para as próximas cobranças. As já emitidas, inclusive as vencidas, mantêm o valor
            anterior.
          </span>
        </div>
        <div className="inteiro" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="botao botao-principal" disabled={conferir.isPending}>
            {conferir.isPending ? 'Conferindo…' : 'Conferir e salvar'}
          </button>
        </div>
      </form>
      {aConfirmar && (
        <DialogoConfirmarParametros
          corpo={aConfirmar.corpo}
          conferencia={aConfirmar.conferencia}
          aoFechar={() => definirAConfirmar(null)}
        />
      )}
    </div>
  )
}

interface PropsDoDialogo {
  corpo: ParametrosDeCobrancaDto
  conferencia: ConferenciaDto
  aoFechar: () => void
}

// Passo 4 e 5 do requisito: mostra o efeito e só grava quando o usuário confirma.
function DialogoConfirmarParametros({ corpo, conferencia, aoFechar }: PropsDoDialogo) {
  const alterar = useAlterarParametrosDeCobranca()
  const queryClient = useQueryClient()

  async function confirmar() {
    try {
      await alterar.mutateAsync({ data: corpo })
      await queryClient.invalidateQueries({ queryKey: getBuscarParametrosDeCobrancaQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Salvar os parâmetros?"
      descricao="Confira o efeito na próxima geração antes de confirmar."
      aoEnviar={(evento) => {
        evento.preventDefault()
        void confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-principal" disabled={alterar.isPending}>
            {alterar.isPending ? 'Salvando…' : 'Salvar parâmetros'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <dl>
          <dt>Mensalidade</dt>
          <dd>{formatarMoeda(corpo.valorMensalidadeCentavos)}</dd>
          <dt>Próxima geração</dt>
          <dd>{formatarData(conferencia.proximaGeracao)}</dd>
          <dt>Vencimento</dt>
          <dd>{formatarData(conferencia.proximoVencimento)}</dd>
          <dt>Alunos que serão cobrados</dt>
          <dd>{formatarInteiro(conferencia.alunosCobrados)}</dd>
          <dt>Total previsto</dt>
          <dd>{formatarMoeda(conferencia.totalPrevistoCentavos)}</dd>
        </dl>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>As cobranças já emitidas mantêm o valor e as condições anteriores.</li>
          <li>A alteração fica registrada na trilha de auditoria.</li>
        </ul>
      </div>
      {alterar.error && (
        <p className="erro-formulario" role="alert">
          {alterar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

function ConferenciaDosParametros({ conferencia }: { conferencia: ConferenciaDto | null }) {
  return (
    <div className="cartao">
      <h2>Conferência</h2>
      {conferencia === null ? (
        <p className="texto-apoio">Cadastre os parâmetros para ver a próxima geração.</p>
      ) : (
        <ul className="lista-linhas" style={{ marginTop: 8 }}>
          <li>
            <span>Próxima geração</span>
            <span className="numero">{formatarData(conferencia.proximaGeracao)}</span>
          </li>
          <li>
            <span>Vencimento</span>
            <span className="numero">{formatarData(conferencia.proximoVencimento)}</span>
          </li>
          <li>
            <span>Alunos que serão cobrados</span>
            <span className="numero">{formatarInteiro(conferencia.alunosCobrados)}</span>
          </li>
          <li>
            <span>Total previsto</span>
            <span className="numero">{formatarMoeda(conferencia.totalPrevistoCentavos)}</span>
          </li>
        </ul>
      )}
      <UltimasExecucoes />
    </div>
  )
}

// [Cobranças.RF001] e [Confiabilidade.NF007]: o que a geração recorrente fez em cada execução. O botão
// gera de novo só os pendentes do mês (fluxo A2), depois de corrigidos os cadastros.
function UltimasExecucoes() {
  const consulta = useListarExecucoesDaGeracao()
  const pedir = usePedirGeracaoAgora()
  const queryClient = useQueryClient()
  const execucoes = consulta.data?.itens ?? []

  async function gerarPendentes() {
    try {
      await pedir.mutateAsync()
      // A geração roda no worker; em alguns segundos a nova execução aparece na lista.
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: getListarExecucoesDaGeracaoQueryKey() }), 5000)
    } catch {
      // Mensagem da API abaixo do botão.
    }
  }

  return (
    <>
      <h3 style={{ marginTop: 18 }}>Últimas execuções</h3>
      {execucoes.length === 0 ? (
        <p className="texto-apoio">Nenhuma execução registrada.</p>
      ) : (
        <ul className="lista-linhas">
          {execucoes.map((execucao) => (
            <ItemDaExecucao key={execucao.id} execucao={execucao} />
          ))}
        </ul>
      )}
      <button type="button" className="botao" style={{ marginTop: 12 }} disabled={pedir.isPending} onClick={() => void gerarPendentes()}>
        <Icone nome="sincronizar" />
        {pedir.isPending ? 'Pedindo…' : 'Gerar pendentes agora'}
      </button>
      {pedir.isSuccess && (
        <p className="texto-apoio" role="status">
          Geração de {formatarMes(pedir.data.referencia)} pedida. Quem já tem a mensalidade do mês é pulado.
        </p>
      )}
      {pedir.error && (
        <p className="erro-formulario" role="alert">
          {pedir.error.message}
        </p>
      )}
    </>
  )
}

function ItemDaExecucao({ execucao }: { execucao: ExecucaoGeracaoDto }) {
  return (
    <li style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>
          {formatarMes(execucao.referencia)} · {formatarDataHora(execucao.iniciadaEm)}
          {execucao.finalizadaEm && ` a ${formatarHora(execucao.finalizadaEm)}`}
          <span className="secundario">
            {execucao.totalProcessado} criadas · {execucao.totalJaExistentes} já existiam ·{' '}
            {execucao.totalFalhas === 0 ? 'nenhuma falha' : `${execucao.totalFalhas} falharam`}
            {execucao.origem === 'MANUAL' && ' · pedida manualmente'}
          </span>
        </span>
        {execucao.interrompida ? (
          <span className="selo selo-alerta">
            <Icone nome="alerta" />
            Interrompida
          </span>
        ) : execucao.totalFalhas > 0 ? (
          <span className="selo selo-alerta">Com falhas</span>
        ) : (
          <span className="selo selo-paga">
            <Icone nome="check" />
            Concluída
          </span>
        )}
      </span>
      {execucao.falhas.length > 0 && (
        <details>
          <summary>Ver falhas</summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {execucao.falhas.map((falha, indice) => (
              <li key={`${falha.alunoId}-${indice}`}>
                <strong>{falha.alunoNome}</strong>: {falha.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

export default AbaParametros

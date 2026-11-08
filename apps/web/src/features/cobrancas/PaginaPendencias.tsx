import { useState } from 'react'
import { Link } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useListarPendenciasDeConciliacao,
  useResolverPendenciaDeConciliacao,
  type PendenciaDto,
  type TipoPendencia,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { Abas, PainelDaAba } from '@/compartilhado/componentes/Abas'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarDataHora, formatarMes } from '@/compartilhado/formatacao'

const ROTULO_DO_TIPO: Record<TipoPendencia, string> = {
  SEM_COBRANCA: 'Sem cobrança aqui',
  APOS_REGISTRO_MANUAL: 'Após registro manual',
  DIVERGENCIA: 'Divergência',
}

const ABAS = [
  { id: 'abertas', titulo: 'Abertas' },
  { id: 'resolvidas', titulo: 'Resolvidas' },
] as const
type IdDaAba = (typeof ABAS)[number]['id']

// Fila única de pendências de conciliação [Cobranças.RF005] fluxo E1: avisos do Asaas sem cobrança
// aqui, pagamentos depois de registro manual, divergências da sincronização e falhas da geração.
function PaginaPendencias() {
  const [aba, definirAba] = useState<IdDaAba>('abertas')

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Pendências de conciliação</h1>
          <p>O que o sistema não conseguiu conciliar sozinho e precisa de conferência.</p>
        </div>
        <div className="acoes">
          <Link className="botao" to="/cobrancas">
            <Icone nome="voltar" />
            Voltar para cobranças
          </Link>
        </div>
      </div>
      <Abas abas={ABAS} atual={aba} aoMudar={definirAba} rotulo="Pendências" />
      <PainelDaAba id={aba}>
        <ListaDePendencias key={aba} resolvidas={aba === 'resolvidas'} />
      </PainelDaAba>
    </>
  )
}

function ListaDePendencias({ resolvidas }: { resolvidas: boolean }) {
  const consulta = useListarPendenciasDeConciliacao({ resolvidas })
  const [aResolver, definirAResolver] = useState<PendenciaDto | null>(null)
  const itens = consulta.data?.itens ?? []
  const falhas = consulta.data?.falhasDaGeracao ?? []

  return (
    <EstadoDaConsulta
      carregando={consulta.isPending}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      vazio={itens.length === 0 && falhas.length === 0}
      mensagemVazia={resolvidas ? 'Nenhuma pendência resolvida ainda.' : 'Nenhuma pendência aberta: tudo conciliado.'}
    >
      {itens.length > 0 && (
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>{resolvidas ? 'Resolvida em' : 'Desde'}</th>
                <th>Tipo</th>
                <th>O que aconteceu</th>
                <th>Cobrança</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((pendencia) => (
                <tr key={pendencia.id}>
                  <td>
                    {formatarDataHora(resolvidas && pendencia.resolvidaEm ? pendencia.resolvidaEm : pendencia.criadaEm)}
                    <span className="secundario">{pendencia.origem === 'WEBHOOK' ? 'Aviso do Asaas' : 'Sincronização'}</span>
                  </td>
                  <td>
                    <span className={pendencia.tipo === 'APOS_REGISTRO_MANUAL' ? 'selo selo-manual' : 'selo selo-alerta'}>
                      {ROTULO_DO_TIPO[pendencia.tipo]}
                    </span>
                  </td>
                  <td>
                    {pendencia.descricao}
                    {pendencia.resolucao && (
                      <span className="secundario">
                        Resolução de {pendencia.resolvidaPor}: {pendencia.resolucao}
                      </span>
                    )}
                  </td>
                  <td>
                    {pendencia.cobrancaId ? (
                      <Link to={`/cobrancas/${pendencia.cobrancaId}`}>{pendencia.alunoNome ?? 'Ver cobrança'}</Link>
                    ) : (
                      <span className="secundario">{pendencia.idAsaas} (só no Asaas)</span>
                    )}
                  </td>
                  <td className="acoes">
                    {!resolvidas && (
                      <button type="button" className="botao botao-pequeno" onClick={() => definirAResolver(pendencia)}>
                        <Icone nome="check" />
                        Marcar como resolvida
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {falhas.length > 0 && (
        <div className="cartao" style={{ marginTop: 16 }}>
          <h2>Falhas da geração recorrente</h2>
          <p className="texto-apoio">
            Corrija o cadastro do aluno e peça a geração de novo em Administração › Parâmetros (Gerar pendentes agora).
          </p>
          <ul className="lista-linhas limite-leitura">
            {falhas.map((falha) => (
              <li key={`${falha.referencia}-${falha.alunoId}-${falha.motivo}`}>
                <span>
                  {falha.alunoId ? <Link to={`/cadastros/alunos/${falha.alunoId}`}>{falha.alunoNome}</Link> : falha.alunoNome}
                  <span className="secundario">
                    Mensalidade de {formatarMes(falha.referencia)}: {falha.motivo}
                  </span>
                </span>
                <span className="secundario">{formatarDataHora(falha.ocorridaEm)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aResolver && <DialogoResolver pendencia={aResolver} aoFechar={() => definirAResolver(null)} />}
    </EstadoDaConsulta>
  )
}

const esquema = z.object({
  resolucao: z.string().trim().min(5, 'Escreva o que foi conferido e decidido.'),
})
type Formulario = z.infer<typeof esquema>

function DialogoResolver({ pendencia, aoFechar }: { pendencia: PendenciaDto; aoFechar: () => void }) {
  const { register, handleSubmit, formState } = useForm<Formulario>({ resolver: zodResolver(esquema), defaultValues: { resolucao: '' } })
  const resolver = useResolverPendenciaDeConciliacao()
  const queryClient = useQueryClient()

  async function confirmar(dados: Formulario) {
    try {
      await resolver.mutateAsync({ id: pendencia.id, data: dados })
      // A fila e o contador da lista de cobranças mudam.
      await queryClient.invalidateQueries()
      aoFechar()
    } catch {
      // A mensagem da API aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Marcar pendência como resolvida"
      descricao="Registre o que foi conferido. O texto fica na trilha de auditoria."
      aoEnviar={(evento) => void handleSubmit(confirmar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-principal" disabled={resolver.isPending}>
            {resolver.isPending ? 'Salvando…' : 'Marcar como resolvida'}
          </button>
        </>
      }
    >
      <div className="resumo-efeito">
        <p>{pendencia.descricao}</p>
      </div>
      <div className="campo">
        <label htmlFor="pe-resolucao">O que foi feito</label>
        <textarea
          id="pe-resolucao"
          placeholder="Ex.: pagamento em duplicidade devolvido ao aluno pelo Asaas em 28/10"
          aria-invalid={!!formState.errors.resolucao}
          {...register('resolucao')}
        />
        {formState.errors.resolucao && (
          <span className="dica" role="alert">
            {formState.errors.resolucao.message}
          </span>
        )}
      </div>
      {resolver.error && (
        <p className="erro-formulario" role="alert">
          {resolver.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default PaginaPendencias

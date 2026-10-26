import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSincronizarCobrancas, type SincronizacaoDto } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarDataHora, hojeIso } from '@/compartilhado/formatacao'

interface Props {
  aoFechar: () => void
  ultimaSincronizacao: SincronizacaoDto | null
}

// Validação só para retorno rápido; a que vale (ordem das datas, no máximo um ano) é a da API.
const esquema = z.object({
  vencimentoDe: z.string().min(1, 'Informe a data inicial.'),
  vencimentoAte: z.string().min(1, 'Informe a data final.'),
})
type Formulario = z.infer<typeof esquema>

// Período sugerido: o mês corrente inteiro.
function mesCorrente(): Formulario {
  const hoje = hojeIso()
  const [ano, mes] = hoje.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return { vencimentoDe: `${hoje.slice(0, 7)}-01`, vencimentoAte: `${hoje.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}` }
}

// Sincroniza todas as cobranças de um período com o Asaas. [Cobranças.RF007]
// Montado só enquanto aberto: cada abertura começa com o mês corrente e sem resultado.
function DialogoSincronizarCobrancas({ aoFechar, ultimaSincronizacao }: Props) {
  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: mesCorrente(),
  })
  const sincronizar = useSincronizarCobrancas()
  const queryClient = useQueryClient()
  // Depois de sincronizar, mostra o resultado desta execução; antes, o da última.
  const resultado = sincronizar.data ?? ultimaSincronizacao

  async function enviar(dados: Formulario) {
    try {
      await sincronizar.mutateAsync({ data: dados })
      // A sincronização pode mudar situações, totais e o histórico: tudo o que está em cache fica velho.
      await queryClient.invalidateQueries()
    } catch {
      // A mensagem da API (ex.: Asaas fora do ar) aparece no diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Sincronizar com o Asaas"
      descricao="Consulta o Asaas e atualiza as cobranças cujas notificações não chegaram."
      aoEnviar={(evento) => void handleSubmit(enviar)(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
          <button type="submit" className="botao botao-principal" disabled={sincronizar.isPending}>
            {sincronizar.isPending ? 'Consultando o Asaas…' : 'Sincronizar agora'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo">
          <label htmlFor="si-de">Vencimento de</label>
          <input id="si-de" type="date" aria-invalid={!!formState.errors.vencimentoDe} {...register('vencimentoDe')} />
          {formState.errors.vencimentoDe && (
            <span className="dica" role="alert">
              {formState.errors.vencimentoDe.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="si-ate">até</label>
          <input id="si-ate" type="date" aria-invalid={!!formState.errors.vencimentoAte} {...register('vencimentoAte')} />
          {formState.errors.vencimentoAte && (
            <span className="dica" role="alert">
              {formState.errors.vencimentoAte.message}
            </span>
          )}
        </div>
      </div>
      {sincronizar.error && (
        <p className="erro-formulario" role="alert">
          {sincronizar.error.message}
        </p>
      )}
      {resultado ? (
        <div className="resumo-efeito" role="status">
          <p>
            <strong>
              {sincronizar.data ? 'Resultado desta sincronização' : 'Resultado da última sincronização'} (
              {formatarDataHora(resultado.iniciadaEm)})
            </strong>
          </p>
          <ul className="lista-linhas">
            <li>
              <span>Cobranças conferidas</span>
              <span className="numero">{resultado.conferidas}</span>
            </li>
            <li>
              <span>Situação atualizada (pagas, estornadas ou canceladas no Asaas)</span>
              <span className="numero">{resultado.atualizadas}</span>
            </li>
            <li>
              <span>Encontradas só no Asaas e registradas aqui</span>
              <span className="numero">{resultado.somenteNoAsaas}</span>
            </li>
            <li>
              <span>Só no Asaas, sem aluno correspondente aqui</span>
              <span className="numero">{resultado.naoIdentificadas}</span>
            </li>
            <li>
              <span>Divergências para conferir</span>
              <span className="numero">{resultado.paraConferir}</span>
            </li>
          </ul>
          {resultado.falha && <p className="erro-formulario">{resultado.falha}</p>}
        </div>
      ) : (
        <p className="texto-apoio">Ainda não houve nenhuma sincronização.</p>
      )}
    </Dialogo>
  )
}

export default DialogoSincronizarCobrancas

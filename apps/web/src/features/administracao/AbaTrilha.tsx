import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  useListarTrilhaDeAuditoria,
  useListarUsuarios,
  type EntidadeAuditoria,
  type OperacaoAuditoria,
} from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import RodapeDaTabela from '@/compartilhado/componentes/RodapeDaTabela'
import { formatarDataHora, hojeIso } from '@/compartilhado/formatacao'

const ROTULO_DA_OPERACAO: Record<OperacaoAuditoria, string> = {
  INCLUSAO: 'Inclusão',
  ALTERACAO: 'Alteração',
  INATIVACAO: 'Inativação',
  REATIVACAO: 'Reativação',
  EXCLUSAO: 'Exclusão',
  ESTORNO: 'Estorno',
  BLOQUEIO_AUTENTICACAO: 'Bloqueio de acesso',
  OBTENCAO_DE_BOLETO: 'Obtenção de boleto',
  CANCELAMENTO: 'Cancelamento',
}

const ROTULO_DA_ENTIDADE: Record<EntidadeAuditoria, string> = {
  USUARIO: 'Usuário',
  CATEGORIA: 'Categoria',
  ALUNO: 'Aluno',
  FUNCIONARIO: 'Funcionário',
  CONTRATO: 'Contrato',
  PROJETO: 'Projeto',
  COBRANCA: 'Cobrança',
  MOVIMENTACAO: 'Movimentação',
  CONFIGURACAO: 'Configuração',
  PENDENCIA: 'Pendência de conciliação',
  ALERTA_DE_CONCILIACAO: 'Alerta de webhook parado',
}
const ROTINA_AUTOMATICA = 'ROTINA_AUTOMATICA'
const TAMANHO_DA_PAGINA = 200

// Trilha de auditoria. [Administração.RF005]
// Só leitura: a trilha não pode ser alterada nem excluída, por nenhum perfil (fluxo E1).
function AbaTrilha() {
  // Fluxo A1: aberta a partir de um registro, chega com ?registroId=... e o filtro já aplicado.
  const [parametros] = useSearchParams()
  const [registroId, definirRegistroId] = useState(parametros.get('registroId') ?? '')
  const hoje = hojeIso()
  const [de, definirDe] = useState(`${hoje.slice(0, 7)}-01`)
  const [ate, definirAte] = useState(hoje)
  const [usuario, definirUsuario] = useState('')
  const [operacao, definirOperacao] = useState<OperacaoAuditoria | ''>('')
  const [entidade, definirEntidade] = useState<EntidadeAuditoria | ''>('')

  const usuarios = useListarUsuarios()
  const trilha = useListarTrilhaDeAuditoria({
    de: de || undefined,
    ate: ate || undefined,
    usuario: usuario || undefined,
    operacao: operacao || undefined,
    entidade: entidade || undefined,
    registroId: registroId || undefined,
    tamanhoPagina: TAMANHO_DA_PAGINA,
  })
  const itens = trilha.data?.itens ?? []
  const total = trilha.data?.total ?? 0

  return (
    <>
      <div className="filtros">
        <div className="campo">
          <label htmlFor="tr-de">De</label>
          <input id="tr-de" type="date" value={de} onChange={(evento) => definirDe(evento.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="tr-ate">até</label>
          <input id="tr-ate" type="date" value={ate} onChange={(evento) => definirAte(evento.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="tr-usuario">Usuário</label>
          <select id="tr-usuario" value={usuario} onChange={(evento) => definirUsuario(evento.target.value)}>
            <option value="">Todos</option>
            {usuarios.data?.itens.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
            <option value={ROTINA_AUTOMATICA}>Rotinas automáticas</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="tr-operacao">Operação</label>
          <select
            id="tr-operacao"
            value={operacao}
            onChange={(evento) => definirOperacao(evento.target.value as OperacaoAuditoria | '')}
          >
            <option value="">Todas</option>
            {Object.entries(ROTULO_DA_OPERACAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="tr-entidade">Registro</label>
          <select
            id="tr-entidade"
            value={entidade}
            onChange={(evento) => definirEntidade(evento.target.value as EntidadeAuditoria | '')}
          >
            <option value="">Todos</option>
            {Object.entries(ROTULO_DA_ENTIDADE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        {registroId && (
          <button type="button" className="botao botao-pequeno" onClick={() => definirRegistroId('')}>
            Só um registro · mostrar todos
          </button>
        )}
      </div>

      <EstadoDaConsulta
        carregando={trilha.isPending}
        erro={trilha.error}
        aoTentarDeNovo={() => void trilha.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum registro na trilha para este período e filtro."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Usuário</th>
                <th>Operação</th>
                <th>Registro afetado</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((registro) => (
                <tr key={registro.id}>
                  <td>{formatarDataHora(registro.ocorridoEm)}</td>
                  <td>{registro.usuarioNome ?? 'Rotina automática'}</td>
                  <td>{ROTULO_DA_OPERACAO[registro.operacao]}</td>
                  <td>{ROTULO_DA_ENTIDADE[registro.entidade]}</td>
                  <td>{registro.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RodapeDaTabela
            texto={`${total > itens.length ? `Mostrando os ${itens.length} mais recentes de ${total}. Estreite o período para ver os demais. ` : ''}A trilha não pode ser alterada nem excluída, por nenhum perfil.`}
          />
        </div>
      </EstadoDaConsulta>
    </>
  )
}

export default AbaTrilha

import { useState } from 'react'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda } from '@/compartilhado/formatacao'
import type { PeriodicidadeContrato, SituacaoDoFiltroDeContratos } from './contrato'
import { useListarContratos } from './consultas'

const ROTULO_DA_PERIODICIDADE: Record<PeriodicidadeContrato, string> = {
  MENSAL: 'Mensal',
  POR_DEMANDA: 'Por demanda',
  UNICA: 'Única',
}

// [Cadastros.RF004] Contrato com aviso de vencimento. A contraparte é só um texto (não há cadastro de fornecedores).
function AbaContratos() {
  const [situacao, definirSituacao] = useState<SituacaoDoFiltroDeContratos>('vigentes')
  const contratos = useListarContratos(situacao)

  const dados = contratos.data
  const itens = dados?.itens ?? []

  return (
    <>
      {dados && dados.quantidadeVencendo > 0 && (
        <div className="alerta" role="status">
          <Icone nome="alerta" />
          <p>
            <strong>
              {dados.quantidadeVencendo === 1
                ? '1 contrato vence nos próximos 60 dias.'
                : `${dados.quantidadeVencendo} contratos vencem nos próximos 60 dias.`}
            </strong>{' '}
            Renove ou encerre antes do término.
          </p>
        </div>
      )}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="co-situacao">Situação</label>
          <select id="co-situacao" value={situacao} onChange={(evento) => definirSituacao(evento.target.value as SituacaoDoFiltroDeContratos)}>
            <option value="vigentes">Vigentes</option>
            <option value="encerrados">Encerrados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          {/* TODO [Cadastros.RF004]: formulário de novo contrato. */}
          <button type="button" className="botao botao-principal">
            <Icone nome="mais" />
            Novo contrato
          </button>
        </div>
      </div>

      <EstadoDaConsulta
        carregando={contratos.isPending}
        erro={contratos.error}
        aoTentarDeNovo={() => void contratos.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum contrato encontrado para este filtro."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Contraparte</th>
                <th>Objeto</th>
                <th className="numero">Valor</th>
                <th>Periodicidade</th>
                <th>Vigência</th>
                <th className="numero">Pago em 2026</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((contrato) => (
                <tr key={contrato.id}>
                  <td className="nome-principal">{contrato.contraparte}</td>
                  <td>{contrato.objeto}</td>
                  <td className="numero">{formatarMoeda(contrato.valorCentavos)}</td>
                  <td>{ROTULO_DA_PERIODICIDADE[contrato.periodicidade]}</td>
                  <td>
                    {formatarData(contrato.dataInicio)} a {formatarData(contrato.dataFim)}
                    {contrato.situacao !== 'ENCERRADO' && (
                      <span className="secundario">
                        {contrato.situacao === 'VENCE_EM_BREVE' ? (
                          <strong>Vence em {contrato.diasParaVencer} dias</strong>
                        ) : (
                          `Vence em ${contrato.diasParaVencer} dias`
                        )}
                      </span>
                    )}
                  </td>
                  <td className="numero">{formatarMoeda(contrato.pagoNoAnoCentavos)}</td>
                  <td>
                    {contrato.situacao === 'VIGENTE' && <span className="selo selo-paga">Vigente</span>}
                    {contrato.situacao === 'VENCE_EM_BREVE' && (
                      <span className="selo selo-alerta">
                        <Icone nome="alerta" />
                        Vence em breve
                      </span>
                    )}
                    {contrato.situacao === 'ENCERRADO' && <span className="selo">Encerrado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>
    </>
  )
}

export default AbaContratos

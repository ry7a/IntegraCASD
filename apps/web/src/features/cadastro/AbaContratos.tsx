import { useState } from 'react'
import { useListarContratos, type ContratoDto, type ListarContratosSituacao } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarData, formatarMoeda, hojeIso } from '@/compartilhado/formatacao'
import DialogoContrato from './DialogoContrato'
import DialogoEncerrarContrato from './DialogoEncerrarContrato'
import { ROTULO_DA_PERIODICIDADE } from './rotulos'

// Qual diálogo está aberto: novo contrato, edição ou encerramento de um contrato.
type DialogoAberto = { tipo: 'novo' } | { tipo: 'editar'; contrato: ContratoDto } | { tipo: 'encerrar'; contrato: ContratoDto } | null

// [Cadastros.RF004] Contrato com aviso de vencimento. A contraparte é só um texto (não há cadastro de fornecedores).
function AbaContratos() {
  const [situacao, definirSituacao] = useState<ListarContratosSituacao>('vigentes')
  const [dialogo, definirDialogo] = useState<DialogoAberto>(null)
  const contratos = useListarContratos({ situacao })
  const anoCorrente = hojeIso().slice(0, 4)

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
          <select
            id="co-situacao"
            value={situacao}
            onChange={(evento) => definirSituacao(evento.target.value as ListarContratosSituacao)}
          >
            <option value="vigentes">Vigentes</option>
            <option value="encerrados">Encerrados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => definirDialogo({ tipo: 'novo' })}>
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
                <th className="numero">Pago em {anoCorrente}</th>
                <th>Situação</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((contrato) => (
                <tr key={contrato.id}>
                  <td>
                    <span className="nome-principal">{contrato.contraparte}</span>
                    <span className="secundario">{contrato.codigo}</span>
                  </td>
                  <td>{contrato.objeto}</td>
                  <td className="numero">{formatarMoeda(contrato.valorCentavos)}</td>
                  <td>{ROTULO_DA_PERIODICIDADE[contrato.periodicidade]}</td>
                  <td>
                    {formatarData(contrato.dataInicio)} a {contrato.dataFim ? formatarData(contrato.dataFim) : 'sem término'}
                    {contrato.situacao !== 'ENCERRADO' && contrato.diasParaVencer !== null && (
                      <span className="secundario">
                        {contrato.situacao === 'VENCE_EM_BREVE' ? (
                          <strong>Vence em {contrato.diasParaVencer} dias</strong>
                        ) : (
                          `Vence em ${contrato.diasParaVencer} dias`
                        )}
                      </span>
                    )}
                    {contrato.justificativaEncerramento && (
                      <span className="secundario">
                        Encerrado em {contrato.dataEncerramento ? formatarData(contrato.dataEncerramento) : '—'}:{' '}
                        {contrato.justificativaEncerramento}
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
                  <td className="acoes">
                    {!contrato.dataEncerramento && (
                      <>
                        <button
                          type="button"
                          className="botao botao-pequeno botao-fantasma"
                          onClick={() => definirDialogo({ tipo: 'editar', contrato })}
                        >
                          <Icone nome="editar" />
                          Editar
                        </button>{' '}
                        <button type="button" className="botao botao-pequeno" onClick={() => definirDialogo({ tipo: 'encerrar', contrato })}>
                          Encerrar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>

      {dialogo?.tipo === 'novo' && <DialogoContrato contrato={null} aoFechar={() => definirDialogo(null)} />}
      {dialogo?.tipo === 'editar' && <DialogoContrato contrato={dialogo.contrato} aoFechar={() => definirDialogo(null)} />}
      {dialogo?.tipo === 'encerrar' && <DialogoEncerrarContrato contrato={dialogo.contrato} aoFechar={() => definirDialogo(null)} />}
    </>
  )
}

export default AbaContratos

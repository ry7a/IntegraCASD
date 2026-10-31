// Rodapé das tabelas: "Mostrando 8 de 8 movimentações" e os botões Anterior / Próxima.
// Os botões só funcionam quando a tela passa `paginacao` (a API daquela lista precisa ser paginada);
// sem ela, ficam desabilitados.
export interface Paginacao {
  pagina: number
  totalDePaginas: number
  aoMudar: (pagina: number) => void
}

function RodapeDaTabela({ texto, paginacao }: { texto: string; paginacao?: Paginacao }) {
  const temAnterior = paginacao !== undefined && paginacao.pagina > 1
  const temProxima = paginacao !== undefined && paginacao.pagina < paginacao.totalDePaginas
  return (
    <div className="rodape-tabela">
      <span>{texto}</span>
      <span>
        {paginacao && paginacao.totalDePaginas > 1 && (
          <span aria-live="polite">
            Página {paginacao.pagina} de {paginacao.totalDePaginas}{' '}
          </span>
        )}
        <button
          type="button"
          className="botao botao-pequeno"
          disabled={!temAnterior}
          onClick={() => paginacao?.aoMudar(paginacao.pagina - 1)}
        >
          Anterior
        </button>{' '}
        <button
          type="button"
          className="botao botao-pequeno"
          disabled={!temProxima}
          onClick={() => paginacao?.aoMudar(paginacao.pagina + 1)}
        >
          Próxima
        </button>
      </span>
    </div>
  )
}

export default RodapeDaTabela

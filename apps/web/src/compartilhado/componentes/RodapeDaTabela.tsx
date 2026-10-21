// Rodapé das tabelas: "Mostrando 8 de 8 movimentações" e os botões Anterior / Próxima.
// TODO: a paginação só passa a funcionar quando os endpoints paginados existirem; por ora cabe tudo numa página.
function RodapeDaTabela({ texto }: { texto: string }) {
  return (
    <div className="rodape-tabela">
      <span>{texto}</span>
      <span>
        <button type="button" className="botao botao-pequeno" disabled>
          Anterior
        </button>{' '}
        <button type="button" className="botao botao-pequeno" disabled>
          Próxima
        </button>
      </span>
    </div>
  )
}

export default RodapeDaTabela

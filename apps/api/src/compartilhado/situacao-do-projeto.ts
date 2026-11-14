// Situação do projeto (MER, decisão 5) e a regra de projeto encerrado. Só TypeScript puro.
// Usada pelo Cadastros (lista de projetos em andamento e encerrados, [Cadastros.RF005]) e pelo Movimentações
// (aviso do lançamento em projeto encerrado, [Movimentações.RF001] fluxo A2). Fica aqui, e não no Cadastros,
// porque o Cadastros importa o MovimentacoesModule: se o Movimentações importasse o Cadastros, os dois módulos
// formariam um ciclo, e a aplicação quebraria conforme a ordem em que o Node os carrega.

// Os 5 status da planilha. A tela agrupa os três primeiros como "em andamento" e os dois últimos como "encerrados".
export type SituacaoDoProjeto = 'A_LIBERAR' | 'LIBERADO' | 'EM_EXECUCAO' | 'EXECUTADO' | 'CANCELADO';

// Encerrado é executado OU cancelado.
export function estaEncerrado(situacao: SituacaoDoProjeto): boolean {
  return situacao === 'EXECUTADO' || situacao === 'CANCELADO';
}

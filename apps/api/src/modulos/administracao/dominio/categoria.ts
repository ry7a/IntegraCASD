// Regras da categoria de movimentação [Administração.RF002]. Só TypeScript puro: sem
// framework e sem banco, para poder testar sem montar nada.

export const TIPOS_DE_CATEGORIA = ['ENTRADA', 'SAIDA', 'AMBOS'] as const;
// O tipo é a união dos valores da lista acima: 'ENTRADA' | 'SAIDA' | 'AMBOS'.
export type TipoDeCategoria = (typeof TIPOS_DE_CATEGORIA)[number];

const TAMANHO_MINIMO_DO_NOME = 2;
const TAMANHO_MAXIMO_DO_NOME = 60;

// Erros do domínio. São classes próprias (e não as exceções HTTP do Nest) porque o domínio
// não conhece o framework; quem traduz para 400 ou 409 é a camada de aplicação.
export class RegraDaCategoriaViolada extends Error {}
export class NomeDeCategoriaDuplicado extends Error {
  constructor(nome?: string) {
    const qual = nome === undefined ? 'com este nome' : `chamada "${nome}"`;
    super(`Já existe uma categoria ativa ${qual}. Use outro nome ou edite a existente.`);
  }
}

export class CategoriaEmUso extends Error {
  // Sem a quantidade (quem detectou foi o banco), a mensagem só diz que há movimentações.
  constructor(quantidadeMovimentacoes?: number) {
    const quantas = quantidadeMovimentacoes === undefined ? '' : `${quantidadeMovimentacoes} `;
    super(
      `Esta categoria já classifica ${quantas}movimentação(ões) e não pode ser excluída. ` +
        'Inative-a: ela deixa de aparecer em novos lançamentos e os relatórios antigos continuam iguais.',
    );
  }
}

// Tira espaços das pontas e espaços repetidos no meio: "  Material   de limpeza " vira
// "Material de limpeza". Assim dois nomes que só diferem em espaços contam como iguais.
export function normalizarNome(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw new RegraDaCategoriaViolada('Informe o nome da categoria.');
  }
  const nome = valor.trim().replace(/\s+/g, ' ');
  if (nome.length < TAMANHO_MINIMO_DO_NOME) {
    throw new RegraDaCategoriaViolada(
      `O nome da categoria precisa ter ao menos ${TAMANHO_MINIMO_DO_NOME} caracteres.`,
    );
  }
  if (nome.length > TAMANHO_MAXIMO_DO_NOME) {
    throw new RegraDaCategoriaViolada(
      `Use no máximo ${TAMANHO_MAXIMO_DO_NOME} caracteres no nome da categoria.`,
    );
  }
  return nome;
}

export function lerTipo(valor: unknown): TipoDeCategoria {
  const tipo = TIPOS_DE_CATEGORIA.find((permitido) => permitido === valor);
  if (tipo === undefined) {
    throw new RegraDaCategoriaViolada('Escolha se a categoria vale para entradas, saídas ou ambos.');
  }
  return tipo;
}

export function lerSituacao(valor: unknown): boolean {
  if (typeof valor !== 'boolean') {
    throw new RegraDaCategoriaViolada('Informe se a categoria fica ativa ou inativa.');
  }
  return valor;
}

// Quantas movimentações de cada tipo já usam a categoria.
export type UsoDaCategoria = { entradas: number; saidas: number };

// Trocar o tipo não pode deixar movimentações antigas com uma categoria incompatível: se a
// categoria já classifica saídas, ela não pode virar "só entradas" (e vice-versa).
// Ampliar para AMBOS é sempre permitido.
export function conferirTrocaDeTipo(novoTipo: TipoDeCategoria, uso: UsoDaCategoria): void {
  if (novoTipo === 'ENTRADA' && uso.saidas > 0) {
    throw new RegraDaCategoriaViolada(
      `Esta categoria já classifica ${uso.saidas} saída(s). Para usá-la também em entradas, escolha "Entradas e saídas".`,
    );
  }
  if (novoTipo === 'SAIDA' && uso.entradas > 0) {
    throw new RegraDaCategoriaViolada(
      `Esta categoria já classifica ${uso.entradas} entrada(s). Para usá-la também em saídas, escolha "Entradas e saídas".`,
    );
  }
}

// Exceção combinada com a equipe à regra "nada é excluído fisicamente": uma categoria que
// nunca foi usada (por exemplo, criada por engano) pode ser excluída. Com movimentações, o
// caminho é inativar, para que os relatórios de períodos passados não mudem.
export function conferirExclusao(quantidadeMovimentacoes: number): void {
  if (quantidadeMovimentacoes > 0) {
    throw new CategoriaEmUso(quantidadeMovimentacoes);
  }
}

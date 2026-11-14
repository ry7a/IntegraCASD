// Leitura das entradas que vêm de fora (formulários, filtros da URL e avisos do Asaas): o único lugar
// que sabe se uma data existe, se um inteiro cabe na coluna e se um texto pode ir para o banco.
// Só TypeScript puro, para poder ser usado no `dominio/` de qualquer módulo.
//
// Nenhuma função lança erro: devolve o valor lido ou o motivo da recusa. A mensagem da recusa, que cita o
// campo ([Usabilidade.NF002]), também é montada aqui (mensagemDoDia, mensagemDoMes, mensagemDosCentavos,
// mensagemDoTexto), para o texto ser o mesmo em todo módulo. Quem lança é o módulo, embrulhando a mensagem
// no próprio erro; assim `compartilhado/` não precisa conhecer os erros dos módulos (regra B1). Exemplo, no
// domínio de Cobranças:
//
//   const vencimento = lerDia(entrada.vencimento);
//   if (!vencimento.valido) throw new CobrancaInvalida(mensagemDoDia(vencimento.motivo, 'o vencimento'));
//   const dia: string = vencimento.valor; // depois do `if`, o TypeScript sabe que a leitura deu certo
//
// O campo vai com o artigo, como numa frase ("o vencimento", "a data inicial"): a mensagem faz as contrações
// ("do vencimento", "na descrição"). Modelo: `lerData` em cadastros/dominio/comum.ts.
//
// Campo ausente (undefined, null, '') não é tratado aqui: cada módulo decide se usa um padrão, deixa
// nulo ou recusa. Texto com o motivo 'formato' (não veio texto) costuma ser tratado do mesmo jeito.
// Na URL tudo chega como texto: converta com Number(...) antes de ler um inteiro.

export type MotivoDaRecusa =
  | 'formato' // tipo ou forma errados: "28/02/2026", "4500" em vez de 4500, 45.5 centavos, número no lugar de texto
  | 'inexistente' // forma certa, mas não está no calendário: 30/02, 31/04, mês 00 ou 13
  | 'abaixo-do-minimo' // ano antes de 1900, centavos zero ou negativos, inteiro negativo
  | 'acima-do-maximo' // ano depois de 9999, inteiro acima do que a coluna guarda, texto maior que o máximo
  | 'caractere-nulo'; // texto com \u0000, que o PostgreSQL recusa (vem de colar de outro programa)

export type Leitura<T> = { valido: true; valor: T } | { valido: false; motivo: MotivoDaRecusa };

export const MENOR_ANO = 1900;
export const MAIOR_ANO = 9999;
// O maior valor de uma coluna `Int` do PostgreSQL (2^31 - 1). Acima disso, o banco responde erro.
export const MAIOR_INTEIRO_DO_BANCO = 2_147_483_647;
// MAIOR_INTEIRO_DO_BANCO centavos, em reais, para as mensagens.
export const MAIOR_VALOR_EM_REAIS = 'R$ 21.474.836,47';
// Máximo para o texto que não tem limite de negócio (e-mail, celular, nome de usuário...): `lerTexto` sempre
// pede um máximo, e este é só um teto técnico generoso, que nenhum valor de verdade alcança. Não é regra de
// negócio (a spec #57 deixa de fora "limites de negócio mais apertados").
export const TAMANHO_MAXIMO_TECNICO = 1000;

function anoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasDoMes(ano: number, mes: number): number {
  if (mes === 2) return anoBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

// Dia "AAAA-MM-DD" que existe no calendário. A conta é feita à mão, e não com `new Date`, porque o
// Date "conserta" 30/02 para 02/03 em vez de recusar.
export function lerDia(valor: unknown): Leitura<string> {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { valido: false, motivo: 'formato' };
  const [ano, mes, dia] = valor.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(ano, mes)) return { valido: false, motivo: 'inexistente' };
  if (ano < MENOR_ANO) return { valido: false, motivo: 'abaixo-do-minimo' };
  if (ano > MAIOR_ANO) return { valido: false, motivo: 'acima-do-maximo' };
  return { valido: true, valor };
}

// Mês "AAAA-MM", com o mês de 01 a 12 e o mesmo intervalo de ano do dia.
export function lerMes(valor: unknown): Leitura<string> {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}$/.test(valor)) return { valido: false, motivo: 'formato' };
  // O dia 1 existe em todo mês: o que sobra para conferir é o mês (01 a 12) e o ano.
  const primeiroDia = lerDia(`${valor}-01`);
  return primeiroDia.valido ? { valido: true, valor } : primeiroDia;
}

// Só aceita número de verdade (o que vem no JSON): "4500", em texto, é formato errado.
// Number.isInteger já recusa fração, NaN e infinito.
function lerInteiroEntre(valor: unknown, minimo: number): Leitura<number> {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return { valido: false, motivo: 'formato' };
  if (valor < minimo) return { valido: false, motivo: 'abaixo-do-minimo' };
  if (valor > MAIOR_INTEIRO_DO_BANCO) return { valido: false, motivo: 'acima-do-maximo' };
  return { valido: true, valor };
}

// Valor em centavos: inteiro de 1 a MAIOR_INTEIRO_DO_BANCO. Zero e negativo ficam abaixo do mínimo.
export function lerCentavos(valor: unknown): Leitura<number> {
  return lerInteiroEntre(valor, 1);
}

// Inteiro de 0 a MAIOR_INTEIRO_DO_BANCO (página, matrícula). Se zero não serve, o módulo confere.
export function lerInteiroNaoNegativo(valor: unknown): Leitura<number> {
  return lerInteiroEntre(valor, 0);
}

// Texto aparado, com os espaços repetidos reduzidos a um, sem caractere nulo e com no máximo
// `tamanhoMaximo` caracteres (contados depois de aparar). Só espaços vira "": se o campo é obrigatório
// ou tem tamanho mínimo, o módulo confere.
export function lerTexto(valor: unknown, tamanhoMaximo: number): Leitura<string> {
  if (typeof valor !== 'string') return { valido: false, motivo: 'formato' };
  if (valor.includes('\u0000')) return { valido: false, motivo: 'caractere-nulo' };
  const limpo = valor.trim().replace(/\s+/g, ' ');
  if (limpo.length > tamanhoMaximo) return { valido: false, motivo: 'acima-do-maximo' };
  return { valido: true, valor: limpo };
}

// ---------------------------------------------------------------------------
// Mensagens da recusa ([Usabilidade.NF002])
// ---------------------------------------------------------------------------
// Uma função por tipo de leitura: recebe o motivo e o campo, com o artigo ("o vencimento", "a data inicial"),
// e devolve a frase que diz o que corrigir. O módulo só a embrulha no próprio erro.

// "o vencimento" vira "no vencimento" (em + o) ou "do vencimento" (de + o); "a data" vira "na data" ou
// "da data". Campo sem artigo fica como está: "em registro".
function contrair(preposicao: 'em' | 'de', campo: string): string {
  const temArtigo = /^(o|a|os|as) /.test(campo);
  if (!temArtigo) return `${preposicao} ${campo}`;
  return preposicao === 'em' ? `n${campo}` : `d${campo}`;
}

// O campo no começo da frase: "o vencimento" vira "O vencimento".
function comMaiuscula(campo: string): string {
  return campo.charAt(0).toUpperCase() + campo.slice(1);
}

function mensagemDoAno(campo: string): string {
  return `Confira o ano ${contrair('de', campo)}: ele precisa estar entre ${MENOR_ANO} e ${MAIOR_ANO}.`;
}

// Recusa de lerDia.
export function mensagemDoDia(motivo: MotivoDaRecusa, campo: string): string {
  if (motivo === 'inexistente') return `${comMaiuscula(campo)} não existe no calendário. Confira o dia e o mês.`;
  if (motivo === 'abaixo-do-minimo' || motivo === 'acima-do-maximo') return mensagemDoAno(campo);
  return `Informe ${campo} no formato AAAA-MM-DD.`;
}

// Recusa de lerMes.
export function mensagemDoMes(motivo: MotivoDaRecusa, campo: string): string {
  if (motivo === 'inexistente') return `O mês vai de 01 a 12. Informe ${campo} no formato AAAA-MM.`;
  if (motivo === 'abaixo-do-minimo' || motivo === 'acima-do-maximo') return mensagemDoAno(campo);
  return `Informe ${campo} no formato AAAA-MM.`;
}

// Recusa de lerCentavos. Acima do máximo a correção é outra (quase sempre um zero a mais); zero, negativo,
// fração de centavo e texto pedem o valor do jeito certo.
export function mensagemDosCentavos(motivo: MotivoDaRecusa, campo: string): string {
  if (motivo === 'acima-do-maximo') {
    return `${comMaiuscula(campo)} passa do limite do sistema (${MAIOR_VALOR_EM_REAIS}). Confira se não sobrou zero.`;
  }
  return `Informe ${campo} maior que zero, em centavos inteiros (ex.: 8500 para R$ 85,00).`;
}

// Recusa de lerTexto. `tamanhoMaximo` é o mesmo passado a lerTexto.
export function mensagemDoTexto(motivo: MotivoDaRecusa, campo: string, tamanhoMaximo: number): string {
  if (motivo === 'caractere-nulo') {
    return `Há um caractere invisível (nulo) ${contrair('em', campo)}, comum ao colar de outro programa. Apague e digite de novo.`;
  }
  if (motivo === 'acima-do-maximo') return `Use no máximo ${tamanhoMaximo} caracteres ${contrair('em', campo)}.`;
  return `Informe ${campo} como texto.`;
}

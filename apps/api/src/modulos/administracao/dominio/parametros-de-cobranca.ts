// Regras dos parâmetros das cobranças recorrentes [Administração.RF003]. Só TypeScript puro.
// Datas no formato "AAAA-MM-DD".

export type ParametrosDeCobranca = {
  valorMensalidadeCentavos: number;
  diaVencimento: number;
  diaGeracao: number;
  // Percentuais inteiros (2 = 2%). Quem calcula multa e juros é o Asaas, no pagamento.
  multaPercentual: number;
  jurosMensalPercentual: number;
};

export class ParametroInvalido extends Error {}

// Limites legais para cobrança de consumidor: multa até 2% (CDC, art. 52, § 1º) e juros de
// mora até 1% ao mês.
export const MULTA_MAXIMA_PERCENTUAL = 2;
export const JUROS_MAXIMO_PERCENTUAL_AO_MES = 1;

function inteiroEntre(valor: unknown, minimo: number, maximo: number, mensagem: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new ParametroInvalido(mensagem);
  }
  return valor;
}

export function lerParametros(entrada: Partial<Record<keyof ParametrosDeCobranca, unknown>>): ParametrosDeCobranca {
  const parametros: ParametrosDeCobranca = {
    valorMensalidadeCentavos: inteiroEntre(
      entrada.valorMensalidadeCentavos,
      1,
      Number.MAX_SAFE_INTEGER,
      'Informe o valor da mensalidade em centavos, como número inteiro maior que zero (ex.: 8500 para R$ 85,00).',
    ),
    // Até 28: todo mês tem esse dia, inclusive fevereiro.
    diaVencimento: inteiroEntre(entrada.diaVencimento, 1, 28, 'O dia de vencimento deve ser de 1 a 28.'),
    diaGeracao: inteiroEntre(entrada.diaGeracao, 1, 28, 'O dia de geração deve ser de 1 a 28.'),
    multaPercentual: inteiroEntre(
      entrada.multaPercentual,
      0,
      MULTA_MAXIMA_PERCENTUAL,
      `A multa por atraso deve ser de 0% a ${MULTA_MAXIMA_PERCENTUAL}% (limite do Código de Defesa do Consumidor).`,
    ),
    jurosMensalPercentual: inteiroEntre(
      entrada.jurosMensalPercentual,
      0,
      JUROS_MAXIMO_PERCENTUAL_AO_MES,
      `Os juros devem ser de 0% a ${JUROS_MAXIMO_PERCENTUAL_AO_MES}% ao mês.`,
    ),
  };
  // Fluxo E1: gerar depois do vencimento produziria cobranças já vencidas na emissão.
  if (parametros.diaGeracao >= parametros.diaVencimento) {
    throw new ParametroInvalido('O dia de geração precisa ser antes do dia de vencimento.');
  }
  return parametros;
}

function dia(ano: number, mes: number, diaDoMes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(diaDoMes).padStart(2, '0')}`;
}

// A próxima geração é no dia de geração deste mês, se ainda não passou; senão, no do mês seguinte.
// O vencimento é no mesmo mês da geração (a geração vem sempre antes do vencimento).
export function proximoCiclo(hoje: string, diaGeracao: number, diaVencimento: number): { geracao: string; vencimento: string } {
  let ano = Number(hoje.slice(0, 4));
  let mes = Number(hoje.slice(5, 7));
  if (Number(hoje.slice(8, 10)) > diaGeracao) {
    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
  }
  return { geracao: dia(ano, mes, diaGeracao), vencimento: dia(ano, mes, diaVencimento) };
}

export type Conferencia = {
  proximaGeracao: string;
  proximoVencimento: string;
  alunosCobrados: number;
  totalPrevistoCentavos: number;
};

// O que o usuário confere antes de salvar (fluxo principal, passo 4).
export function conferir(parametros: ParametrosDeCobranca, hoje: string, alunosCobraveis: number): Conferencia {
  const ciclo = proximoCiclo(hoje, parametros.diaGeracao, parametros.diaVencimento);
  return {
    proximaGeracao: ciclo.geracao,
    proximoVencimento: ciclo.vencimento,
    alunosCobrados: alunosCobraveis,
    totalPrevistoCentavos: alunosCobraveis * parametros.valorMensalidadeCentavos,
  };
}

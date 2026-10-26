// Regras da geração recorrente das mensalidades [Cobranças.RF001]. Só TypeScript puro.
// Datas em "AAAA-MM-DD"; mês de referência em "AAAA-MM".

const NOMES_DOS_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export type FalhaDaGeracao = { alunoId: string; alunoNome: string; motivo: string };

// O mês cobrado: o de hoje, a partir do dia de geração. Antes desse dia, ainda não há o que gerar.
export function referenciaDoCiclo(hoje: string, diaGeracao: number): string | null {
  return Number(hoje.slice(8, 10)) >= diaGeracao ? hoje.slice(0, 7) : null;
}

// Vencimento da mensalidade: o dia de vencimento do mês de referência. Se a geração atrasou tanto que
// esse dia já passou (worker fora do ar, por exemplo), vence hoje: o Asaas não aceita vencimento passado.
export function vencimentoDaMensalidade(referencia: string, diaVencimento: number, hoje: string): string {
  const vencimento = `${referencia}-${String(diaVencimento).padStart(2, '0')}`;
  return vencimento < hoje ? hoje : vencimento;
}

export function descricaoDaMensalidade(referencia: string): string {
  const mes = NOMES_DOS_MESES[Number(referencia.slice(5, 7)) - 1];
  return `Mensalidade de ${mes}/${referencia.slice(0, 4)}`;
}

// A rotina agendada roda todo dia, mas só gera quando há o que fazer: no dia de geração (ou depois, se
// o worker estava fora do ar) e ainda não houve execução do mês, ou a última foi interrompida pelo Asaas.
export function deveGerarAgora(
  hoje: string,
  diaGeracao: number,
  ultimaExecucaoDoMes: { interrompida: boolean } | null,
): boolean {
  if (referenciaDoCiclo(hoje, diaGeracao) === null) return false;
  return ultimaExecucaoDoMes === null || ultimaExecucaoDoMes.interrompida;
}

// Fluxo A2: aluno sem e-mail ou sem CPF válido não é cobrado; a falha diz o campo que falta.
export function motivoDoCadastroIncompleto(email: string): string {
  return email.trim() === ''
    ? 'Cadastro incompleto: falta o e-mail.'
    : 'Cadastro incompleto: CPF inválido.';
}

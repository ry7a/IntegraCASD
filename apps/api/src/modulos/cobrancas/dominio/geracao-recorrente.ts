// Regras da geração recorrente das mensalidades [Cobranças.RF001]. Só TypeScript puro.
// Datas em "AAAA-MM-DD"; mês de referência em "AAAA-MM".
import { mesNoFormatoAAAAMM } from '../../../compartilhado/datas.js';

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

// "2027-02" -> "fevereiro/2027".
function mesPorExtenso(referencia: string): string {
  const mes = NOMES_DOS_MESES[Number(referencia.slice(5, 7)) - 1];
  return `${mes}/${referencia.slice(0, 4)}`;
}

export function descricaoDaMensalidade(referencia: string): string {
  return `Mensalidade de ${mesPorExtenso(referencia)}`;
}

// Trava do início da geração (variável GERACAO_A_PARTIR_DE, "AAAA-MM"): nenhuma referência anterior a ela é
// gerada, nem pela rotina agendada nem pelo pedido manual. Na implantação, a planilha do CASD ainda cobra até
// a referência 2027-01 e a primeira mensalidade do sistema é 2027-02: sem a trava, ligar o worker em
// janeiro/2027 cobraria em dobro quem já pagou na planilha. Nula (variável vazia): sem trava.
export function referenciaLiberada(referencia: string, aPartirDe: string | null): boolean {
  if (aPartirDe === null) return true;
  // Trava em formato inválido bloqueia tudo: melhor não gerar do que cobrar em dobro.
  // (Em produção nem chega aqui: a configuração inválida impede a subida, ver configuracao.ts.)
  if (!mesNoFormatoAAAAMM(aPartirDe)) return false;
  // "AAAA-MM" com zeros à esquerda se compara como texto, inclusive na virada do ano: "2026-12" < "2027-02".
  return referencia >= aPartirDe;
}

// O motivo, para o log da rotina agendada e para a resposta do pedido manual.
export function motivoDaReferenciaBloqueada(aPartirDe: string): string {
  if (!mesNoFormatoAAAAMM(aPartirDe)) {
    return `A geração está parada: GERACAO_A_PARTIR_DE ("${aPartirDe}") não está no formato AAAA-MM (ex.: 2027-02).`;
  }
  return `A geração do sistema começa em ${mesPorExtenso(aPartirDe)} (GERACAO_A_PARTIR_DE).`;
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

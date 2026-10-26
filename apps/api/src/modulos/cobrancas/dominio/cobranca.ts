// Regras da cobrança [Cobranças.RF001 a RF008]. Só TypeScript puro. Datas em "AAAA-MM-DD".

export class CobrancaInvalida extends Error {}

export type SituacaoGuardada = 'ABERTA' | 'PAGA' | 'PAGA_COM_REGISTRO_MANUAL' | 'CANCELADA' | 'ESTORNADA';
// O que a tela mostra: a guardada, ou VENCIDA quando está aberta e o vencimento já passou.
export type SituacaoExibida = SituacaoGuardada | 'VENCIDA';

export type NovaCobrancaAvulsa = {
  alunoId: string;
  valorCentavos: number;
  vencimento: string;
  descricao: string;
  // Renegociação [Cobranças.RF004] fluxo A1: a cobrança cancelada que esta substitui.
  renegociacaoDeId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// [Cobranças.RF002] Valida a entrada da cobrança avulsa. `hoje` entra por parâmetro para o teste.
export function lerNovaCobrancaAvulsa(entrada: Partial<Record<keyof NovaCobrancaAvulsa, unknown>>, hoje: string): NovaCobrancaAvulsa {
  if (typeof entrada.alunoId !== 'string' || !UUID.test(entrada.alunoId)) {
    throw new CobrancaInvalida('Escolha o aluno na lista.');
  }
  const valor = entrada.valorCentavos;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new CobrancaInvalida('Informe o valor em centavos, como número inteiro maior que zero (ex.: 8500 para R$ 85,00).');
  }
  const vencimento = entrada.vencimento;
  if (typeof vencimento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    throw new CobrancaInvalida('Informe o vencimento no formato AAAA-MM-DD.');
  }
  // Fluxo E2: vencimento no passado não é aceito.
  if (vencimento < hoje) {
    throw new CobrancaInvalida('O vencimento não pode ser anterior a hoje. Escolha outra data.');
  }
  const descricao = typeof entrada.descricao === 'string' ? entrada.descricao.trim().replace(/\s+/g, ' ') : '';
  if (descricao.length < 3) throw new CobrancaInvalida('Descreva a cobrança, por exemplo: Camiseta do CASD.');
  if (descricao.length > 200) throw new CobrancaInvalida('Use no máximo 200 caracteres na descrição.');
  const renegociacaoDeId = entrada.renegociacaoDeId ?? null;
  if (renegociacaoDeId !== null && (typeof renegociacaoDeId !== 'string' || !UUID.test(renegociacaoDeId))) {
    throw new CobrancaInvalida('A cobrança renegociada não foi encontrada. Abra a renegociação pelo detalhe da cobrança.');
  }
  return { alunoId: entrada.alunoId, valorCentavos: valor, vencimento, descricao, renegociacaoDeId };
}

// Vencimento sugerido no formulário: o próximo dia de vencimento dos parâmetros a partir de hoje.
export function vencimentoSugerido(hoje: string, diaVencimento: number): string {
  let ano = Number(hoje.slice(0, 4));
  let mes = Number(hoje.slice(5, 7));
  if (Number(hoje.slice(8, 10)) > diaVencimento) {
    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
  }
  return `${ano}-${String(mes).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`;
}

export function situacaoExibida(situacao: SituacaoGuardada, vencimento: string, hoje: string): SituacaoExibida {
  return situacao === 'ABERTA' && vencimento < hoje ? 'VENCIDA' : situacao;
}

// [Cobranças.RF002] entrada e fluxo A1: só aluno ativo e com cadastro completo recebe cobrança, porque
// o Asaas exige CPF e e-mail. A mensagem diz o que falta, para o atendimento corrigir no cadastro.
export function conferirAlunoCobravel(aluno: { ativo: boolean; cadastroIncompleto: boolean; email: string }): void {
  if (!aluno.ativo) {
    throw new CobrancaInvalida('Este aluno está inativo. Reative o cadastro antes de emitir a cobrança.');
  }
  if (aluno.cadastroIncompleto) {
    const falta = aluno.email.trim() === '' ? 'o e-mail' : 'um CPF válido';
    throw new CobrancaInvalida(`O cadastro do aluno está incompleto: falta ${falta}. Corrija na aba Dados do aluno e tente de novo.`);
  }
}

// ---------------------------------------------------------------------------
// Consulta [Cobranças.RF008]
// ---------------------------------------------------------------------------

export const SITUACOES_EXIBIDAS: SituacaoExibida[] = [
  'ABERTA',
  'VENCIDA',
  'PAGA',
  'PAGA_COM_REGISTRO_MANUAL',
  'CANCELADA',
  'ESTORNADA',
];

function diaEmMilissegundos(dia: string): number {
  return Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)));
}

// Dias entre duas datas "AAAA-MM-DD" (fim - início).
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((diaEmMilissegundos(fim) - diaEmMilissegundos(inicio)) / 86_400_000);
}

// Só cobrança vencida tem atraso: dias desde o vencimento até hoje.
export function diasDeAtraso(situacao: SituacaoExibida, vencimento: string, hoje: string): number | null {
  return situacao === 'VENCIDA' ? diasEntre(vencimento, hoje) : null;
}

// Cancelar e registrar pagamento manual só valem para cobrança aberta (vencida ou não).
export function aceitaOperacoes(situacao: SituacaoGuardada): boolean {
  return situacao === 'ABERTA';
}

export type FiltrosDaConsulta = {
  situacoes: SituacaoExibida[];
  busca: string | null;
  alunoId: string | null;
  vencimentoDe: string | null;
  vencimentoAte: string | null;
  valorMinimoCentavos: number | null;
  valorMaximoCentavos: number | null;
  pagina: number;
  tamanhoPagina: number;
};

const TAMANHO_PADRAO = 50;
const TAMANHO_MAXIMO = 200;

function data(valor: unknown, nome: string): string | null {
  if (valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new CobrancaInvalida(`Informe ${nome} no formato AAAA-MM-DD.`);
  }
  return valor;
}

function inteiroNaoNegativo(valor: unknown, nome: string): number | null {
  if (valor === undefined || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) throw new CobrancaInvalida(`Informe ${nome} como número inteiro.`);
  return numero;
}

// Lê os filtros da URL (sempre texto). Sem situação informada, abertas e vencidas (o padrão da tela).
export function lerFiltrosDaConsulta(consulta: Record<string, unknown>): FiltrosDaConsulta {
  const textoDasSituacoes = typeof consulta.situacoes === 'string' ? consulta.situacoes : '';
  const situacoes = textoDasSituacoes === '' ? ['ABERTA', 'VENCIDA'] : textoDasSituacoes.split(',');
  const desconhecidas = situacoes.filter((situacao) => !SITUACOES_EXIBIDAS.includes(situacao as SituacaoExibida));
  if (desconhecidas.length > 0) {
    throw new CobrancaInvalida(`Situação desconhecida: ${desconhecidas.join(', ')}. Use ${SITUACOES_EXIBIDAS.join(', ')}.`);
  }
  const alunoId = typeof consulta.alunoId === 'string' && consulta.alunoId !== '' ? consulta.alunoId : null;
  if (alunoId !== null && !UUID.test(alunoId)) throw new CobrancaInvalida('Aluno não encontrado. Volte à lista e escolha outro.');
  const busca = typeof consulta.busca === 'string' && consulta.busca.trim() !== '' ? consulta.busca.trim() : null;
  const pagina = inteiroNaoNegativo(consulta.pagina, 'a página') ?? 1;
  const tamanho = inteiroNaoNegativo(consulta.tamanhoPagina, 'o tamanho da página') ?? TAMANHO_PADRAO;
  return {
    situacoes: situacoes as SituacaoExibida[],
    busca,
    alunoId,
    vencimentoDe: data(consulta.vencimentoDe, 'o início do período'),
    vencimentoAte: data(consulta.vencimentoAte, 'o fim do período'),
    valorMinimoCentavos: inteiroNaoNegativo(consulta.valorMinimoCentavos, 'o valor mínimo em centavos'),
    valorMaximoCentavos: inteiroNaoNegativo(consulta.valorMaximoCentavos, 'o valor máximo em centavos'),
    pagina: Math.max(1, pagina),
    tamanhoPagina: Math.min(Math.max(1, tamanho), TAMANHO_MAXIMO),
  };
}

const NOME_DA_SITUACAO: Record<SituacaoGuardada, string> = {
  ABERTA: 'aberta',
  PAGA: 'paga',
  PAGA_COM_REGISTRO_MANUAL: 'paga com registro manual',
  CANCELADA: 'cancelada',
  ESTORNADA: 'estornada',
};

// [Cobranças.RF003] fluxo E1: boleto só de cobrança aberta (vencida ou não). Paga ou cancelada não tem
// boleto válido, e um documento sem validade não deve circular.
export function conferirBoletoDisponivel(situacao: SituacaoGuardada): void {
  if (situacao !== 'ABERTA') {
    throw new CobrancaInvalida(`Esta cobrança está ${NOME_DA_SITUACAO[situacao]}: o boleto não vale mais e não é disponibilizado.`);
  }
}

// [Cobranças.RF004] Só cobrança aberta (vencida ou não) pode ser cancelada.
export function conferirCancelamento(situacao: SituacaoGuardada): void {
  if (situacao === 'PAGA' || situacao === 'PAGA_COM_REGISTRO_MANUAL') {
    // Fluxo E1: devolução de valor não é cancelamento; é feita pelo Asaas e chega pela conciliação.
    throw new CobrancaInvalida(
      'Esta cobrança já foi paga e não pode ser cancelada. A devolução do valor é feita pelo Asaas (estorno) e chega aqui pela conciliação.',
    );
  }
  if (situacao !== 'ABERTA') {
    throw new CobrancaInvalida(`Esta cobrança já está ${NOME_DA_SITUACAO[situacao]}; não há o que cancelar.`);
  }
}

// [Cobranças.RF006] Registro manual de pagamento. Formas de pagamento fora do Asaas.
export type FormaDePagamentoManual = 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO';
const FORMAS_MANUAIS: FormaDePagamentoManual[] = ['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'];

export type PagamentoManual = {
  pagoEm: string;
  valorCentavos: number;
  formaPagamento: FormaDePagamentoManual;
  justificativa: string;
};

export function conferirPagamentoManual(situacao: SituacaoGuardada): void {
  if (situacao === 'PAGA' || situacao === 'PAGA_COM_REGISTRO_MANUAL') {
    throw new CobrancaInvalida('Esta cobrança já está paga; não há pagamento a registrar.');
  }
  if (situacao !== 'ABERTA') {
    throw new CobrancaInvalida(`Esta cobrança está ${NOME_DA_SITUACAO[situacao]}; só cobrança aberta ou vencida recebe pagamento manual.`);
  }
}

// `hoje` entra por parâmetro para o teste.
export function lerPagamentoManual(entrada: Partial<Record<keyof PagamentoManual, unknown>>, hoje: string): PagamentoManual {
  const pagoEm = entrada.pagoEm;
  if (typeof pagoEm !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(pagoEm)) {
    throw new CobrancaInvalida('Informe a data do pagamento no formato AAAA-MM-DD.');
  }
  if (pagoEm > hoje) throw new CobrancaInvalida('A data do pagamento não pode ser no futuro.');
  const valor = entrada.valorCentavos;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new CobrancaInvalida('Informe o valor pago em centavos, como número inteiro maior que zero (ex.: 8500 para R$ 85,00).');
  }
  const forma = FORMAS_MANUAIS.find((permitida) => permitida === entrada.formaPagamento);
  if (forma === undefined) throw new CobrancaInvalida('Escolha a forma do pagamento: Pix, transferência, dinheiro ou cartão.');
  // Fluxo E1: sem justificativa escrita, não há registro de por que o sistema passou a divergir do Asaas.
  const justificativa = typeof entrada.justificativa === 'string' ? entrada.justificativa.trim().replace(/\s+/g, ' ') : '';
  if (justificativa.length < 10) {
    throw new CobrancaInvalida('A justificativa é obrigatória: explique como o pagamento foi comprovado (ex.: Pix recebido na conta do CASD).');
  }
  if (justificativa.length > 500) throw new CobrancaInvalida('Use no máximo 500 caracteres na justificativa.');
  return { pagoEm, valorCentavos: valor, formaPagamento: forma, justificativa };
}

export function lerMotivoDoCancelamento(valor: unknown): string {
  const motivo = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
  if (motivo.length < 5) throw new CobrancaInvalida('Informe o motivo do cancelamento, por exemplo: renegociação em 3 parcelas.');
  if (motivo.length > 300) throw new CobrancaInvalida('Use no máximo 300 caracteres no motivo.');
  return motivo;
}

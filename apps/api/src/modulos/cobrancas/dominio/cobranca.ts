// Regras da cobrança [Cobranças.RF001 a RF008]. Só TypeScript puro. Datas em "AAAA-MM-DD".
import {
  MAIOR_ANO,
  MAIOR_INTEIRO_DO_BANCO,
  MENOR_ANO,
  lerCentavos,
  lerDia,
  lerInteiroNaoNegativo,
  lerTexto,
} from '../../../compartilhado/leitura-de-entrada.js';

export class CobrancaInvalida extends Error {}

export type SituacaoGuardada = 'ABERTA' | 'PAGA' | 'PAGA_COM_REGISTRO_MANUAL' | 'CANCELADA' | 'ESTORNADA';
// O que a tela mostra: a guardada, ou VENCIDA quando está aberta e o vencimento já passou.
export type SituacaoExibida = SituacaoGuardada | 'VENCIDA';

// HERDADA (ADR-0005): débito em aberto da planilha, trazido pela carga inicial. Não existe no Asaas,
// então não tem boleto, não é sincronizada nem conciliada. Paga-se por registro manual, ou cancela-se
// e emite-se uma renegociação, que aí sim passa pelo Asaas.
export type OrigemDaCobranca = 'MENSALIDADE' | 'AVULSA' | 'HERDADA';
// O que a aplicação pode emitir. A herdada fica de fora de propósito: só a carga inicial a cria.
export type OrigemEmitida = Exclude<OrigemDaCobranca, 'HERDADA'>;

// A cobrança existe no Asaas? Só a herdada não existe.
export function existeNoAsaas(origem: OrigemDaCobranca): boolean {
  return origem !== 'HERDADA';
}

// Boleto e sincronização dependem do Asaas: a herdada não tem nenhum dos dois.
export function conferirCobrancaNoAsaas(origem: OrigemDaCobranca): void {
  if (!existeNoAsaas(origem)) {
    throw new CobrancaInvalida(
      'Esta cobrança foi herdada da planilha e não existe no Asaas: não tem boleto nem o que sincronizar. ' +
        'Para cobrar pelo Asaas, cancele-a e emita uma renegociação; se o aluno já pagou, registre o pagamento manual.',
    );
  }
}

export type NovaCobrancaAvulsa = {
  alunoId: string;
  valorCentavos: number;
  vencimento: string;
  descricao: string;
  // Renegociação [Cobranças.RF004] fluxo A1: a cobrança cancelada que esta substitui.
  renegociacaoDeId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dia "AAAA-MM-DD" que existe no calendário, pela regra comum (compartilhado/leitura-de-entrada.ts).
// Sem ela, 30/02 ia ao Asaas como 30/02 e era gravado aqui como 02/03, e um mês 13 nos filtros da consulta
// dava erro 500. `campo` entra na mensagem como está: "o vencimento", "a data do pagamento", "o início do período".
function lerDataDaCobranca(valor: unknown, campo: string): string {
  const lida = lerDia(valor);
  if (lida.valido) return lida.valor;
  if (lida.motivo === 'inexistente') {
    throw new CobrancaInvalida(`Confira ${campo}: essa data não existe no calendário (veja o dia e o mês).`);
  }
  if (lida.motivo === 'fora-do-limite') {
    throw new CobrancaInvalida(`Confira ${campo}: o ano precisa estar entre ${MENOR_ANO} e ${MAIOR_ANO}.`);
  }
  throw new CobrancaInvalida(`Informe ${campo} no formato AAAA-MM-DD.`);
}

// Valor em centavos, pela regra comum: inteiro de 1 até o maior inteiro que a coluna do banco guarda.
// Acima disso o banco respondia erro 500, e na cobrança avulsa isso acontecia depois de criar no Asaas.
// `campo` entra na mensagem como está: "o valor", "o valor pago".
function lerValorDaCobranca(valor: unknown, campo: string): number {
  const lido = lerCentavos(valor);
  if (lido.valido) return lido.valor;
  if (typeof valor === 'number' && valor > MAIOR_INTEIRO_DO_BANCO) {
    // R$ 21.474.836,47 é MAIOR_INTEIRO_DO_BANCO em reais.
    throw new CobrancaInvalida(`Confira ${campo}: o máximo aceito é R$ 21.474.836,47 (2147483647 centavos).`);
  }
  // Formato errado, zero ou negativo.
  throw new CobrancaInvalida(`Informe ${campo} em centavos, como número inteiro maior que zero (ex.: 8500 para R$ 85,00).`);
}

// Texto livre, pela regra comum: aparado, espaços repetidos reduzidos a um e sem caractere nulo (que o
// PostgreSQL recusa). O que não é texto vira "": o tamanho mínimo, cada campo confere com a própria mensagem.
// `noCampo` entra na mensagem como está: "na descrição", "na justificativa".
function lerTextoDaCobranca(valor: unknown, noCampo: string, maximo: number): string {
  const lido = lerTexto(valor, maximo);
  if (lido.valido) return lido.valor;
  if (lido.motivo === 'caractere-nulo') {
    throw new CobrancaInvalida(`Há um caractere invisível (nulo) ${noCampo}, comum ao colar de outro programa. Apague e digite de novo.`);
  }
  if (lido.motivo === 'fora-do-limite') throw new CobrancaInvalida(`Use no máximo ${maximo} caracteres ${noCampo}.`);
  return '';
}

// [Cobranças.RF002] Valida a entrada da cobrança avulsa. `hoje` entra por parâmetro para o teste.
export function lerNovaCobrancaAvulsa(entrada: Partial<Record<keyof NovaCobrancaAvulsa, unknown>>, hoje: string): NovaCobrancaAvulsa {
  if (typeof entrada.alunoId !== 'string' || !UUID.test(entrada.alunoId)) {
    throw new CobrancaInvalida('Escolha o aluno na lista.');
  }
  const valor = lerValorDaCobranca(entrada.valorCentavos, 'o valor');
  const vencimento = lerDataDaCobranca(entrada.vencimento, 'o vencimento');
  // Fluxo E2: vencimento no passado não é aceito.
  if (vencimento < hoje) {
    throw new CobrancaInvalida('O vencimento não pode ser anterior a hoje. Escolha outra data.');
  }
  const descricao = lerTextoDaCobranca(entrada.descricao, 'na descrição', 200);
  if (descricao.length < 3) throw new CobrancaInvalida('Descreva a cobrança, por exemplo: Camiseta do CASD.');
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

// Filtro de data: vazio é "sem filtro"; preenchido, segue a mesma leitura do vencimento (lerDataDaCobranca).
function data(valor: unknown, nome: string): string | null {
  if (valor === undefined || valor === '') return null;
  return lerDataDaCobranca(valor, nome);
}

// Filtro numérico, também pela regra comum: acima do maior inteiro do banco, a consulta dava erro 500.
// Na URL tudo chega como texto, por isso o Number(...) antes de ler.
function inteiroNaoNegativo(valor: unknown, nome: string): number | null {
  if (valor === undefined || valor === '') return null;
  const lido = lerInteiroNaoNegativo(Number(valor));
  if (!lido.valido) throw new CobrancaInvalida(`Informe ${nome} como número inteiro, de 0 a ${MAIOR_INTEIRO_DO_BANCO}.`);
  return lido.valor;
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
  const pagoEm = lerDataDaCobranca(entrada.pagoEm, 'a data do pagamento');
  if (pagoEm > hoje) throw new CobrancaInvalida('A data do pagamento não pode ser no futuro.');
  const valor = lerValorDaCobranca(entrada.valorCentavos, 'o valor pago');
  const forma = FORMAS_MANUAIS.find((permitida) => permitida === entrada.formaPagamento);
  if (forma === undefined) throw new CobrancaInvalida('Escolha a forma do pagamento: Pix, transferência, dinheiro ou cartão.');
  // Fluxo E1: sem justificativa escrita, não há registro de por que o sistema passou a divergir do Asaas.
  const justificativa = lerTextoDaCobranca(entrada.justificativa, 'na justificativa', 500);
  if (justificativa.length < 10) {
    throw new CobrancaInvalida('A justificativa é obrigatória: explique como o pagamento foi comprovado (ex.: Pix recebido na conta do CASD).');
  }
  return { pagoEm, valorCentavos: valor, formaPagamento: forma, justificativa };
}

export function lerMotivoDoCancelamento(valor: unknown): string {
  const motivo = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
  if (motivo.length < 5) throw new CobrancaInvalida('Informe o motivo do cancelamento, por exemplo: renegociação em 3 parcelas.');
  if (motivo.length > 300) throw new CobrancaInvalida('Use no máximo 300 caracteres no motivo.');
  return motivo;
}

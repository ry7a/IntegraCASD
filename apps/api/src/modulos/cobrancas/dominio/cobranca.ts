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
  return { alunoId: entrada.alunoId, valorCentavos: valor, vencimento, descricao };
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

// Fábricas de dados FICTÍCIOS para os testes de integração e de sistema (LGPD: nada aqui é de gente real).
// Gravam direto pelo Prisma, para o teste montar só o que precisa. Cada registro leva um sufixo aleatório:
// todos os arquivos usam o mesmo banco, e nomes, e-mails e CPFs não podem se repetir entre eles.
import { randomInt, randomUUID } from 'node:crypto';
import type { ClienteAsaasFalso } from '../../src/compartilhado/asaas/cliente-asaas.falso.js';
import { criarHashDaSenha } from '../../src/compartilhado/autenticacao/senha.js';
import { deDia, hojeEmSaoPaulo } from '../../src/compartilhado/datas.js';
import type { PrismaService } from '../../src/compartilhado/prisma/prisma.service.js';
import type { OrigemCobranca, PerfilUsuario, TipoCategoria } from '../../src/generated/prisma/client.js';

export function sufixo(): string {
  return randomUUID().slice(0, 8);
}

// CPF com dígitos verificadores certos, sorteado. Não pertence a ninguém de propósito: é só uma conta.
export function gerarCpf(): string {
  let base: number[];
  do {
    base = Array.from({ length: 9 }, () => randomInt(10));
  } while (base.every((digito) => digito === base[0]));
  const digitoVerificador = (digitos: number[]) => {
    const soma = digitos.reduce((total, digito, posicao) => total + digito * (digitos.length + 1 - posicao), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const primeiro = digitoVerificador(base);
  const segundo = digitoVerificador([...base, primeiro]);
  return [...base, primeiro, segundo].join('');
}

// "AAAA-MM-DD" de hoje somado a `dias` (negativo = passado), no fuso de São Paulo.
export function diaDeHojeMais(dias: number): string {
  const hoje = deDia(hojeEmSaoPaulo());
  hoje.setUTCDate(hoje.getUTCDate() + dias);
  return hoje.toISOString().slice(0, 10);
}

export interface UsuarioDeTeste {
  id: string;
  email: string;
  senha: string;
}

export async function criarUsuario(prisma: PrismaService, perfil: PerfilUsuario = 'DIRETORIA'): Promise<UsuarioDeTeste> {
  const marca = sufixo();
  const email = `usuario.${marca}@exemplo.com`;
  const senha = `senha-de-teste-${marca}`;
  const usuario = await prisma.usuario.create({
    data: { nome: `Usuario Ficticio ${marca}`, email, senhaHash: await criarHashDaSenha(senha), perfil },
  });
  return { id: usuario.id, email, senha };
}

export async function criarAluno(prisma: PrismaService, dados: { email?: string; ativo?: boolean; cpf?: string } = {}) {
  const marca = sufixo();
  return prisma.aluno.create({
    data: {
      nome: `Aluno Ficticio ${marca}`,
      cpf: dados.cpf ?? gerarCpf(),
      email: dados.email ?? `aluno.${marca}@exemplo.com`,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function criarConta(prisma: PrismaService) {
  return prisma.conta.create({
    data: { nome: `Conta de teste ${sufixo()}`, tipo: 'CORRENTE', saldoInicialCentavos: 0, dataSaldoInicial: deDia('2026-01-01') },
  });
}

export async function criarCategoria(prisma: PrismaService, tipo: TipoCategoria) {
  return prisma.categoria.create({ data: { nome: `Categoria de teste ${sufixo()}`, tipo } });
}

export interface ParametrosDeTeste {
  contaId: string;
  categoriaMensalidadeId: string;
  categoriaAvulsaId: string;
  valorMensalidadeCentavos: number;
}

// Grava parâmetros de cobrança novos (passam a ser os vigentes), com conta e categorias de recebimento,
// para a conciliação e o registro manual saberem onde lançar a entrada.
export async function definirParametros(
  prisma: PrismaService,
  alteradoPorId: string,
  dados: { valorMensalidadeCentavos?: number; diaGeracao?: number; diaVencimento?: number } = {},
): Promise<ParametrosDeTeste> {
  const conta = await criarConta(prisma);
  const mensalidade = await criarCategoria(prisma, 'ENTRADA');
  const avulsa = await criarCategoria(prisma, 'ENTRADA');
  const valorMensalidadeCentavos = dados.valorMensalidadeCentavos ?? 8500;
  await prisma.parametrosCobranca.create({
    data: {
      valorMensalidadeCentavos,
      diaGeracao: dados.diaGeracao ?? 1,
      diaVencimento: dados.diaVencimento ?? 10,
      multaPercentual: 2,
      jurosMensalPercentual: 1,
      contaRecebimentoId: conta.id,
      categoriaMensalidadeId: mensalidade.id,
      categoriaAvulsaId: avulsa.id,
      alteradoPorId,
    },
  });
  return { contaId: conta.id, categoriaMensalidadeId: mensalidade.id, categoriaAvulsaId: avulsa.id, valorMensalidadeCentavos };
}

// Cobrança aberta que "existe no Asaas": grava aqui e, se o teste passar o Asaas falso, registra lá também.
// Respeita os CHECK do banco: só a avulsa fica sem mês de referência, e só a herdada fica sem id do Asaas.
export async function criarCobrancaAberta(
  prisma: PrismaService,
  asaas: ClienteAsaasFalso | null,
  dados: { alunoId: string; origem?: OrigemCobranca; valorCentavos?: number; vencimento?: string; referencia?: string },
) {
  const origem = dados.origem ?? 'AVULSA';
  const idAsaas = origem === 'HERDADA' ? null : `pay_teste_${sufixo()}`;
  const vencimento = dados.vencimento ?? diaDeHojeMais(10);
  const referencia = origem === 'AVULSA' ? null : (dados.referencia ?? vencimento.slice(0, 7));
  const valorCentavos = dados.valorCentavos ?? 8500;
  const cobranca = await prisma.cobranca.create({
    data: {
      idAsaas,
      referencia,
      alunoId: dados.alunoId,
      origem,
      descricao: 'Cobrança de teste',
      valorCentavos,
      vencimento: deDia(vencimento),
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    },
  });
  if (idAsaas === null) return cobranca;
  asaas?.noAsaas.set(idAsaas, {
    idAsaas,
    idCliente: `cus_teste_${sufixo()}`,
    situacao: 'PENDING',
    removida: false,
    valorCentavos,
    vencimento,
    descricao: 'Cobrança de teste',
    referenciaExterna: null,
    pagoEm: null,
    disponivelEm: null,
    multaPercentual: 2,
    jurosMensalPercentual: 1,
    urlBoleto: null,
    urlFatura: null,
  });
  return cobranca;
}

// Corpo de um aviso do Asaas, no formato do webhook (só os campos que o sistema lê).
export function avisoDoAsaas(idEvento: string, tipo: string, idCobrancaAsaas: string, valorEmReais: number, pagoEm: string) {
  return { id: idEvento, event: tipo, payment: { id: idCobrancaAsaas, value: valorEmReais, paymentDate: pagoEm } };
}

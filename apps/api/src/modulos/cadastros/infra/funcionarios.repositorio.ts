import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha, type OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { CadastroDuplicado } from '../dominio/comum.js';
import type { DadosDoFuncionario } from '../dominio/funcionario.js';

// O funcionário como a aplicação o enxerga: datas em "AAAA-MM-DD".
export type FuncionarioRegistrado = DadosDoFuncionario & { id: string };

type RegistroDoBanco = {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  salarioReferenciaCentavos: number;
  dataAdmissao: Date;
  dataDesligamento: Date | null;
};

const SELECAO = {
  id: true,
  nome: true,
  cpf: true,
  cargo: true,
  salarioReferenciaCentavos: true,
  dataAdmissao: true,
  dataDesligamento: true,
} as const;

function paraFuncionario(registro: RegistroDoBanco): FuncionarioRegistrado {
  return {
    ...registro,
    dataAdmissao: paraDia(registro.dataAdmissao),
    dataDesligamento: registro.dataDesligamento === null ? null : paraDia(registro.dataDesligamento),
  };
}

// Converte as datas do domínio ("AAAA-MM-DD") para o tipo que o Prisma grava em @db.Date.
function paraBanco(dados: Partial<DadosDoFuncionario>) {
  const { dataAdmissao, dataDesligamento, ...simples } = dados;
  return {
    ...simples,
    ...(dataAdmissao === undefined ? {} : { dataAdmissao: deDia(dataAdmissao) }),
    ...(dataDesligamento === undefined ? {} : { dataDesligamento: dataDesligamento === null ? null : deDia(dataDesligamento) }),
  };
}

function traduzirDuplicidade(erro: unknown): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    throw new CadastroDuplicado('Já existe um funcionário ativo com este CPF. Abra esse cadastro para atualizá-lo.');
  }
  throw erro;
}

// Acesso ao banco para funcionários [Cadastros.RF002].
// A coluna `ativo` acompanha a data de desligamento (fluxo A1) e é o que o índice de CPF único entre
// ativos usa. Quem decide a situação mostrada é o domínio (estaAtivo), com a data de hoje.
@Injectable()
export class FuncionariosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<FuncionarioRegistrado[]> {
    const registros = await this.prisma.funcionario.findMany({ select: SELECAO, orderBy: { nome: 'asc' } });
    return registros.map(paraFuncionario);
  }

  async buscarPorId(id: string): Promise<FuncionarioRegistrado | null> {
    const registro = await this.prisma.funcionario.findUnique({ where: { id }, select: SELECAO });
    return registro === null ? null : paraFuncionario(registro);
  }

  // Outro funcionário ainda ativo hoje (sem desligamento, ou com desligamento depois de hoje) com o CPF.
  async outroAtivoComCpf(cpf: string, hoje: string, excetoId?: string): Promise<{ id: string; nome: string } | null> {
    return this.prisma.funcionario.findFirst({
      where: {
        cpf,
        OR: [{ dataDesligamento: null }, { dataDesligamento: { gt: deDia(hoje) } }],
        ...(excetoId === undefined ? {} : { id: { not: excetoId } }),
      },
      select: { id: true, nome: true },
    });
  }

  async criar(dados: DadosDoFuncionario, ativo: boolean, hoje: string, autorId: string): Promise<FuncionarioRegistrado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await sincronizarDesligadosAteHoje(tx, dados.cpf, hoje);
        const criado = await tx.funcionario.create({ data: { ...dadosParaInclusao(dados), ativo }, select: SELECAO });
        await registrarNaTrilha(tx, {
          usuarioId: autorId,
          operacao: 'INCLUSAO',
          entidade: 'FUNCIONARIO',
          registroId: criado.id,
          detalhe: 'Funcionário incluído.',
        });
        return paraFuncionario(criado);
      });
    } catch (erro) {
      return traduzirDuplicidade(erro);
    }
  }

  async alterar(
    id: string,
    dados: Partial<DadosDoFuncionario>,
    ativo: boolean,
    operacao: OperacaoAuditada,
    hoje: string,
    autorId: string,
  ): Promise<FuncionarioRegistrado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (ativo && dados.cpf !== undefined) await sincronizarDesligadosAteHoje(tx, dados.cpf, hoje);
        const alterado = await tx.funcionario.update({ where: { id }, data: { ...paraBanco(dados), ativo }, select: SELECAO });
        await registrarNaTrilha(tx, {
          usuarioId: autorId,
          operacao,
          entidade: 'FUNCIONARIO',
          registroId: alterado.id,
          // Só os nomes dos campos, nunca os valores (LGPD: a trilha não pode ser apagada).
          detalhe: `Funcionário alterado: ${Object.keys(dados).join(', ') || 'situação'}.`,
        });
        return paraFuncionario(alterado);
      });
    } catch (erro) {
      return traduzirDuplicidade(erro);
    }
  }
}

// Na inclusão o Prisma exige todos os campos obrigatórios; aqui eles saem do domínio já validados.
function dadosParaInclusao(dados: DadosDoFuncionario) {
  return {
    nome: dados.nome,
    cpf: dados.cpf,
    cargo: dados.cargo,
    salarioReferenciaCentavos: dados.salarioReferenciaCentavos,
    dataAdmissao: deDia(dados.dataAdmissao),
    dataDesligamento: dados.dataDesligamento === null ? null : deDia(dados.dataDesligamento),
  };
}

// Quem teve o desligamento marcado para uma data que já chegou ainda pode estar com `ativo = true`
// no banco. Antes de gravar alguém ativo com o mesmo CPF (readmissão), alinha a coluna com a data.
async function sincronizarDesligadosAteHoje(tx: Prisma.TransactionClient, cpf: string, hoje: string): Promise<void> {
  await tx.funcionario.updateMany({
    where: { cpf, ativo: true, dataDesligamento: { lte: deDia(hoje) } },
    data: { ativo: false },
  });
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha, type OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { CadastroDuplicado } from '../dominio/aluno.js';
import type { Alojamento, Curso, DadosDoAluno, Posto } from '../dominio/aluno.js';

export type FiltroDeSituacao = 'ativos' | 'inativos' | 'todos';

// O aluno como a aplicação o enxerga: turma e alojamento já resolvidos.
export type AlunoRegistrado = {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  celular: string | null;
  apelido: string | null;
  matricula: number | null;
  turma: string | null;
  curso: Curso | null;
  posto: Posto | null;
  alojamento: Alojamento | null;
  ativo: boolean;
};

const INCLUSAO = { turma: true, alojamento: true } as const;

type RegistroDoBanco = Prisma.AlunoGetPayload<{ include: typeof INCLUSAO }>;

function paraAluno(registro: RegistroDoBanco): AlunoRegistrado {
  return {
    id: registro.id,
    nome: registro.nome,
    cpf: registro.cpf,
    email: registro.email,
    celular: registro.celular,
    apelido: registro.apelido,
    matricula: registro.matricula,
    turma: registro.turma?.nome ?? null,
    curso: registro.curso,
    posto: registro.posto,
    alojamento: registro.alojamento
      ? { bloco: registro.alojamento.bloco, apto: registro.alojamento.apto, vaga: registro.alojamento.vaga }
      : null,
    ativo: registro.ativo,
  };
}

// Os índices únicos do banco são a última barreira (dois cadastros ao mesmo tempo): CPF entre
// ativos, matrícula e vaga ocupada por aluno ativo.
function traduzirDuplicidade(erro: unknown): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    const alvo = JSON.stringify(erro.meta ?? {});
    if (alvo.includes('alojamento')) throw new CadastroDuplicado('Esta vaga já está ocupada por outro aluno ativo.');
    if (alvo.includes('matricula')) throw new CadastroDuplicado('Esta matrícula já pertence a outro aluno.');
    throw new CadastroDuplicado('Já existe um cadastro ativo com este CPF. Abra esse cadastro para atualizá-lo.');
  }
  throw erro;
}

// Acesso ao banco para alunos. Só esta camada conhece o Prisma; o caso de uso
// recebe os registros e não sabe como foram buscados.
@Injectable()
export class AlunosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(situacao: FiltroDeSituacao): Promise<AlunoRegistrado[]> {
    const registros = await this.prisma.aluno.findMany({
      where: situacao === 'todos' ? {} : { ativo: situacao === 'ativos' },
      orderBy: { nome: 'asc' },
      include: INCLUSAO,
    });
    return registros.map(paraAluno);
  }

  async buscarPorId(id: string): Promise<AlunoRegistrado | null> {
    const registro = await this.prisma.aluno.findUnique({ where: { id }, include: INCLUSAO });
    return registro === null ? null : paraAluno(registro);
  }

  async buscarAtivoPorCpf(cpf: string, excetoId?: string): Promise<{ id: string; nome: string } | null> {
    return this.prisma.aluno.findFirst({
      where: { cpf, ativo: true, ...(excetoId === undefined ? {} : { id: { not: excetoId } }) },
      select: { id: true, nome: true },
    });
  }

  async matriculaEmUso(matricula: number, excetoId?: string): Promise<boolean> {
    const quantidade = await this.prisma.aluno.count({
      where: { matricula, ...(excetoId === undefined ? {} : { id: { not: excetoId } }) },
    });
    return quantidade > 0;
  }

  async vagaOcupada(alojamento: Alojamento, excetoId?: string): Promise<boolean> {
    const quantidade = await this.prisma.aluno.count({
      where: {
        ativo: true,
        alojamento: { is: alojamento },
        ...(excetoId === undefined ? {} : { id: { not: excetoId } }),
      },
    });
    return quantidade > 0;
  }

  async listarTurmas(): Promise<string[]> {
    const turmas = await this.prisma.turma.findMany({ select: { nome: true }, orderBy: { nome: 'desc' } });
    return turmas.map((turma) => turma.nome);
  }

  async criar(dados: DadosDoAluno, autorId: string): Promise<AlunoRegistrado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { turma, alojamento, ...simples } = dados;
        const criado = await tx.aluno.create({
          data: { ...simples, ...(await idsDeTurmaEVaga(tx, { turma, alojamento })), ativo: true },
          include: INCLUSAO,
        });
        await registrarNaTrilha(tx, {
          usuarioId: autorId,
          operacao: 'INCLUSAO',
          entidade: 'ALUNO',
          registroId: criado.id,
          detalhe: 'Aluno incluído.',
        });
        return paraAluno(criado);
      });
    } catch (erro) {
      return traduzirDuplicidade(erro);
    }
  }

  async alterar(
    id: string,
    dados: Partial<DadosDoAluno> & { ativo?: boolean },
    operacao: OperacaoAuditada,
    autorId: string,
  ): Promise<AlunoRegistrado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { turma, alojamento, ...simples } = dados;
        const alterado = await tx.aluno.update({
          where: { id },
          data: { ...simples, ...(await idsDeTurmaEVaga(tx, { turma, alojamento })) },
          include: INCLUSAO,
        });
        await registrarNaTrilha(tx, {
          usuarioId: autorId,
          operacao,
          entidade: 'ALUNO',
          registroId: alterado.id,
          // Só os nomes dos campos, nunca os valores (LGPD: a trilha não pode ser apagada).
          detalhe: `Aluno alterado: ${Object.keys(dados).join(', ')}.`,
        });
        return paraAluno(alterado);
      });
    } catch (erro) {
      return traduzirDuplicidade(erro);
    }
  }
}

// Turma e vaga são tabelas: procura pelo nome (ou bloco + apto + vaga) e cria se ainda não existir.
// Devolve só os ids que mudam: campo ausente em `dados` não aparece no resultado.
async function idsDeTurmaEVaga(
  tx: Prisma.TransactionClient,
  dados: Partial<Pick<DadosDoAluno, 'turma' | 'alojamento'>>,
): Promise<{ turmaId?: string | null; alojamentoId?: string | null }> {
  const ids: { turmaId?: string | null; alojamentoId?: string | null } = {};
  if (dados.turma === null) ids.turmaId = null;
  if (dados.turma) {
    const turma = await tx.turma.upsert({
      where: { nome: dados.turma },
      create: { nome: dados.turma },
      update: {},
      select: { id: true },
    });
    ids.turmaId = turma.id;
  }
  if (dados.alojamento === null) ids.alojamentoId = null;
  if (dados.alojamento) {
    const vaga = await tx.alojamento.upsert({
      where: { bloco_apto_vaga: dados.alojamento },
      create: dados.alojamento,
      update: {},
      select: { id: true },
    });
    ids.alojamentoId = vaga.id;
  }
  return ids;
}

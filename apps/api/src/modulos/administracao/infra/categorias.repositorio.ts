import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { NomeDeCategoriaDuplicado } from '../dominio/categoria.js';
import type { TipoDeCategoria, UsoDaCategoria } from '../dominio/categoria.js';

export type CategoriaComUso = {
  id: string;
  nome: string;
  tipo: TipoDeCategoria;
  ativo: boolean;
  quantidadeMovimentacoes: number;
};

export type OperacaoNaCategoria = 'INCLUSAO' | 'ALTERACAO' | 'INATIVACAO' | 'REATIVACAO';

// Campos lidos em toda consulta: a categoria e quantas movimentações a usam.
const SELECAO = {
  id: true,
  nome: true,
  tipo: true,
  ativo: true,
  _count: { select: { movimentacoes: true } },
} as const;

type RegistroDoBanco = {
  id: string;
  nome: string;
  tipo: TipoDeCategoria;
  ativo: boolean;
  _count: { movimentacoes: number };
};

function paraCategoriaComUso({ _count, ...categoria }: RegistroDoBanco): CategoriaComUso {
  return { ...categoria, quantidadeMovimentacoes: _count.movimentacoes };
}

// O índice parcial "categorias_nome_ativa_key" é a última barreira contra nome duplicado:
// cobre o caso raro de duas pessoas criarem o mesmo nome ao mesmo tempo.
function ehNomeDuplicado(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

// Acesso ao banco para categorias. A auditoria é gravada aqui, na mesma transação da
// alteração, até existir o ponto central de auditoria (interceptor).
@Injectable()
export class CategoriasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<CategoriaComUso[]> {
    const registros = await this.prisma.categoria.findMany({
      select: SELECAO,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
    return registros.map(paraCategoriaComUso);
  }

  async buscarPorId(id: string): Promise<CategoriaComUso | null> {
    const registro = await this.prisma.categoria.findUnique({ where: { id }, select: SELECAO });
    return registro === null ? null : paraCategoriaComUso(registro);
  }

  // Compara sem diferenciar maiúsculas: "Zeladoria" e "zeladoria" contam como o mesmo nome.
  async existeAtivaComNome(nome: string, excetoId?: string): Promise<boolean> {
    const quantidade = await this.prisma.categoria.count({
      where: {
        ativo: true,
        nome: { equals: nome, mode: 'insensitive' },
        ...(excetoId === undefined ? {} : { id: { not: excetoId } }),
      },
    });
    return quantidade > 0;
  }

  async contarUsoPorTipo(id: string): Promise<UsoDaCategoria> {
    const grupos = await this.prisma.movimentacao.groupBy({
      by: ['tipo'],
      where: { categoriaId: id },
      _count: { _all: true },
    });
    const quantidadeDo = (tipo: 'ENTRADA' | 'SAIDA') =>
      grupos.find((grupo) => grupo.tipo === tipo)?._count._all ?? 0;
    return { entradas: quantidadeDo('ENTRADA'), saidas: quantidadeDo('SAIDA') };
  }

  async criar(dados: { nome: string; tipo: TipoDeCategoria }, autorId: string): Promise<CategoriaComUso> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.categoria.create({ data: dados, select: SELECAO });
        await tx.registroAuditoria.create({
          data: {
            usuarioId: autorId,
            operacao: 'INCLUSAO',
            entidade: 'CATEGORIA',
            registroId: criada.id,
            detalhe: `Categoria "${criada.nome}" incluída (tipo ${criada.tipo}).`,
          },
        });
        return paraCategoriaComUso(criada);
      });
    } catch (erro) {
      if (ehNomeDuplicado(erro)) throw new NomeDeCategoriaDuplicado(dados.nome);
      throw erro;
    }
  }

  async alterar(
    id: string,
    dados: { nome?: string; tipo?: TipoDeCategoria; ativo?: boolean },
    operacao: OperacaoNaCategoria,
    autorId: string,
  ): Promise<CategoriaComUso> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const alterada = await tx.categoria.update({ where: { id }, data: dados, select: SELECAO });
        await tx.registroAuditoria.create({
          data: {
            usuarioId: autorId,
            operacao,
            entidade: 'CATEGORIA',
            registroId: alterada.id,
            detalhe: `Categoria "${alterada.nome}": ${Object.keys(dados).join(', ')} alterado(s).`,
          },
        });
        return paraCategoriaComUso(alterada);
      });
    } catch (erro) {
      if (ehNomeDuplicado(erro)) throw new NomeDeCategoriaDuplicado(dados.nome);
      throw erro;
    }
  }
}

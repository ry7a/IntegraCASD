import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { CHAVE_DO_CODIGO_DE_PROJETO, reservarSequenciaDoCodigo } from './codigo-sequencial.js';
import { proximoCodigo, type DadosDoProjeto } from '../dominio/projeto.js';

// O projeto como a aplicação o enxerga: datas em "AAAA-MM-DD".
export type ProjetoRegistrado = DadosDoProjeto & { id: string; codigo: string };

const SELECAO = {
  id: true,
  codigo: true,
  nome: true,
  responsavel: true,
  dataInicio: true,
  dataFim: true,
  orcamentoPrevistoCentavos: true,
  situacao: true,
} as const;

type RegistroDoBanco = Prisma.ProjetoGetPayload<{ select: typeof SELECAO }>;

function paraProjeto(registro: RegistroDoBanco): ProjetoRegistrado {
  return {
    id: registro.id,
    codigo: registro.codigo,
    nome: registro.nome,
    responsavel: registro.responsavel,
    dataInicio: paraDia(registro.dataInicio),
    dataFim: registro.dataFim === null ? null : paraDia(registro.dataFim),
    orcamentoPrevistoCentavos: registro.orcamentoPrevistoCentavos,
    situacao: registro.situacao,
  };
}

// Converte as datas do domínio ("AAAA-MM-DD") para o tipo que o Prisma grava em @db.Date.
function paraBanco(dados: Partial<DadosDoProjeto>) {
  const { dataInicio, dataFim, ...simples } = dados;
  return {
    ...simples,
    ...(dataInicio === undefined ? {} : { dataInicio: deDia(dataInicio) }),
    ...(dataFim === undefined ? {} : { dataFim: dataFim === null ? null : deDia(dataFim) }),
  };
}

// Acesso ao banco para projetos [Cadastros.RF005]. A trilha é gravada na mesma transação.
@Injectable()
export class ProjetosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<ProjetoRegistrado[]> {
    const registros = await this.prisma.projeto.findMany({ select: SELECAO, orderBy: [{ dataInicio: 'desc' }, { codigo: 'desc' }] });
    return registros.map(paraProjeto);
  }

  async buscarPorId(id: string): Promise<ProjetoRegistrado | null> {
    const registro = await this.prisma.projeto.findUnique({ where: { id }, select: SELECAO });
    return registro === null ? null : paraProjeto(registro);
  }

  // O código é gerado aqui (MER, regra 7). O lock faz duas criações simultâneas esperarem uma pela outra
  // (ver codigo-sequencial.ts): sem ele, as duas leriam o mesmo último número e a segunda falharia.
  async criar(dados: DadosDoProjeto, ano: string, autorId: string): Promise<ProjetoRegistrado> {
    return this.prisma.$transaction(async (tx) => {
      await reservarSequenciaDoCodigo(tx, CHAVE_DO_CODIGO_DE_PROJETO);
      const doAno = await tx.projeto.findMany({ where: { codigo: { startsWith: `${ano.slice(2, 4)}P` } }, select: { codigo: true } });
      const codigo = proximoCodigo(ano, doAno.map((projeto) => projeto.codigo));
      const criado = await tx.projeto.create({
        data: {
          codigo,
          nome: dados.nome,
          responsavel: dados.responsavel,
          dataInicio: deDia(dados.dataInicio),
          dataFim: dados.dataFim === null ? null : deDia(dados.dataFim),
          orcamentoPrevistoCentavos: dados.orcamentoPrevistoCentavos,
          situacao: dados.situacao,
        },
        select: SELECAO,
      });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'INCLUSAO',
        entidade: 'PROJETO',
        registroId: criado.id,
        detalhe: `Projeto ${codigo} incluído: ${dados.nome}.`,
      });
      return paraProjeto(criado);
    });
  }

  async alterar(id: string, dados: Partial<DadosDoProjeto>, autorId: string): Promise<ProjetoRegistrado> {
    return this.prisma.$transaction(async (tx) => {
      const alterado = await tx.projeto.update({ where: { id }, data: paraBanco(dados), select: SELECAO });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'PROJETO',
        registroId: id,
        detalhe:
          `Projeto ${alterado.codigo}: ${Object.keys(dados).join(', ')} alterado(s)` +
          (dados.situacao === undefined ? '.' : `; situação agora ${dados.situacao}.`),
      });
      return paraProjeto(alterado);
    });
  }
}

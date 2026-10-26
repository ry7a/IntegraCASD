import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { proximoCodigo, type DadosDoContrato } from '../dominio/contrato.js';

// O contrato como a aplicação o enxerga: datas em "AAAA-MM-DD".
export type ContratoRegistrado = DadosDoContrato & {
  id: string;
  codigo: string;
  encerrado: boolean;
  dataEncerramento: string | null;
  justificativaEncerramento: string | null;
};

const SELECAO = {
  id: true,
  codigo: true,
  contraparte: true,
  objeto: true,
  valorCentavos: true,
  periodicidade: true,
  dataInicio: true,
  dataFim: true,
  situacao: true,
  dataEncerramento: true,
  justificativaEncerramento: true,
} as const;

type RegistroDoBanco = Prisma.ContratoGetPayload<{ select: typeof SELECAO }>;

function paraContrato(registro: RegistroDoBanco): ContratoRegistrado {
  return {
    id: registro.id,
    codigo: registro.codigo,
    contraparte: registro.contraparte,
    objeto: registro.objeto,
    valorCentavos: registro.valorCentavos,
    periodicidade: registro.periodicidade,
    dataInicio: paraDia(registro.dataInicio),
    dataFim: registro.dataFim === null ? null : paraDia(registro.dataFim),
    encerrado: registro.situacao === 'ENCERRADO',
    dataEncerramento: registro.dataEncerramento === null ? null : paraDia(registro.dataEncerramento),
    justificativaEncerramento: registro.justificativaEncerramento,
  };
}

// Converte as datas do domínio ("AAAA-MM-DD") para o tipo que o Prisma grava em @db.Date.
function paraBanco(dados: Partial<DadosDoContrato>) {
  const { dataInicio, dataFim, ...simples } = dados;
  return {
    ...simples,
    ...(dataInicio === undefined ? {} : { dataInicio: deDia(dataInicio) }),
    ...(dataFim === undefined ? {} : { dataFim: dataFim === null ? null : deDia(dataFim) }),
  };
}

// Acesso ao banco para contratos [Cadastros.RF004]. A trilha é gravada na mesma transação.
@Injectable()
export class ContratosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<ContratoRegistrado[]> {
    const registros = await this.prisma.contrato.findMany({ select: SELECAO, orderBy: [{ dataInicio: 'desc' }, { codigo: 'desc' }] });
    return registros.map(paraContrato);
  }

  async buscarPorId(id: string): Promise<ContratoRegistrado | null> {
    const registro = await this.prisma.contrato.findUnique({ where: { id }, select: SELECAO });
    return registro === null ? null : paraContrato(registro);
  }

  // O código é gerado aqui (MER, regra 7). Se dois cadastros simultâneos pegarem o mesmo número, o
  // índice único recusa o segundo, que tenta de novo com o número seguinte.
  async criar(dados: DadosDoContrato, ano: string, autorId: string): Promise<ContratoRegistrado> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const doAno = await tx.contrato.findMany({ where: { codigo: { startsWith: `${ano.slice(2, 4)}C` } }, select: { codigo: true } });
          const codigo = proximoCodigo(ano, doAno.map((contrato) => contrato.codigo));
          const criado = await tx.contrato.create({
            data: {
              codigo,
              contraparte: dados.contraparte,
              objeto: dados.objeto,
              valorCentavos: dados.valorCentavos,
              periodicidade: dados.periodicidade,
              dataInicio: deDia(dados.dataInicio),
              dataFim: dados.dataFim === null ? null : deDia(dados.dataFim),
            },
            select: SELECAO,
          });
          await registrarNaTrilha(tx, {
            usuarioId: autorId,
            operacao: 'INCLUSAO',
            entidade: 'CONTRATO',
            registroId: criado.id,
            detalhe: `Contrato ${codigo} incluído: ${dados.contraparte} (${dados.objeto}).`,
          });
          return paraContrato(criado);
        });
      } catch (erro) {
        const duplicado = erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
        if (!duplicado || tentativa >= 3) throw erro;
      }
    }
  }

  async alterar(id: string, dados: Partial<DadosDoContrato>, autorId: string): Promise<ContratoRegistrado> {
    return this.prisma.$transaction(async (tx) => {
      const alterado = await tx.contrato.update({ where: { id }, data: paraBanco(dados), select: SELECAO });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'CONTRATO',
        registroId: id,
        detalhe: `Contrato ${alterado.codigo}: ${Object.keys(dados).join(', ')} alterado(s).`,
      });
      return paraContrato(alterado);
    });
  }

  // Fluxo A1: as movimentações já registradas não mudam.
  async encerrar(id: string, dataEncerramento: string, justificativa: string, autorId: string): Promise<ContratoRegistrado> {
    return this.prisma.$transaction(async (tx) => {
      const encerrado = await tx.contrato.update({
        where: { id },
        data: { situacao: 'ENCERRADO', dataEncerramento: deDia(dataEncerramento), justificativaEncerramento: justificativa },
        select: SELECAO,
      });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'INATIVACAO',
        entidade: 'CONTRATO',
        registroId: id,
        detalhe: `Contrato ${encerrado.codigo} encerrado em ${dataEncerramento}. Justificativa: ${justificativa}`,
      });
      return paraContrato(encerrado);
    });
  }
}

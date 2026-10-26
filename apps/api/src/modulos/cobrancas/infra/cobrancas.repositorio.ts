import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { SituacaoGuardada } from '../dominio/cobranca.js';

export type OrigemDaCobranca = 'MENSALIDADE' | 'AVULSA';

// A cobrança como a aplicação a enxerga: datas em "AAAA-MM-DD".
export type CobrancaRegistrada = {
  id: string;
  idAsaas: string;
  alunoId: string;
  alunoNome: string;
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  situacao: SituacaoGuardada;
  urlBoleto: string | null;
  urlFatura: string | null;
  pagaEm: string | null;
};

export type DadosDaNovaCobranca = {
  idAsaas: string;
  alunoId: string;
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  urlBoleto: string | null;
  urlFatura: string | null;
};

const INCLUSAO = { aluno: { select: { nome: true } } } as const;

type RegistroDoBanco = {
  id: string;
  idAsaas: string;
  alunoId: string;
  aluno: { nome: string };
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: Date;
  multaPercentual: number;
  jurosMensalPercentual: number;
  situacao: SituacaoGuardada;
  urlBoleto: string | null;
  urlFatura: string | null;
  pagaEm: Date | null;
};

// Campo a campo (e não espalhando o registro): o banco tem colunas internas que não saem daqui.
function paraCobranca(registro: RegistroDoBanco): CobrancaRegistrada {
  return {
    id: registro.id,
    idAsaas: registro.idAsaas,
    alunoId: registro.alunoId,
    alunoNome: registro.aluno.nome,
    origem: registro.origem,
    referencia: registro.referencia,
    descricao: registro.descricao,
    valorCentavos: registro.valorCentavos,
    vencimento: paraDia(registro.vencimento),
    multaPercentual: registro.multaPercentual,
    jurosMensalPercentual: registro.jurosMensalPercentual,
    situacao: registro.situacao,
    urlBoleto: registro.urlBoleto,
    urlFatura: registro.urlFatura,
    pagaEm: registro.pagaEm === null ? null : paraDia(registro.pagaEm),
  };
}

// Acesso ao banco para cobranças e para o vínculo aluno -> cliente do Asaas.
@Injectable()
export class CobrancasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async idClienteAsaasDoAluno(alunoId: string): Promise<string | null> {
    const vinculo = await this.prisma.clienteAsaas.findUnique({ where: { alunoId } });
    return vinculo?.idAsaas ?? null;
  }

  async registrarClienteAsaas(alunoId: string, idAsaas: string): Promise<void> {
    await this.prisma.clienteAsaas.create({ data: { alunoId, idAsaas } });
  }

  // Grava a cobrança que o Asaas acabou de criar, com a trilha, na mesma transação.
  // `autorId` nulo = rotina automática (geração recorrente).
  async registrar(dados: DadosDaNovaCobranca, autorId: string | null): Promise<CobrancaRegistrada> {
    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.cobranca.create({
        data: { ...dados, vencimento: deDia(dados.vencimento), emitidaPorId: autorId },
        include: INCLUSAO,
      });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'INCLUSAO',
        entidade: 'COBRANCA',
        registroId: criada.id,
        detalhe: `Cobrança ${dados.origem === 'AVULSA' ? 'avulsa' : 'de mensalidade'} "${dados.descricao}" emitida no Asaas (${dados.idAsaas}).`,
      });
      return paraCobranca(criada);
    });
  }
}

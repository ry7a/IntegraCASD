import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { FalhaDaGeracao } from '../dominio/geracao-recorrente.js';

export type OrigemDaExecucao = 'AGENDADA' | 'MANUAL';

export type ExecucaoRegistrada = {
  id: string;
  referencia: string;
  origem: OrigemDaExecucao;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  totalCriadas: number;
  totalJaExistentes: number;
  totalFalhas: number;
  falhas: FalhaDaGeracao[];
  interrompida: boolean;
};

export type ResultadoDaExecucao = Pick<
  ExecucaoRegistrada,
  'totalCriadas' | 'totalJaExistentes' | 'totalFalhas' | 'falhas' | 'interrompida'
>;

type RegistroDoBanco = Omit<ExecucaoRegistrada, 'falhas'> & { falhas: unknown };

function paraExecucao(registro: RegistroDoBanco): ExecucaoRegistrada {
  return { ...registro, falhas: Array.isArray(registro.falhas) ? (registro.falhas as FalhaDaGeracao[]) : [] };
}

// Registro das execuções da geração recorrente [Confiabilidade.NF007].
@Injectable()
export class ExecucoesRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async iniciar(referencia: string, origem: OrigemDaExecucao): Promise<string> {
    const criada = await this.prisma.execucaoGeracao.create({ data: { referencia, origem }, select: { id: true } });
    return criada.id;
  }

  async finalizar(id: string, resultado: ResultadoDaExecucao): Promise<void> {
    await this.prisma.execucaoGeracao.update({
      where: { id },
      data: { ...resultado, falhas: resultado.falhas, finalizadaEm: new Date() },
    });
  }

  async ultimaDoMes(referencia: string): Promise<ExecucaoRegistrada | null> {
    const registro = await this.prisma.execucaoGeracao.findFirst({ where: { referencia }, orderBy: { iniciadaEm: 'desc' } });
    return registro === null ? null : paraExecucao(registro);
  }

  async ultimas(quantidade: number): Promise<ExecucaoRegistrada[]> {
    const registros = await this.prisma.execucaoGeracao.findMany({ orderBy: { iniciadaEm: 'desc' }, take: quantidade });
    return registros.map(paraExecucao);
  }
}

import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../auditoria/trilha.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AmbienteAsaas } from './cliente-asaas.js';

export type ConfiguracaoGuardada = {
  id: string;
  ambiente: AmbienteAsaas;
  chaveCifrada: string;
  prazoAlertaHoras: number;
  testadaEm: Date;
  cadastradaEm: Date;
  alteradoPor: string;
};

export type NovaConfiguracao = {
  ambiente: AmbienteAsaas;
  chaveCifrada: string;
  prazoAlertaHoras: number;
  testadaEm: Date;
};

// Configuração da integração com o Asaas [Administração.RF004]. Uma linha por alteração; a vigente é a
// mais recente. A chave só circula cifrada aqui, e a trilha registra a operação sem ela [Segurança.NF003].
@Injectable()
export class ConfiguracaoAsaasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async vigente(): Promise<ConfiguracaoGuardada | null> {
    const registro = await this.prisma.configuracaoAsaas.findFirst({
      orderBy: { dataCriacao: 'desc' },
      include: { alteradoPor: { select: { nome: true } } },
    });
    if (registro === null) return null;
    return {
      id: registro.id,
      ambiente: registro.ambiente,
      chaveCifrada: registro.chaveCifrada,
      prazoAlertaHoras: registro.prazoAlertaHoras,
      testadaEm: registro.testadaEm,
      cadastradaEm: registro.dataCriacao,
      alteradoPor: registro.alteradoPor.nome,
    };
  }

  async gravar(nova: NovaConfiguracao, autorId: string, descricaoDaOperacao: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const criada = await tx.configuracaoAsaas.create({ data: { ...nova, alteradoPorId: autorId } });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'CONFIGURACAO',
        registroId: criada.id,
        // Nunca a chave: só o que mudou, em palavras.
        detalhe: descricaoDaOperacao,
      });
    });
  }
}

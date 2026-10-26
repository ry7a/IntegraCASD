import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';

export type AlertaAbertoRegistrado = { id: string; ultimoEnvioEm: Date | null; envios: number };

export type NovoAlerta = {
  abertoEm: Date;
  ultimaNotificacaoEm: Date | null;
  horasSemNotificacao: number;
  prazoHoras: number;
};

// Acesso ao banco para os alertas de interrupção da conciliação [Confiabilidade.NF002]. É uma rotina
// automática: a trilha grava com `usuarioId: null`. Nenhum e-mail de usuário nem segredo entra no texto.
@Injectable()
export class AlertasDeConciliacaoRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // O alerta ainda aberto (o mais recente, se por algum motivo houver mais de um).
  abertoAtual(): Promise<AlertaAbertoRegistrado | null> {
    return this.prisma.alertaDeConciliacao.findFirst({
      where: { resolvidoEm: null },
      orderBy: { abertoEm: 'desc' },
      select: { id: true, ultimoEnvioEm: true, envios: true },
    });
  }

  abrir(dados: NovoAlerta): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.alertaDeConciliacao.create({ data: dados, select: { id: true } });
      await registrarNaTrilha(tx, {
        usuarioId: null,
        operacao: 'INCLUSAO',
        entidade: 'ALERTA_DE_CONCILIACAO',
        registroId: criado.id,
        detalhe: `Alerta aberto: o Asaas está há ${dados.horasSemNotificacao} horas sem enviar notificações (prazo de ${dados.prazoHoras} horas).`,
      });
      return criado;
    });
  }

  registrarEnvio(id: string, quando: Date, destinatarios: number): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.alertaDeConciliacao.update({
        where: { id },
        data: { envios: { increment: 1 }, ultimoEnvioEm: quando },
        select: { envios: true },
      });
      await registrarNaTrilha(tx, {
        usuarioId: null,
        operacao: 'ALTERACAO',
        entidade: 'ALERTA_DE_CONCILIACAO',
        registroId: id,
        detalhe: `E-mail do alerta enviado a ${destinatarios} destinatário(s) (envio nº ${atualizado.envios}).`,
      });
    });
  }

  resolver(id: string, quando: Date): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.alertaDeConciliacao.update({ where: { id }, data: { resolvidoEm: quando } });
      await registrarNaTrilha(tx, {
        usuarioId: null,
        operacao: 'ALTERACAO',
        entidade: 'ALERTA_DE_CONCILIACAO',
        registroId: id,
        detalhe: 'As notificações do Asaas voltaram: alerta encerrado.',
      });
    });
  }
}

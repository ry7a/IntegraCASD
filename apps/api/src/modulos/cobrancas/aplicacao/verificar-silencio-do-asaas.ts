import { Injectable } from '@nestjs/common';
import { destinatariosFixosDosAlertas } from '../../../compartilhado/notificacao/destinatarios-dos-alertas.js';
import { NotificadorDeAlertas } from '../../../compartilhado/notificacao/notificador-de-alertas.js';
import { ConsultarIntegracaoAsaas, ListarEmailsDaDiretoria } from '../../administracao/index.js';
import {
  decidir,
  estaParado,
  horasDeSilencio,
  inicioDoSilencio,
  montarAlerta,
  type Decisao,
} from '../dominio/silencio-do-asaas.js';
import { AlertasDeConciliacaoRepositorio } from '../infra/alertas-de-conciliacao.repositorio.js';
import { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';

export type ResultadoDaVigilancia =
  // Sem chave do Asaas em lugar nenhum: não há integração para vigiar.
  | { situacao: 'SEM_INTEGRACAO' }
  // Nenhum evento recebido e nenhuma data de cadastro da chave: não há de onde contar o silêncio.
  | { situacao: 'SEM_REFERENCIA' }
  | {
      situacao: 'MEDIDO';
      parado: boolean;
      horasSemNotificacao: number;
      prazoHoras: number;
      acao: Decisao;
      // Só quando a ação pedia um e-mail: se saiu e, se não saiu, o motivo.
      envio: { enviado: true; destinatarios: number } | { enviado: false; motivo: string } | null;
    };

// Caso de uso [Confiabilidade.NF002]: roda a cada 30 minutos no worker (rotina de vigilância). Mede há quanto
// tempo o Asaas não envia notificações e, passado o prazo configurado, avisa a diretoria por e-mail. Um alerta
// por interrupção: não repete o e-mail a cada verificação, lembra a cada 24 horas e encerra quando as
// notificações voltam. É seguro rodar duas vezes seguidas: a segunda não encontra nada novo a fazer.
@Injectable()
export class VerificarSilencioDoAsaas {
  constructor(
    private readonly integracao: ConsultarIntegracaoAsaas,
    private readonly eventos: EventosWebhookRepositorio,
    private readonly alertas: AlertasDeConciliacaoRepositorio,
    private readonly diretoria: ListarEmailsDaDiretoria,
    private readonly notificador: NotificadorDeAlertas,
  ) {}

  async executar(agora = new Date()): Promise<ResultadoDaVigilancia> {
    const situacao = await this.integracao.executar();
    if (!situacao.conectada) return { situacao: 'SEM_INTEGRACAO' };

    const ultimaNotificacaoEm = await this.eventos.ultimaRecebidaEm();
    const inicio = inicioDoSilencio(ultimaNotificacaoEm, situacao.chaveCadastradaEm);
    if (inicio === null) return { situacao: 'SEM_REFERENCIA' };

    const prazoHoras = situacao.prazoAlertaHoras;
    const parado = estaParado(inicio, prazoHoras, agora);
    const horasSemNotificacao = horasDeSilencio(inicio, agora);
    const aberto = await this.alertas.abertoAtual();
    const acao = decidir({ parado, alertaAberto: aberto, agora });

    const medido = { situacao: 'MEDIDO' as const, parado, horasSemNotificacao, prazoHoras, acao };
    if (acao === 'NADA') return { ...medido, envio: null };
    if (acao === 'FECHAR' && aberto !== null) {
      await this.alertas.resolver(aberto.id, agora);
      return { ...medido, envio: null };
    }

    // ABRIR_E_ENVIAR, ENVIAR ou LEMBRAR: o alerta existe (ou é criado agora) e o e-mail precisa sair.
    const alertaId =
      aberto?.id ?? (await this.alertas.abrir({ abertoEm: agora, ultimaNotificacaoEm, horasSemNotificacao, prazoHoras })).id;
    // EMAIL_ALERTAS_PARA, se preenchida, substitui a lista da diretoria (ver destinatarios-dos-alertas.ts).
    const destinatarios = destinatariosFixosDosAlertas() ?? (await this.diretoria.executar());
    const resultado = await this.notificador.enviar({
      ...montarAlerta({ horasSemNotificacao, prazoHoras, ultimaNotificacaoEm, lembrete: acao === 'LEMBRAR' }),
      destinatarios,
    });
    if (!resultado.enviado) return { ...medido, envio: { enviado: false, motivo: resultado.motivo } };

    await this.alertas.registrarEnvio(alertaId, agora, destinatarios.length);
    return { ...medido, envio: { enviado: true, destinatarios: destinatarios.length } };
  }
}

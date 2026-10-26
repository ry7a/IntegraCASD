import { Module } from '@nestjs/common';
import { NotificadorDeAlertas } from './notificador-de-alertas.js';
import { NotificadorDeAlertasPorEmail } from './notificador-por-email.http.js';

// Quem pede `NotificadorDeAlertas` recebe o envio por e-mail. Nos testes, cada teste entrega o dublê
// (NotificadorDeAlertasFalso) no lugar.
@Module({
  providers: [{ provide: NotificadorDeAlertas, useClass: NotificadorDeAlertasPorEmail }],
  exports: [NotificadorDeAlertas],
})
export class NotificacaoModule {}

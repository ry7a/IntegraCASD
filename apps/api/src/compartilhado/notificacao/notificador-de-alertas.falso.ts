import { NotificadorDeAlertas, type Alerta, type ResultadoDoEnvio } from './notificador-de-alertas.js';

// Dublê para os testes: guarda o que foi "enviado" e responde o que o teste combinar.
// Nunca fala com um provedor de verdade.
export class NotificadorDeAlertasFalso extends NotificadorDeAlertas {
  readonly enviados: Alerta[] = [];

  constructor(private resultado: ResultadoDoEnvio = { enviado: true }) {
    super();
  }

  definirResultado(resultado: ResultadoDoEnvio): void {
    this.resultado = resultado;
  }

  enviar(alerta: Alerta): Promise<ResultadoDoEnvio> {
    this.enviados.push(alerta);
    return Promise.resolve(this.resultado);
  }
}

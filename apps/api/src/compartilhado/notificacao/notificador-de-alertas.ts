// Contrato do notificador de alertas (adaptador de saída da arquitetura): o único ponto do sistema
// que avisa pessoas fora da tela, hoje por e-mail. Classe abstrata pelo mesmo motivo do ClienteAsaas:
// o NestJS injeta pelo nome da classe. A implementação real usa um provedor de e-mail por API HTTP
// (notificador-por-email.http.ts); nos testes entra o dublê (notificador-de-alertas.falso.ts).

export type Alerta = {
  assunto: string;
  texto: string;
  // E-mails dos usuários que devem receber o alerta.
  destinatarios: string[];
};

// O envio nunca lança: uma falha vira `enviado: false` com o motivo, escrito para quem vai agir
// (a rotina registra e tenta de novo na próxima verificação). Segredos nunca entram no motivo.
export type ResultadoDoEnvio = { enviado: true } | { enviado: false; motivo: string };

export abstract class NotificadorDeAlertas {
  abstract enviar(alerta: Alerta): Promise<ResultadoDoEnvio>;
}

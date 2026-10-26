import { Injectable } from '@nestjs/common';
import { NotificadorDeAlertas, type Alerta, type ResultadoDoEnvio } from './notificador-de-alertas.js';

const URL_PADRAO = 'https://api.resend.com';
const TEMPO_LIMITE_EM_MS = 10_000;

// Envia o alerta por e-mail pela API HTTP de um provedor transacional (Resend). Por que API HTTP e não
// SMTP: a Railway, onde o sistema será implantado, bloqueia SMTP de saída nos planos mais baratos, e
// assim não é preciso nenhuma dependência nova (é só um `fetch`, como no cliente do Asaas).
//
// A configuração é lida do .env a cada envio, para a API e o worker subirem mesmo sem ela (no CI e no
// desenvolvimento, por exemplo): sem chave, o alerta não sai e o motivo volta para a rotina registrar.
//   EMAIL_API_KEY    chave do provedor (segredo: nunca no código, no log nem na trilha)
//   EMAIL_REMETENTE  remetente verificado no provedor, ex.: IntegraCASD <alertas@seudominio.com.br>
//   EMAIL_API_URL    (opcional) outro endereço do provedor; os testes apontam para um servidor local
@Injectable()
export class NotificadorDeAlertasPorEmail extends NotificadorDeAlertas {
  // Troca-se nos testes por uma função falsa, sem rede.
  executarHttp: typeof fetch = (entrada, opcoes) => fetch(entrada, opcoes);

  async enviar(alerta: Alerta): Promise<ResultadoDoEnvio> {
    const chave = process.env.EMAIL_API_KEY?.trim();
    const remetente = process.env.EMAIL_REMETENTE?.trim();
    if (!chave || !remetente) {
      return {
        enviado: false,
        motivo: 'O envio de e-mail não está configurado. Peça a quem administra a instalação para preencher EMAIL_API_KEY e EMAIL_REMETENTE no .env.',
      };
    }
    if (alerta.destinatarios.length === 0) {
      return { enviado: false, motivo: 'Nenhum destinatário: cadastre ao menos um usuário de diretoria ativo, em Administração > Usuários.' };
    }

    const urlBase = (process.env.EMAIL_API_URL?.trim() || URL_PADRAO).replace(/\/+$/, '');
    try {
      const resposta = await this.executarHttp(`${urlBase}/emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remetente, to: alerta.destinatarios, subject: alerta.assunto, text: alerta.texto }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_EM_MS),
      });
      if (resposta.ok) return { enviado: true };
      // O corpo da resposta não entra no motivo: o provedor pode repetir dados do pedido.
      return {
        enviado: false,
        motivo: `O provedor de e-mail recusou o envio (HTTP ${resposta.status}). Confira a chave e o remetente no .env; a rotina tenta de novo na próxima verificação.`,
      };
    } catch {
      return { enviado: false, motivo: 'Não foi possível falar com o provedor de e-mail agora; a rotina tenta de novo na próxima verificação.' };
    }
  }
}

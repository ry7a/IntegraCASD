import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificadorDeAlertasPorEmail } from './notificador-por-email.http.js';

// Dados fictícios. A chave abaixo não existe em nenhum provedor.
const CHAVE = 're_chave_ficticia_de_teste';
const alerta = { assunto: 'Assunto de teste', texto: 'Texto de teste', destinatarios: ['diretoria@exemplo.com'] };

function montar(resposta: Response | Error) {
  const notificador = new NotificadorDeAlertasPorEmail();
  const chamadas: Array<{ url: string; opcoes: RequestInit }> = [];
  notificador.executarHttp = ((url: string, opcoes: RequestInit) => {
    chamadas.push({ url, opcoes });
    return resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve(resposta);
  }) as typeof fetch;
  return { notificador, chamadas };
}

function configurar(): void {
  vi.stubEnv('EMAIL_API_KEY', CHAVE);
  vi.stubEnv('EMAIL_REMETENTE', 'IntegraCASD <alertas@exemplo.com>');
  vi.stubEnv('EMAIL_API_URL', '');
}

afterEach(() => vi.unstubAllEnvs());

describe('envio de alertas por e-mail [Confiabilidade.NF002]', () => {
  it('envia pela API do provedor, com a chave no cabeçalho e o alerta no corpo', async () => {
    configurar();
    const { notificador, chamadas } = montar(new Response('{"id":"x"}', { status: 200 }));
    await expect(notificador.enviar(alerta)).resolves.toEqual({ enviado: true });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe('https://api.resend.com/emails');
    expect(chamadas[0].opcoes.method).toBe('POST');
    expect((chamadas[0].opcoes.headers as Record<string, string>).Authorization).toBe(`Bearer ${CHAVE}`);
    expect(JSON.parse(chamadas[0].opcoes.body as string)).toEqual({
      from: 'IntegraCASD <alertas@exemplo.com>',
      to: ['diretoria@exemplo.com'],
      subject: 'Assunto de teste',
      text: 'Texto de teste',
    });
  });

  it('usa outro endereço quando EMAIL_API_URL está preenchido, sem barra sobrando', async () => {
    configurar();
    vi.stubEnv('EMAIL_API_URL', 'http://localhost:4010/');
    const { notificador, chamadas } = montar(new Response('{}', { status: 200 }));
    await notificador.enviar(alerta);
    expect(chamadas[0].url).toBe('http://localhost:4010/emails');
  });

  it('sem chave ou sem remetente no .env: não envia, não chama a rede e diz o que fazer', async () => {
    vi.stubEnv('EMAIL_API_KEY', '');
    vi.stubEnv('EMAIL_REMETENTE', '');
    const { notificador, chamadas } = montar(new Response('{}', { status: 200 }));
    const resultado = await notificador.enviar(alerta);
    expect(resultado).toMatchObject({ enviado: false, motivo: expect.stringMatching(/EMAIL_API_KEY e EMAIL_REMETENTE/) });
    expect(chamadas).toEqual([]);
  });

  it('sem destinatário: não envia e orienta a cadastrar a diretoria', async () => {
    configurar();
    const { notificador, chamadas } = montar(new Response('{}', { status: 200 }));
    const resultado = await notificador.enviar({ ...alerta, destinatarios: [] });
    expect(resultado).toMatchObject({ enviado: false, motivo: expect.stringMatching(/usuário de diretoria/) });
    expect(chamadas).toEqual([]);
  });

  it('provedor recusa: informa o código HTTP, sem repetir o corpo da resposta nem a chave', async () => {
    configurar();
    const { notificador } = montar(new Response(`{"message":"chave ${CHAVE} inválida"}`, { status: 403 }));
    const resultado = await notificador.enviar(alerta);
    expect(resultado).toMatchObject({ enviado: false, motivo: expect.stringMatching(/HTTP 403/) });
    expect(JSON.stringify(resultado)).not.toContain(CHAVE);
  });

  it('rede fora do ar: não lança, avisa que tenta de novo e não vaza a chave', async () => {
    configurar();
    const { notificador } = montar(new Error(`falha de rede com ${CHAVE}`));
    const resultado = await notificador.enviar(alerta);
    expect(resultado).toMatchObject({ enviado: false, motivo: expect.stringMatching(/tenta de novo/) });
    expect(JSON.stringify(resultado)).not.toContain(CHAVE);
  });
});

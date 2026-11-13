// CT-NF-04 (integração, valor-limite). Sem notificação do Asaas até o fim do prazo configurado, não há alerta;
// um minuto depois, há: o alerta é aberto no banco e a diretoria recebe o e-mail (falso, aqui).
// Usa a rotina de vigilância de verdade (o caso de uso que o worker roda a cada 30 minutos), com o banco real;
// só o relógio é passado pelo teste, para não esperar 12 horas.
import { VerificarSilencioDoAsaas } from '../../../src/modulos/cobrancas/aplicacao/verificar-silencio-do-asaas.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarUsuario, sufixo } from '../../apoio/cenario.js';

const PRAZO_HORAS = 12;
const UMA_HORA = 60 * 60 * 1000;
const UM_MINUTO = 60 * 1000;

describe('[Confiabilidade.NF002] CT-NF-04 alerta de webhook parado no limite do prazo', () => {
  let aplicacao: AplicacaoDeTeste;
  let diretor: UsuarioDeTeste;
  let vigilancia: VerificarSilencioDoAsaas;
  // Quando chegou a última notificação (a que este teste manda no começo).
  let ultimaNotificacao: Date;

  async function notificar() {
    await aplicacao
      .http()
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'token-do-webhook-so-para-teste')
      .send({ id: `evt_${sufixo()}`, event: 'PAYMENT_UPDATED' })
      .expect(200);
    const maisRecente = await aplicacao.prisma.eventoWebhook.aggregate({ _max: { dataCriacao: true } });
    return maisRecente._max.dataCriacao!;
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    diretor = await criarUsuario(aplicacao.prisma);
    const cookie = await entrar(aplicacao, diretor.email, diretor.senha);
    // A diretoria configura a integração com prazo de 12 h (Administração.RF004).
    await aplicacao
      .http()
      .put('/api/admin/integracao-asaas/chave')
      .set('Cookie', cookie)
      .send({ ambiente: 'SANDBOX', chave: `chave-sandbox-de-teste-${sufixo()}`, prazoAlertaHoras: PRAZO_HORAS })
      .expect(204);
    vigilancia = aplicacao.app.get(VerificarSilencioDoAsaas);
    ultimaNotificacao = await notificar();
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it('exatamente no fim do prazo: ainda não há alerta nem e-mail', async () => {
    const resultado = await vigilancia.executar(new Date(ultimaNotificacao.getTime() + PRAZO_HORAS * UMA_HORA));

    expect(resultado).toMatchObject({ situacao: 'MEDIDO', parado: false, prazoHoras: PRAZO_HORAS, acao: 'NADA' });
    expect(aplicacao.notificador.enviados).toHaveLength(0);
    expect(await aplicacao.prisma.alertaDeConciliacao.count({ where: { resolvidoEm: null } })).toBe(0);
  });

  it('um minuto depois do prazo: abre o alerta e avisa a diretoria por e-mail', async () => {
    const resultado = await vigilancia.executar(new Date(ultimaNotificacao.getTime() + PRAZO_HORAS * UMA_HORA + UM_MINUTO));

    expect(resultado).toMatchObject({ situacao: 'MEDIDO', parado: true, acao: 'ABRIR_E_ENVIAR', envio: { enviado: true } });
    expect(aplicacao.notificador.enviados).toHaveLength(1);
    expect(aplicacao.notificador.enviados[0].destinatarios).toContain(diretor.email);
    const aberto = await aplicacao.prisma.alertaDeConciliacao.findFirstOrThrow({ where: { resolvidoEm: null } });
    expect(aberto).toMatchObject({ prazoHoras: PRAZO_HORAS, envios: 1 });
  });

  it('a próxima verificação não repete o e-mail, e o alerta fecha quando as notificações voltam', async () => {
    await vigilancia.executar(new Date(ultimaNotificacao.getTime() + PRAZO_HORAS * UMA_HORA + 31 * UM_MINUTO));
    expect(aplicacao.notificador.enviados).toHaveLength(1);

    // O Asaas volta a mandar notificações: a vigilância seguinte encerra o alerta.
    const nova = await notificar();
    await vigilancia.executar(new Date(nova.getTime() + UM_MINUTO));
    expect(await aplicacao.prisma.alertaDeConciliacao.count({ where: { resolvidoEm: null } })).toBe(0);
  });
});

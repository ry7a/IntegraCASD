import { NotificadorDeAlertasFalso } from '../../../compartilhado/notificacao/notificador-de-alertas.falso.js';
import type { ConsultarIntegracaoAsaas, ListarEmailsDaDiretoria } from '../../administracao/index.js';
import type { AlertaAbertoRegistrado, AlertasDeConciliacaoRepositorio, NovoAlerta } from '../infra/alertas-de-conciliacao.repositorio.js';
import type { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import { VerificarSilencioDoAsaas } from './verificar-silencio-do-asaas.js';

const agora = new Date('2026-10-26T15:00:00Z');
const horasAtras = (horas: number, referencia = agora) => new Date(referencia.getTime() - horas * 3_600_000);
const horasDepois = (horas: number) => new Date(agora.getTime() + horas * 3_600_000);

// Dados fictícios (LGPD).
const DIRETORIA = ['diretoria@exemplo.com', 'tesouraria@exemplo.com'];

type Cenario = {
  conectada?: boolean;
  prazoAlertaHoras?: number;
  chaveCadastradaEm?: Date | null;
  ultimaNotificacaoEm?: Date | null;
  destinatarios?: string[];
};

// Banco em memória: um alerta por vez, como na tabela.
function montar(cenario: Cenario = {}) {
  const estado = {
    ultimaNotificacaoEm: cenario.ultimaNotificacaoEm === undefined ? horasAtras(1) : cenario.ultimaNotificacaoEm,
    alertas: [] as Array<NovoAlerta & { id: string; envios: number; ultimoEnvioEm: Date | null; resolvidoEm: Date | null }>,
  };
  const integracao = {
    executar: async () => ({
      conectada: cenario.conectada ?? true,
      prazoAlertaHoras: cenario.prazoAlertaHoras ?? 24,
      chaveCadastradaEm: cenario.chaveCadastradaEm === undefined ? horasAtras(24 * 30) : cenario.chaveCadastradaEm,
    }),
  } as unknown as ConsultarIntegracaoAsaas;
  const eventos = { ultimaRecebidaEm: async () => estado.ultimaNotificacaoEm } as unknown as EventosWebhookRepositorio;
  const alertas = {
    abertoAtual: async (): Promise<AlertaAbertoRegistrado | null> => estado.alertas.find((alerta) => alerta.resolvidoEm === null) ?? null,
    abrir: async (dados: NovoAlerta) => {
      const id = `alerta-${estado.alertas.length + 1}`;
      estado.alertas.push({ ...dados, id, envios: 0, ultimoEnvioEm: null, resolvidoEm: null });
      return { id };
    },
    registrarEnvio: async (id: string, quando: Date) => {
      const alerta = estado.alertas.find((item) => item.id === id);
      if (alerta) Object.assign(alerta, { envios: alerta.envios + 1, ultimoEnvioEm: quando });
    },
    resolver: async (id: string, quando: Date) => {
      const alerta = estado.alertas.find((item) => item.id === id);
      if (alerta) alerta.resolvidoEm = quando;
    },
  } as unknown as AlertasDeConciliacaoRepositorio;
  const diretoria = { executar: async () => cenario.destinatarios ?? DIRETORIA } as unknown as ListarEmailsDaDiretoria;
  const notificador = new NotificadorDeAlertasFalso();
  return { casoDeUso: new VerificarSilencioDoAsaas(integracao, eventos, alertas, diretoria, notificador), estado, notificador };
}

describe('vigilância do webhook parado [Confiabilidade.NF002]', () => {
  // Os testes não dependem do .env de quem roda: a lista fixa começa vazia e cada teste que a usa a define.
  beforeEach(() => {
    vi.stubEnv('EMAIL_ALERTAS_PARA', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('com EMAIL_ALERTAS_PARA preenchida, o alerta vai só para essa lista, e não para a diretoria', async () => {
    vi.stubEnv('EMAIL_ALERTAS_PARA', ' dono-da-conta@exemplo.com , plantao@exemplo.com,, ');
    const { casoDeUso, notificador } = montar({ ultimaNotificacaoEm: horasAtras(30) });

    const resultado = await casoDeUso.executar(agora);

    expect(notificador.enviados).toHaveLength(1);
    expect(notificador.enviados[0].destinatarios).toEqual(['dono-da-conta@exemplo.com', 'plantao@exemplo.com']);
    expect(resultado).toMatchObject({ envio: { enviado: true, destinatarios: 2 } });
  });

  it('EMAIL_ALERTAS_PARA só com espaços vale como vazia: o alerta vai para a diretoria', async () => {
    vi.stubEnv('EMAIL_ALERTAS_PARA', '  ,  ');
    const { casoDeUso, notificador } = montar({ ultimaNotificacaoEm: horasAtras(30) });

    await casoDeUso.executar(agora);

    expect(notificador.enviados[0].destinatarios).toEqual(DIRETORIA);
  });

  it('sem integração configurada, não há o que vigiar e ninguém é avisado', async () => {
    const { casoDeUso, notificador, estado } = montar({ conectada: false, ultimaNotificacaoEm: horasAtras(500) });
    await expect(casoDeUso.executar(agora)).resolves.toEqual({ situacao: 'SEM_INTEGRACAO' });
    expect(notificador.enviados).toEqual([]);
    expect(estado.alertas).toEqual([]);
  });

  it('sem nenhum evento e sem data de cadastro da chave, não há de onde contar o silêncio', async () => {
    const { casoDeUso, notificador } = montar({ ultimaNotificacaoEm: null, chaveCadastradaEm: null });
    await expect(casoDeUso.executar(agora)).resolves.toEqual({ situacao: 'SEM_REFERENCIA' });
    expect(notificador.enviados).toEqual([]);
  });

  it('notificações em dia: não abre alerta nem manda e-mail', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: horasAtras(3) });
    await expect(casoDeUso.executar(agora)).resolves.toMatchObject({ situacao: 'MEDIDO', parado: false, acao: 'NADA', envio: null });
    expect(notificador.enviados).toEqual([]);
    expect(estado.alertas).toEqual([]);
  });

  it('silêncio acima do prazo: abre o alerta e avisa toda a diretoria por e-mail', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: horasAtras(30) });
    const resultado = await casoDeUso.executar(agora);
    expect(resultado).toMatchObject({ parado: true, horasSemNotificacao: 30, prazoHoras: 24, acao: 'ABRIR_E_ENVIAR', envio: { enviado: true, destinatarios: 2 } });
    expect(notificador.enviados).toHaveLength(1);
    expect(notificador.enviados[0].destinatarios).toEqual(DIRETORIA);
    expect(notificador.enviados[0].assunto).toContain('há 30 horas');
    expect(estado.alertas).toHaveLength(1);
    expect(estado.alertas[0]).toMatchObject({ abertoEm: agora, horasSemNotificacao: 30, prazoHoras: 24, envios: 1, ultimoEnvioEm: agora });
  });

  it('rodar de novo logo em seguida não repete o e-mail (a rotina é segura para rodar duas vezes)', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: horasAtras(30) });
    await casoDeUso.executar(agora);
    await expect(casoDeUso.executar(horasDepois(0.5))).resolves.toMatchObject({ acao: 'NADA', envio: null });
    await expect(casoDeUso.executar(horasDepois(12))).resolves.toMatchObject({ acao: 'NADA', envio: null });
    expect(notificador.enviados).toHaveLength(1);
    expect(estado.alertas).toHaveLength(1);
  });

  it('o silêncio continua depois de 24 horas: manda um lembrete, no mesmo alerta', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: horasAtras(30) });
    await casoDeUso.executar(agora);
    const resultado = await casoDeUso.executar(horasDepois(24));
    expect(resultado).toMatchObject({ acao: 'LEMBRAR', envio: { enviado: true } });
    expect(notificador.enviados).toHaveLength(2);
    expect(notificador.enviados[1].assunto).toContain('Lembrete');
    expect(estado.alertas).toHaveLength(1);
    expect(estado.alertas[0].envios).toBe(2);
  });

  it('e-mail fora do ar: o alerta fica aberto sem envio e a próxima verificação tenta de novo', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: horasAtras(30) });
    notificador.definirResultado({ enviado: false, motivo: 'Provedor fora do ar.' });
    const primeira = await casoDeUso.executar(agora);
    expect(primeira).toMatchObject({ acao: 'ABRIR_E_ENVIAR', envio: { enviado: false, motivo: 'Provedor fora do ar.' } });
    expect(estado.alertas[0]).toMatchObject({ envios: 0, ultimoEnvioEm: null });

    notificador.definirResultado({ enviado: true });
    const segunda = await casoDeUso.executar(horasDepois(0.5));
    expect(segunda).toMatchObject({ acao: 'ENVIAR', envio: { enviado: true } });
    expect(estado.alertas).toHaveLength(1);
    expect(estado.alertas[0].envios).toBe(1);
  });

  it('as notificações voltaram: encerra o alerta e, se parar de novo, abre um novo', async () => {
    const { casoDeUso, estado } = montar({ ultimaNotificacaoEm: horasAtras(30) });
    await casoDeUso.executar(agora);

    estado.ultimaNotificacaoEm = horasDepois(2);
    await expect(casoDeUso.executar(horasDepois(3))).resolves.toMatchObject({ parado: false, acao: 'FECHAR' });
    expect(estado.alertas[0].resolvidoEm).toEqual(horasDepois(3));

    await expect(casoDeUso.executar(horasDepois(2 + 30))).resolves.toMatchObject({ acao: 'ABRIR_E_ENVIAR' });
    expect(estado.alertas).toHaveLength(2);
  });

  it('respeita o prazo configurado (12, 24 ou 48 horas)', async () => {
    const com12 = montar({ prazoAlertaHoras: 12, ultimaNotificacaoEm: horasAtras(13) });
    await expect(com12.casoDeUso.executar(agora)).resolves.toMatchObject({ parado: true, prazoHoras: 12 });
    const com48 = montar({ prazoAlertaHoras: 48, ultimaNotificacaoEm: horasAtras(40) });
    await expect(com48.casoDeUso.executar(agora)).resolves.toMatchObject({ parado: false, prazoHoras: 48, acao: 'NADA' });
    expect(com48.notificador.enviados).toEqual([]);
  });

  it('chave cadastrada há pouco dá um prazo novo ao Asaas, mesmo com a última notificação antiga', async () => {
    const { casoDeUso, notificador } = montar({ ultimaNotificacaoEm: horasAtras(100), chaveCadastradaEm: horasAtras(2) });
    await expect(casoDeUso.executar(agora)).resolves.toMatchObject({ parado: false, horasSemNotificacao: 2 });
    expect(notificador.enviados).toEqual([]);
  });

  it('nunca chegou notificação desde o cadastro da chave: conta do cadastro e avisa', async () => {
    const { casoDeUso, notificador, estado } = montar({ ultimaNotificacaoEm: null, chaveCadastradaEm: horasAtras(30) });
    await expect(casoDeUso.executar(agora)).resolves.toMatchObject({ parado: true, acao: 'ABRIR_E_ENVIAR' });
    expect(notificador.enviados[0].texto).toContain('ainda não enviou nenhuma notificação');
    expect(estado.alertas[0].ultimaNotificacaoEm).toBeNull();
  });

  it('sem diretoria ativa com e-mail, o pedido de envio vai com a lista vazia e o motivo volta para o log', async () => {
    const { casoDeUso, notificador } = montar({ ultimaNotificacaoEm: horasAtras(30), destinatarios: [] });
    notificador.definirResultado({ enviado: false, motivo: 'Nenhum destinatário.' });
    const resultado = await casoDeUso.executar(agora);
    expect(notificador.enviados[0].destinatarios).toEqual([]);
    expect(resultado).toMatchObject({ envio: { enviado: false, motivo: 'Nenhum destinatário.' } });
  });
});

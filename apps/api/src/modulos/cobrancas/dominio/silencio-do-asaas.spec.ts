import {
  HORAS_ENTRE_LEMBRETES,
  decidir,
  estaParado,
  horasDeSilencio,
  inicioDoSilencio,
  montarAlerta,
} from './silencio-do-asaas.js';

const agora = new Date('2026-10-26T15:00:00Z');
const horasAtras = (horas: number) => new Date(agora.getTime() - horas * 3_600_000);

describe('início do silêncio [Confiabilidade.NF002]', () => {
  it('conta da última notificação quando ela é mais recente que a chave', () => {
    expect(inicioDoSilencio(horasAtras(5), horasAtras(100))).toEqual(horasAtras(5));
  });

  it('chave cadastrada depois da última notificação dá um prazo novo ao Asaas', () => {
    expect(inicioDoSilencio(horasAtras(100), horasAtras(2))).toEqual(horasAtras(2));
  });

  it('nunca recebeu nada: conta da chave; sem nenhuma das duas datas, não há o que medir', () => {
    expect(inicioDoSilencio(null, horasAtras(30))).toEqual(horasAtras(30));
    expect(inicioDoSilencio(horasAtras(3), null)).toEqual(horasAtras(3));
    expect(inicioDoSilencio(null, null)).toBeNull();
  });
});

describe('silêncio acima do prazo configurado [Confiabilidade.NF002]', () => {
  it('só é alerta quando passa do prazo; exatamente no prazo ainda não', () => {
    expect(estaParado(horasAtras(24), 24, agora)).toBe(false);
    expect(estaParado(new Date(horasAtras(24).getTime() - 1), 24, agora)).toBe(true);
    expect(estaParado(horasAtras(23), 24, agora)).toBe(false);
  });

  it('respeita os três prazos permitidos (12, 24 e 48 horas)', () => {
    expect(estaParado(horasAtras(13), 12, agora)).toBe(true);
    expect(estaParado(horasAtras(13), 24, agora)).toBe(false);
    expect(estaParado(horasAtras(40), 24, agora)).toBe(true);
    expect(estaParado(horasAtras(40), 48, agora)).toBe(false);
    expect(estaParado(horasAtras(49), 48, agora)).toBe(true);
  });

  it('conta horas inteiras para o texto do aviso', () => {
    expect(horasDeSilencio(horasAtras(26.9), agora)).toBe(26);
    expect(horasDeSilencio(new Date(agora.getTime() + 5000), agora)).toBe(0);
  });
});

describe('decisão da vigilância [Confiabilidade.NF002]', () => {
  it('tudo normal e nenhum alerta aberto: nada a fazer', () => {
    expect(decidir({ parado: false, alertaAberto: null, agora })).toBe('NADA');
  });

  it('silêncio sem alerta aberto: abre o alerta e avisa', () => {
    expect(decidir({ parado: true, alertaAberto: null, agora })).toBe('ABRIR_E_ENVIAR');
  });

  it('alerta aberto que ainda não conseguiu avisar ninguém: tenta de novo', () => {
    expect(decidir({ parado: true, alertaAberto: { ultimoEnvioEm: null }, agora })).toBe('ENVIAR');
  });

  it('alerta aberto e já avisado: não repete o e-mail a cada verificação', () => {
    expect(decidir({ parado: true, alertaAberto: { ultimoEnvioEm: horasAtras(1) }, agora })).toBe('NADA');
    expect(decidir({ parado: true, alertaAberto: { ultimoEnvioEm: horasAtras(HORAS_ENTRE_LEMBRETES - 0.5) }, agora })).toBe('NADA');
  });

  it('o silêncio continua depois de 24 horas do último aviso: lembra', () => {
    expect(decidir({ parado: true, alertaAberto: { ultimoEnvioEm: horasAtras(HORAS_ENTRE_LEMBRETES) }, agora })).toBe('LEMBRAR');
    expect(decidir({ parado: true, alertaAberto: { ultimoEnvioEm: horasAtras(72) }, agora })).toBe('LEMBRAR');
  });

  it('as notificações voltaram: encerra o alerta aberto', () => {
    expect(decidir({ parado: false, alertaAberto: { ultimoEnvioEm: horasAtras(2) }, agora })).toBe('FECHAR');
    expect(decidir({ parado: false, alertaAberto: { ultimoEnvioEm: null }, agora })).toBe('FECHAR');
  });
});

describe('texto do alerta [Confiabilidade.NF002] [Usabilidade.NF002]', () => {
  const dados = { horasSemNotificacao: 30, prazoHoras: 24, ultimaNotificacaoEm: new Date('2026-10-25T12:30:00Z'), lembrete: false };

  it('diz o que houve, a hora local da última notificação, o risco dos 14 dias e o que fazer', () => {
    const { assunto, texto } = montarAlerta(dados);
    expect(assunto).toBe('[IntegraCASD] o Asaas está sem enviar notificações há 30 horas');
    expect(texto).toContain('há 30 horas, acima do prazo de 24 horas');
    expect(texto).toContain('25/10/2026 às 09:30'); // 12:30 UTC = 09:30 em São Paulo
    expect(texto).toContain('14 dias');
    expect(texto).toContain('Integrações > Webhooks');
    expect(texto).toContain('Sincronizar');
    expect(texto).toContain('lembrete a cada 24 horas');
  });

  it('lembrete: o assunto muda e o texto não promete novo lembrete', () => {
    const { assunto, texto } = montarAlerta({ ...dados, lembrete: true });
    expect(assunto).toBe('[IntegraCASD] Lembrete: o Asaas está sem enviar notificações há 30 horas');
    expect(texto).not.toContain('você receberá um lembrete');
  });

  it('nunca recebeu notificação: explica sem inventar uma data', () => {
    const { texto } = montarAlerta({ ...dados, ultimaNotificacaoEm: null });
    expect(texto).toContain('ainda não enviou nenhuma notificação');
    expect(texto).not.toContain('Invalid');
  });
});

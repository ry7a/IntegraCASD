// CT-COB-05 (sistema, caixa cinza): o webhook do Asaas pela rota HTTP, com banco real.
// Chama a rota como o Asaas chamaria e depois consulta o banco: evento gravado, tarefa na fila e nenhuma
// movimentação antes de o worker rodar (Plano de Testes, Seção 3.3). Depois liga o consumidor da fila,
// o mesmo que o main-worker.ts liga, e confere a baixa.
import { Logger } from '@nestjs/common';
import { ConsumidorDeEventosWebhook } from '../../../src/modulos/cobrancas/index.js';
import { type AplicacaoDeTeste, esperarAte, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  type ParametrosDeTeste,
  avisoDoAsaas,
  criarAluno,
  criarCobrancaAberta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
  sufixo,
} from '../../apoio/cenario.js';

const TOKEN = 'token-do-webhook-so-para-teste';

describe('[Cobranças.RF005] CT-COB-05 webhook do Asaas, do recebimento à baixa', () => {
  let aplicacao: AplicacaoDeTeste;
  let parametros: ParametrosDeTeste;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    parametros = await definirParametros(aplicacao.prisma, diretor.id);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  async function eventosGravados(idEvento: string) {
    return aplicacao.prisma.eventoWebhook.findMany({ where: { idAsaas: idEvento } });
  }

  async function tarefasNaFila(eventoId: string): Promise<number> {
    const linhas = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pgboss.job WHERE name = 'eventos-asaas' AND data->>'eventoId' = ${eventoId}`;
    return Number(linhas[0].total);
  }

  it('token errado, quase igual ou ausente é recusado com 401, nada é gravado e a tentativa fica no log (fluxo E2) [Segurança.NF002]', async () => {
    const idEvento = `evt_${sufixo()}`;
    const corpo = { id: idEvento, event: 'PAYMENT_RECEIVED' };
    // O requisito pede que a notificação recusada seja registrada como tentativa de acesso indevido.
    const avisosNoLog = vi.spyOn(Logger.prototype, 'warn');

    const errado = await aplicacao.http().post('/api/webhooks/asaas').set('asaas-access-token', 'outro-token').send(corpo);
    const quaseIgual = await aplicacao.http().post('/api/webhooks/asaas').set('asaas-access-token', `${TOKEN}x`).send(corpo);
    const ausente = await aplicacao.http().post('/api/webhooks/asaas').send(corpo);

    expect([errado.status, quaseIgual.status, ausente.status]).toEqual([401, 401, 401]);
    expect(await eventosGravados(idEvento)).toHaveLength(0);
    const tentativasNoLog = avisosNoLog.mock.calls.filter(([mensagem]) => mensagem === 'Webhook recusado: token inválido.');
    expect(tentativasNoLog).toHaveLength(3);
    // O token recebido nunca vai para o log.
    expect(avisosNoLog.mock.calls.flat().join(' ')).not.toContain('outro-token');
    avisosNoLog.mockRestore();
  });

  it('com o token certo, grava o evento, enfileira e responde 200 sem processar na requisição', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id });
    const idEvento = `evt_${sufixo()}`;

    const resposta = await aplicacao
      .http()
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', TOKEN)
      .send(avisoDoAsaas(idEvento, 'PAYMENT_RECEIVED', cobranca.idAsaas!, 85, diaDeHojeMais(0)));

    expect(resposta.status).toBe(200);
    const eventos = await eventosGravados(idEvento);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].processadoEm).toBeNull();
    expect(await tarefasNaFila(eventos[0].id)).toBe(1);
    // Ninguém consumiu a fila ainda: a cobrança continua aberta e não há entrada.
    const depois = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(depois.situacao).toBe('ABERTA');
    expect(depois.movimentacaoId).toBeNull();
  });

  it('o worker deixa a cobrança Paga e cria a entrada; a notificação repetida não duplica nada [Confiabilidade.NF003]', async () => {
    // Valor que só este teste usa: a contagem de entradas com ele não depende do que os outros arquivos gravaram.
    const valorCentavos = 8517;
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, origem: 'MENSALIDADE', valorCentavos });
    const idEvento = `evt_${sufixo()}`;
    const aviso = avisoDoAsaas(idEvento, 'PAYMENT_RECEIVED', cobranca.idAsaas!, valorCentavos / 100, diaDeHojeMais(0));

    await aplicacao.http().post('/api/webhooks/asaas').set('asaas-access-token', TOKEN).send(aviso).expect(200);
    // Liga o consumidor da fila, como o main-worker.ts faz.
    await aplicacao.app.get(ConsumidorDeEventosWebhook).iniciar();
    await esperarAte(async () => (await eventosGravados(idEvento))[0].processadoEm !== null);

    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id }, include: { movimentacao: true } });
    expect(paga.situacao).toBe('PAGA');
    expect(paga.movimentacao).toMatchObject({
      tipo: 'ENTRADA',
      origem: 'CONCILIACAO_AUTOMATICA',
      valorCentavos,
      contaId: parametros.contaId,
      categoriaId: parametros.categoriaMensalidadeId,
    });
    expect(await aplicacao.prisma.movimentacao.count({ where: { valorCentavos } })).toBe(1);

    // O Asaas manda o mesmo aviso de novo (ele repete quando não tem certeza da entrega).
    const repetido = await aplicacao.http().post('/api/webhooks/asaas').set('asaas-access-token', TOKEN).send(aviso);
    expect(repetido.status).toBe(200);
    // Tempo de sobra para o worker pegar uma eventual tarefa nova (ele consulta a fila a cada 2 s).
    await new Promise((resolver) => setTimeout(resolver, 3_000));

    const eventos = await eventosGravados(idEvento);
    expect(eventos).toHaveLength(1);
    expect(await tarefasNaFila(eventos[0].id)).toBe(1);
    expect(await aplicacao.prisma.movimentacao.count({ where: { valorCentavos } })).toBe(1);
    expect((await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).situacao).toBe('PAGA');
  });
});

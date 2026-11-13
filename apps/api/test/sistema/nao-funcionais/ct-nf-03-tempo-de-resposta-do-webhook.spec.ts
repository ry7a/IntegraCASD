// CT-NF-03 (sistema, caixa cinza). Com o worker parado, 100 notificações seguidas são respondidas em menos de
// 5 s cada, e nenhuma é processada dentro da requisição: a API só valida, grava, enfileira e responde (ADR-0002).
//
// A medição é por HTTP de verdade (a aplicação escuta numa porta e o teste usa fetch), e o resultado aparece no
// terminal. Para medir a homologação na Railway, use o script `pnpm medir:webhook` (scripts/testes/).
import type { AddressInfo } from 'node:net';
import { type AplicacaoDeTeste, subirAplicacao } from '../../apoio/aplicacao.js';
import { sufixo } from '../../apoio/cenario.js';

const QUANTIDADE = 100;
const LIMITE_POR_RESPOSTA_EM_MS = 5_000;

describe('[Desempenho.NF001] [Confiabilidade.NF001] CT-NF-03 tempo de resposta do webhook com o worker parado', () => {
  let aplicacao: AplicacaoDeTeste;
  let endereco: string;

  beforeAll(async () => {
    // Nenhum consumidor da fila é ligado: é como se o worker estivesse parado.
    aplicacao = await subirAplicacao();
    await aplicacao.app.listen(0);
    const { port } = aplicacao.app.getHttpServer().address() as AddressInfo;
    endereco = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it(`${QUANTIDADE} notificações seguidas: todas com 200 em menos de 5 s, gravadas e nenhuma processada`, async () => {
    const lote = `evt_ct_nf_03_${sufixo()}`;
    const tempos: number[] = [];
    const respostas: number[] = [];

    for (let numero = 1; numero <= QUANTIDADE; numero += 1) {
      // Aviso sem efeito na conciliação (PAYMENT_UPDATED): o tempo de resposta não depende do tipo do evento.
      const inicio = performance.now();
      const resposta = await fetch(`${endereco}/api/webhooks/asaas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'asaas-access-token': 'token-do-webhook-so-para-teste' },
        body: JSON.stringify({ id: `${lote}_${numero}`, event: 'PAYMENT_UPDATED' }),
      });
      await resposta.text();
      tempos.push(performance.now() - inicio);
      respostas.push(resposta.status);
    }

    const ordenados = [...tempos].sort((a, b) => a - b);
    const ms = (valor: number) => `${Math.round(valor)} ms`;
    const relatorio = [
      `CT-NF-03: ${QUANTIDADE} notificações seguidas ao webhook (API local, worker parado)`,
      `  respostas 200: ${respostas.filter((status) => status === 200).length} de ${QUANTIDADE}`,
      `  mínimo ${ms(ordenados[0])} | média ${ms(tempos.reduce((soma, t) => soma + t, 0) / QUANTIDADE)} | ` +
        `p95 ${ms(ordenados[Math.ceil(QUANTIDADE * 0.95) - 1])} | máximo ${ms(ordenados[QUANTIDADE - 1])} | limite ${ms(LIMITE_POR_RESPOSTA_EM_MS)}`,
    ];
    // process.stdout em vez de console.log: a regra B11 do lint barra console (veja docs/governanca).
    process.stdout.write(`${relatorio.join('\n')}\n`);

    expect(respostas.every((status) => status === 200)).toBe(true);
    expect(ordenados[QUANTIDADE - 1]).toBeLessThan(LIMITE_POR_RESPOSTA_EM_MS);

    // Caixa cinza: tudo gravado e enfileirado, nada processado (o processamento é do worker).
    const gravados = await aplicacao.prisma.eventoWebhook.findMany({ where: { idAsaas: { startsWith: lote } } });
    expect(gravados).toHaveLength(QUANTIDADE);
    expect(gravados.filter((evento) => evento.processadoEm !== null)).toHaveLength(0);
    const naFila = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pgboss.job
      WHERE name = 'eventos-asaas' AND data->>'eventoId' = ANY(${gravados.map((evento) => evento.id)}::text[])`;
    expect(Number(naFila[0].total)).toBe(QUANTIDADE);
  });
});

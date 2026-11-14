// CT-FZ-01 (sistema, fuzzing): o webhook do Asaas recebe dezenas de entradas inválidas, extremas ou
// inesperadas, geradas por um LLM e guardadas em entradas/webhook-asaas.json (Plano de Testes, Seção 4.1).
// Para cada uma, o teste confere com o banco real: nunca 5xx; recusa (4xx) sem nada gravado nem enfileirado;
// aceite (200) com o evento gravado UMA vez, mesmo se repetido. Depois liga o worker e confere que nenhum
// evento deixou dado inconsistente (cobrança paga sem entrada, entrada duplicada).
// Entrada que derrubar o sistema fica no arquivo como caso fixo de regressão (veja o README.md).
import { ConsumidorDeEventosWebhook } from '../../../src/modulos/cobrancas/index.js';
import { type AplicacaoDeTeste, esperarAte, subirAplicacao } from '../../apoio/aplicacao.js';
import { criarAluno, criarCobrancaAberta, criarUsuario, definirParametros, diaDeHojeMais } from '../../apoio/cenario.js';
import { type Esperado, type Trocas, expandir, expandirCorpoBruto, lerEntradas, resumoDaResposta } from './entradas.js';

const TOKEN = 'token-do-webhook-so-para-teste';

interface EntradaDoWebhook {
  classe: string;
  descricao: string;
  esperado: Esperado;
  // Padrão "CERTO"; null = sem o cabeçalho; outro valor = enviado como está (pode ter marcador).
  token?: unknown;
  cabecalhoDoToken?: string;
  rota?: string;
  tipoConteudo?: string;
  // Um dos dois: `corpo` vai pelo JSON.stringify; `corpoBruto` vai como texto, do jeito que está.
  corpo?: unknown;
  corpoBruto?: unknown;
  // O id que o teste procura no banco. Se faltar, vale o `corpo.id` (quando é texto).
  idEvento?: unknown;
  // Status exato exigido (ex.: 401 para token errado).
  status?: number;
  repeticoes?: number;
  simultaneas?: number;
  // Para id repetido: o tipo que tem de continuar gravado (o do primeiro envio).
  tipoGravado?: string;
}

const entradas = lerEntradas<EntradaDoWebhook>('webhook-asaas.json');

describe('[Cobranças.RF005] [Segurança.NF002] [Confiabilidade.NF003] CT-FZ-01 fuzzing do webhook do Asaas', () => {
  let aplicacao: AplicacaoDeTeste;
  let alunoId: string;
  let cobrancaCompartilhada: { id: string; idAsaas: string };
  // Cobranças criadas para as entradas ({{COBRANCA_NOVA}}) e ids dos eventos aceitos: o worker confere tudo no fim.
  const cobrancasDoCenario: Array<{ id: string; idAsaas: string }> = [];
  const idsAceitos = new Set<string>();

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    // Conta e categoria de recebimento: sem elas o worker não teria onde lançar a entrada da baixa.
    await definirParametros(aplicacao.prisma, diretor.id);
    alunoId = (await criarAluno(aplicacao.prisma)).id;
    const compartilhada = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId });
    cobrancaCompartilhada = { id: compartilhada.id, idAsaas: compartilhada.idAsaas! };
    cobrancasDoCenario.push(cobrancaCompartilhada);
  });

  afterAll(async () => {
    if (aplicacao) {
      // Todos os arquivos usam o mesmo banco, e alguns esperam a fila de eventos esvaziar. Um evento daqui que
      // o worker não conseguiu processar (defeito relatado no teste) ficaria pendente para sempre e travaria
      // essa espera nos outros arquivos. Por isso marcamos como processados os nossos que sobraram.
      await aplicacao.prisma.eventoWebhook.updateMany({
        where: { idAsaas: { in: [...idsAceitos] }, processadoEm: null },
        data: { processadoEm: new Date(), pendencia: 'Marcado no fim do teste de fuzzing (CT-FZ-01): o worker não processou.' },
      });
    }
    await aplicacao?.encerrar();
  });

  async function totalDeEventos(): Promise<number> {
    return aplicacao.prisma.eventoWebhook.count();
  }

  async function totalDeTarefasNaFila(): Promise<number> {
    const linhas = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pgboss.job WHERE name = 'eventos-asaas'`;
    return Number(linhas[0].total);
  }

  // Monta os marcadores desta entrada. {{COBRANCA_NOVA}} cria uma cobrança aberta só para ela.
  async function prepararTrocas(entrada: EntradaDoWebhook): Promise<Trocas> {
    const trocas: Trocas = {
      HOJE: () => diaDeHojeMais(0),
      COBRANCA_COMPARTILHADA: () => cobrancaCompartilhada.idAsaas,
    };
    if (JSON.stringify(entrada).includes('{{COBRANCA_NOVA}}')) {
      const nova = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId });
      cobrancasDoCenario.push({ id: nova.id, idAsaas: nova.idAsaas! });
      trocas.COBRANCA_NOVA = () => nova.idAsaas!;
    }
    return trocas;
  }

  function enviar(entrada: EntradaDoWebhook, trocas: Trocas) {
    let pedido = aplicacao.http().post(entrada.rota ?? '/api/webhooks/asaas');
    const token = entrada.token === undefined || entrada.token === 'CERTO' ? TOKEN : entrada.token;
    if (token !== null) pedido = pedido.set(entrada.cabecalhoDoToken ?? 'asaas-access-token', String(expandir(token, trocas)));
    if (entrada.corpoBruto !== undefined) {
      return pedido.set('Content-Type', entrada.tipoConteudo ?? 'application/json').send(expandirCorpoBruto(entrada.corpoBruto, trocas));
    }
    if (entrada.corpo !== undefined) return pedido.send(expandir(entrada.corpo, trocas) as object);
    return pedido;
  }

  function idDoEvento(entrada: EntradaDoWebhook, trocas: Trocas): string | null {
    if (entrada.idEvento !== undefined) return String(expandir(entrada.idEvento, trocas));
    const corpo = expandir(entrada.corpo, trocas) as { id?: unknown } | undefined;
    return typeof corpo?.id === 'string' ? corpo.id : null;
  }

  for (const entrada of entradas) {
    it(`${entrada.classe}: ${entrada.descricao} (esperado: ${entrada.esperado})`, async () => {
      const trocas = await prepararTrocas(entrada);
      const idEvento = idDoEvento(entrada, trocas);
      const eventosAntes = await totalDeEventos();
      const tarefasAntes = await totalDeTarefasNaFila();

      // Envia uma vez, várias vezes em sequência (repeticoes) ou várias ao mesmo tempo (simultaneas).
      const respostas = [];
      if (entrada.simultaneas !== undefined) {
        const pedidos = Array.from({ length: entrada.simultaneas }, () => enviar(entrada, trocas));
        respostas.push(...(await Promise.all(pedidos)));
      } else {
        for (let vez = 0; vez < (entrada.repeticoes ?? 1); vez++) respostas.push(await enviar(entrada, trocas));
      }

      // Nunca 5xx: nenhuma entrada pode derrubar o webhook.
      for (const resposta of respostas) {
        expect(resposta.status, resumoDaResposta(resposta)).toBeLessThan(500);
        if (entrada.status !== undefined) expect(resposta.status, resumoDaResposta(resposta)).toBe(entrada.status);
      }

      const aceito = respostas.every((resposta) => resposta.status === 200);
      const recusado = respostas.every((resposta) => resposta.status >= 400 && resposta.status < 500);
      const comoFoi = respostas.map(resumoDaResposta).join(' | ');
      if (entrada.esperado === 'aceito') expect(aceito, comoFoi).toBe(true);
      if (entrada.esperado === 'recusa') expect(recusado, comoFoi).toBe(true);
      expect(aceito || recusado, `respostas misturadas: ${comoFoi}`).toBe(true);

      // Um id com caractere nulo não tem como estar gravado (o PostgreSQL não guarda esse caractere em texto) e
      // nem pode ser procurado: o banco recusa a própria consulta (erro 22021). Nesse caso a lista é vazia.
      const idProcuravel = idEvento !== null && !idEvento.includes('\u0000');
      const gravadosComEsseId = idProcuravel ? await aplicacao.prisma.eventoWebhook.findMany({ where: { idAsaas: idEvento } }) : [];
      if (recusado) {
        // Recusa sem efeito: nenhum evento novo e nada na fila.
        expect(await totalDeEventos()).toBe(eventosAntes);
        expect(await totalDeTarefasNaFila()).toBe(tarefasAntes);
        expect(gravadosComEsseId).toHaveLength(0);
      } else {
        // Aceite: exatamente um evento com esse id, por mais vezes que tenha chegado.
        expect(idEvento, 'entrada aceita precisa dizer qual id procurar (idEvento)').not.toBeNull();
        expect(gravadosComEsseId).toHaveLength(1);
        expect((await totalDeEventos()) - eventosAntes).toBeLessThanOrEqual(1);
        if (entrada.tipoGravado !== undefined) expect(gravadosComEsseId[0].tipo).toBe(entrada.tipoGravado);
        idsAceitos.add(idEvento!);
      }
    });
  }

  it('nenhuma entrada poluiu o protótipo dos objetos do servidor', () => {
    // O servidor roda neste mesmo processo: se a chave __proto__ tivesse vazado, todo objeto teria o campo.
    expect((Object.prototype as Record<string, unknown>).poluidoPeloFuzzing).toBeUndefined();
  });

  describe('depois, o worker processa os eventos aceitos', () => {
    let naoProcessados: string[] = [];

    // Tarefas que o worker ainda não pegou nenhuma vez. As que falharam ficam em 'retry' e só voltam depois de
    // 30 s: a falha se repetiria igual (os dados do evento não mudam), então não esperamos por elas.
    async function tarefasAindaNaoTentadas(): Promise<number> {
      const linhas = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*) AS total FROM pgboss.job WHERE name = 'eventos-asaas' AND state IN ('created', 'active')`;
      return Number(linhas[0].total);
    }

    beforeAll(async () => {
      // Liga o consumidor da fila, como o main-worker.ts faz. Ele pega uma tarefa a cada 2 s, e há umas 40
      // (os eventos repetidos enfileiram de novo): por isso a espera é longa.
      await aplicacao.app.get(ConsumidorDeEventosWebhook).iniciar();
      await esperarAte(async () => (await tarefasAindaNaoTentadas()) === 0, 150_000);
      const pendentes = await aplicacao.prisma.eventoWebhook.findMany({
        where: { idAsaas: { in: [...idsAceitos] }, processadoEm: null },
        select: { idAsaas: true },
      });
      naoProcessados = pendentes.map((evento) => evento.idAsaas);
    }, 180_000);

    // Datas de pagamento que os avisos aceitos trouxeram para cada cobrança (payment.id -> paymentDate).
    async function datasDosAvisos(): Promise<Map<string, string[]>> {
      const eventos = await aplicacao.prisma.eventoWebhook.findMany({ where: { idAsaas: { in: [...idsAceitos] } } });
      const datas = new Map<string, string[]>();
      for (const evento of eventos) {
        const pagamento = (evento.payload as { payment?: { id?: unknown; paymentDate?: unknown } } | null)?.payment;
        if (typeof pagamento?.id !== 'string' || typeof pagamento.paymentDate !== 'string') continue;
        datas.set(pagamento.id, [...(datas.get(pagamento.id) ?? []), pagamento.paymentDate]);
      }
      return datas;
    }

    it('nenhuma cobrança fica paga sem a entrada, e nenhuma ganha entrada duplicada [Confiabilidade.NF003]', async () => {
      for (const { id, idAsaas } of cobrancasDoCenario) {
        const cobranca = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id }, include: { movimentacao: true } });
        // Entradas da conciliação que citam esta cobrança: no máximo uma, por mais avisos que tenham chegado.
        const entradas = await aplicacao.prisma.movimentacao.count({
          where: { origem: 'CONCILIACAO_AUTOMATICA', descricao: { contains: idAsaas } },
        });
        expect(entradas, `entradas da cobrança ${idAsaas}`).toBeLessThanOrEqual(1);
        if (cobranca.situacao === 'PAGA') {
          expect(cobranca.movimentacao, `cobrança ${idAsaas} paga sem entrada`).not.toBeNull();
          expect(cobranca.movimentacao!.tipo).toBe('ENTRADA');
          expect(cobranca.movimentacao!.valorCentavos).toBeGreaterThan(0);
          expect(entradas).toBe(1);
        } else {
          expect(entradas, `cobrança ${idAsaas} (${cobranca.situacao}) com entrada da conciliação`).toBe(0);
        }
      }
      // A compartilhada recebeu vários avisos de pagamento, com ids diferentes: exatamente uma entrada.
      const compartilhada = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaCompartilhada.id } });
      expect(compartilhada.situacao).toBe('PAGA');
    });

    it('a data da baixa é a que o Asaas informou, ou hoje quando o aviso não traz uma data válida', async () => {
      const datas = await datasDosAvisos();
      const hoje = diaDeHojeMais(0);
      for (const { id, idAsaas } of cobrancasDoCenario) {
        const cobranca = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id } });
        if (cobranca.situacao !== 'PAGA' || cobranca.pagaEm === null) continue;
        const pagaEm = cobranca.pagaEm.toISOString().slice(0, 10);
        // Uma data que não veio de nenhum aviso (nem é hoje) foi inventada no caminho.
        const permitidas = [hoje, ...(datas.get(idAsaas) ?? [])];
        expect(permitidas, `cobrança ${idAsaas} baixada em ${pagaEm}; avisos: ${JSON.stringify(datas.get(idAsaas))}`).toContain(pagaEm);
      }
    });

    it('todo evento aceito termina processado, com ou sem pendência para conferência', () => {
      // Um evento que o worker não consegue processar fica sendo tentado de novo e a cobrança continua aberta,
      // sem ninguém ser avisado. O esperado é virar pendência de conciliação, não travar.
      expect(naoProcessados).toEqual([]);
    });
  });
});

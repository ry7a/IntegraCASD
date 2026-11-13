// CT-COB-04 (integração, transição de estados): cancelar uma cobrança pela rota HTTP, com banco real.
// Transições do desenho: Aberta -> Cancelada e Vencida -> Cancelada, só depois de o Asaas confirmar.
// Transições fora do desenho, tentadas e recusadas sem chegar ao Asaas: Paga, Paga com registro manual e
// Cancelada (de novo) -> Cancelada. E o fluxo E2: o Asaas recusa ou não responde, e nada muda aqui.
//
// Este arquivo usa um Asaas falso que também sabe RECUSAR um cancelamento (o padrão só sabe ficar fora do ar).
import type { Cobranca } from '../../../src/generated/prisma/client.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  type UsuarioDeTeste,
  criarAluno,
  criarCobrancaAberta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
} from '../../apoio/cenario.js';
import { AsaasQueRecusaCancelamentos, pagarNoAsaasESincronizar, registrarPagamentoManual } from './apoio-de-cobrancas.js';

const MOTIVO = 'Renegociação em 3 parcelas, acordada com o aluno (teste)';

describe('[Cobranças.RF004] CT-COB-04 cancelamento de cobrança', () => {
  let aplicacao: AplicacaoDeTeste;
  // O Asaas que a aplicação usa neste arquivo (aplicacao.asaas é o padrão, que aqui fica sem uso).
  let asaas: AsaasQueRecusaCancelamentos;
  let atendente: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    asaas = new AsaasQueRecusaCancelamentos();
    aplicacao = await subirAplicacao({ clienteAsaas: asaas });
    const diretor = await criarUsuario(aplicacao.prisma);
    await definirParametros(aplicacao.prisma, diretor.id);
    atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // O Asaas volta ao ar depois de cada teste, mesmo se o teste que o derrubou falhar no meio.
  afterEach(() => {
    asaas.indisponivel = false;
  });

  async function cobrancaAberta(vencimento = diaDeHojeMais(10)): Promise<Cobranca> {
    const aluno = await criarAluno(aplicacao.prisma);
    return criarCobrancaAberta(aplicacao.prisma, asaas, { alunoId: aluno.id, vencimento });
  }

  function cancelar(cobrancaId: string) {
    return aplicacao.http().post(`/api/cobrancas/${cobrancaId}/cancelar`).set('Cookie', cookie).send({ motivo: MOTIVO });
  }

  function lerCobranca(cobrancaId: string) {
    return aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  }

  async function cancelamentosNaTrilha(cobrancaId: string) {
    return aplicacao.prisma.registroAuditoria.findMany({
      where: { entidade: 'COBRANCA', registroId: cobrancaId, operacao: 'CANCELAMENTO' },
    });
  }

  // Quantas vezes o cancelamento desta cobrança chegou ao Asaas.
  function pedidosDeCancelamentoAoAsaas(idAsaas: string | null): number {
    return asaas.cobrancasCanceladas.filter((id) => id === idAsaas).length;
  }

  // Nada mudou aqui: a cobrança continua na mesma situação, sem data nem motivo de cancelamento, sem trilha.
  async function conferirQueNadaMudou(cobranca: Cobranca) {
    const depois = await lerCobranca(cobranca.id);
    expect(depois.situacao).toBe(cobranca.situacao);
    expect(depois.canceladaEm).toBeNull();
    expect(depois.motivoCancelamento).toBeNull();
    expect(await cancelamentosNaTrilha(cobranca.id)).toHaveLength(0);
  }

  it('FP: cobrança Aberta é cancelada no Asaas e, confirmado lá, fica Cancelada aqui com motivo, autor, data e hora', async () => {
    const cobranca = await cobrancaAberta();

    const resposta = await cancelar(cobranca.id);

    expect(resposta.status).toBe(204);
    // Primeiro o Asaas: o pedido chegou lá e o boleto deixou de valer.
    expect(pedidosDeCancelamentoAoAsaas(cobranca.idAsaas)).toBe(1);
    expect(asaas.noAsaas.get(cobranca.idAsaas!)?.removida).toBe(true);
    // Depois aqui.
    const cancelada = await lerCobranca(cobranca.id);
    expect(cancelada.situacao).toBe('CANCELADA');
    expect(cancelada.canceladaEm).toBeInstanceOf(Date);
    expect(cancelada.motivoCancelamento).toBe(MOTIVO);
    const trilha = await cancelamentosNaTrilha(cobranca.id);
    expect(trilha).toHaveLength(1);
    expect(trilha[0].usuarioId).toBe(atendente.id);
    expect(trilha[0].detalhe).toContain(MOTIVO);
  });

  it('FP: cobrança Vencida (aberta com o vencimento passado) também é cancelada', async () => {
    const cobranca = await cobrancaAberta(diaDeHojeMais(-7));

    const resposta = await cancelar(cobranca.id);

    expect(resposta.status).toBe(204);
    expect(pedidosDeCancelamentoAoAsaas(cobranca.idAsaas)).toBe(1);
    expect((await lerCobranca(cobranca.id)).situacao).toBe('CANCELADA');
  });

  it('E1: cobrança Paga não é cancelada, nem chega ao Asaas; a resposta diz que a devolução é pelo estorno do Asaas', async () => {
    const aberta = await cobrancaAberta();
    await pagarNoAsaasESincronizar(aplicacao, asaas, cookie, aberta);
    const paga = await lerCobranca(aberta.id);
    expect(paga.situacao).toBe('PAGA');

    const resposta = await cancelar(paga.id);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('já foi paga e não pode ser cancelada');
    expect(resposta.body.message).toContain('estorno');
    expect(pedidosDeCancelamentoAoAsaas(paga.idAsaas)).toBe(0);
    await conferirQueNadaMudou(paga);
  });

  it('E1: cobrança Paga com registro manual também não é cancelada, nem chega ao Asaas', async () => {
    const aberta = await cobrancaAberta();
    await registrarPagamentoManual(aplicacao, cookie, aberta.id);
    const pagaAMao = await lerCobranca(aberta.id);
    expect(pagaAMao.situacao).toBe('PAGA_COM_REGISTRO_MANUAL');

    const resposta = await cancelar(pagaAMao.id);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('já foi paga e não pode ser cancelada');
    expect(pedidosDeCancelamentoAoAsaas(pagaAMao.idAsaas)).toBe(0);
    await conferirQueNadaMudou(pagaAMao);
  });

  it('transição proibida: cobrança já Cancelada não é cancelada de novo, nem chega outra vez ao Asaas', async () => {
    const cobranca = await cobrancaAberta();
    await cancelar(cobranca.id).expect(204);
    const cancelada = await lerCobranca(cobranca.id);

    const resposta = await cancelar(cobranca.id);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('já está cancelada');
    expect(pedidosDeCancelamentoAoAsaas(cobranca.idAsaas)).toBe(1);
    // A data e o motivo do primeiro cancelamento ficam como estavam, e a trilha não ganha um segundo registro.
    const depois = await lerCobranca(cobranca.id);
    expect(depois.canceladaEm).toEqual(cancelada.canceladaEm);
    expect(depois.motivoCancelamento).toBe(MOTIVO);
    expect(await cancelamentosNaTrilha(cobranca.id)).toHaveLength(1);
  });

  it('E2: o Asaas não responde: nada muda aqui e a mensagem orienta nova tentativa [Usabilidade.NF002]', async () => {
    const cobranca = await cobrancaAberta();
    asaas.indisponivel = true;

    const resposta = await cancelar(cobranca.id);

    expect(resposta.status).toBe(502);
    expect(resposta.body.message).toBe('O Asaas está fora do ar no momento. Tente novamente em alguns minutos.');
    await conferirQueNadaMudou(cobranca);
    // O boleto continua valendo no Asaas: cancelar só aqui deixaria um boleto válido em circulação.
    expect(asaas.noAsaas.get(cobranca.idAsaas!)?.removida).toBe(false);
  });

  it('E2: o Asaas recusa o cancelamento: nada muda aqui e a falha é informada', async () => {
    const cobranca = await cobrancaAberta();
    asaas.cancelamentosRecusados.add(cobranca.idAsaas!);

    const resposta = await cancelar(cobranca.id);

    expect(resposta.status).toBe(502);
    expect(resposta.body.message).toContain('O Asaas recusou o cancelamento');
    await conferirQueNadaMudou(cobranca);
    expect(asaas.noAsaas.get(cobranca.idAsaas!)?.removida).toBe(false);
  });
});

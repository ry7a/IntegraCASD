// CT-NF-02 (integração, caixa branca: injeção de falha). A baixa de uma cobrança é atômica: se a criação da
// movimentação de entrada falhar, a mudança da cobrança também é desfeita. Vale para os três caminhos que
// dão baixa: a conciliação (webhook + worker), o registro manual e a sincronização com o Asaas.
//
// A falha é injetada NO BANCO, por um gatilho que recusa a inclusão da movimentação de um valor combinado.
// Assim o teste não precisa mexer no código: é o PostgreSQL que falha no meio da transação, como faria com
// uma queda de conexão ou uma restrição violada.
import { ProcessarEventoWebhook } from '../../../src/modulos/cobrancas/aplicacao/processar-evento-webhook.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { avisoDoAsaas, criarAluno, criarCobrancaAberta, criarUsuario, definirParametros, diaDeHojeMais, sufixo } from '../../apoio/cenario.js';

// Valor que dispara a falha. Nenhum outro teste usa: o gatilho não atrapalha mais ninguém.
const VALOR_QUE_FALHA = 4321;

describe('[Confiabilidade.NF004] [Hardware e software.NF005] CT-NF-02 falha injetada ao criar a entrada desfaz a baixa', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    await definirParametros(aplicacao.prisma, diretor.id);
    cookie = await entrar(aplicacao, diretor.email, diretor.senha);
    await aplicacao.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION falha_injetada_pelo_teste() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'falha injetada pelo teste CT-NF-02';
      END
      $$ LANGUAGE plpgsql`);
    await aplicacao.prisma.$executeRawUnsafe(`
      CREATE TRIGGER falha_ao_criar_entrada BEFORE INSERT ON movimentacoes
      FOR EACH ROW WHEN (NEW.valor_centavos = ${VALOR_QUE_FALHA}) EXECUTE FUNCTION falha_injetada_pelo_teste()`);
  });

  afterAll(async () => {
    await aplicacao?.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS falha_ao_criar_entrada ON movimentacoes');
    await aplicacao?.encerrar();
  });

  // O que tem de valer depois da falha: cobrança como estava, nenhuma entrada e nada na trilha sobre ela.
  async function conferirQueNadaMudou(cobrancaId: string) {
    const cobranca = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
    expect(cobranca.situacao).toBe('ABERTA');
    expect(cobranca.movimentacaoId).toBeNull();
    expect(cobranca.pagaEm).toBeNull();
    expect(await aplicacao.prisma.movimentacao.count({ where: { valorCentavos: VALOR_QUE_FALHA } })).toBe(0);
    expect(await aplicacao.prisma.registroAuditoria.count({ where: { registroId: cobrancaId } })).toBe(0);
  }

  it('conciliação: o worker falha ao criar a entrada; a cobrança continua aberta e o evento continua pendente', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, valorCentavos: VALOR_QUE_FALHA });
    const idEvento = `evt_${sufixo()}`;
    await aplicacao
      .http()
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'token-do-webhook-so-para-teste')
      .send(avisoDoAsaas(idEvento, 'PAYMENT_RECEIVED', cobranca.idAsaas!, VALOR_QUE_FALHA / 100, diaDeHojeMais(0)))
      .expect(200);
    const evento = await aplicacao.prisma.eventoWebhook.findUniqueOrThrow({ where: { idAsaas: idEvento } });

    // O mesmo caso de uso que o consumidor da fila chama. Com a falha, ele lança (e a fila tentaria de novo).
    await expect(aplicacao.app.get(ProcessarEventoWebhook).executar(evento.id)).rejects.toThrow(/falha injetada/);

    await conferirQueNadaMudou(cobranca.id);
    // A marcação de "processado" estava na mesma transação: também foi desfeita, então a nova tentativa acontece.
    expect((await aplicacao.prisma.eventoWebhook.findUniqueOrThrow({ where: { id: evento.id } })).processadoEm).toBeNull();
  });

  it('registro manual: a requisição falha e nada fica gravado', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, valorCentavos: VALOR_QUE_FALHA });

    const resposta = await aplicacao
      .http()
      .post(`/api/cobrancas/${cobranca.id}/pagamento-manual`)
      .set('Cookie', cookie)
      .send({ pagoEm: diaDeHojeMais(0), valorCentavos: VALOR_QUE_FALHA, formaPagamento: 'PIX', justificativa: 'Pix conferido no extrato (teste)' });

    expect(resposta.status).toBeGreaterThanOrEqual(500);
    await conferirQueNadaMudou(cobranca.id);
  });

  it('sincronização: o Asaas diz que foi paga, a entrada falha e a cobrança continua aberta', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, valorCentavos: VALOR_QUE_FALHA });
    const noAsaas = aplicacao.asaas.noAsaas.get(cobranca.idAsaas!)!;
    aplicacao.asaas.noAsaas.set(cobranca.idAsaas!, { ...noAsaas, situacao: 'RECEIVED', pagoEm: diaDeHojeMais(0) });

    await aplicacao.http().post(`/api/cobrancas/${cobranca.id}/sincronizar`).set('Cookie', cookie).send({});

    // Não importa como a sincronização relata a falha: importa que nada ficou pela metade.
    await conferirQueNadaMudou(cobranca.id);
  });

  it('sem a falha, a mesma conciliação conclui: a falha anterior não deixou nada que impeça a nova tentativa', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, valorCentavos: VALOR_QUE_FALHA });
    const idEvento = `evt_${sufixo()}`;
    await aplicacao
      .http()
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'token-do-webhook-so-para-teste')
      .send(avisoDoAsaas(idEvento, 'PAYMENT_RECEIVED', cobranca.idAsaas!, VALOR_QUE_FALHA / 100, diaDeHojeMais(0)))
      .expect(200);
    const evento = await aplicacao.prisma.eventoWebhook.findUniqueOrThrow({ where: { idAsaas: idEvento } });
    const processar = aplicacao.app.get(ProcessarEventoWebhook);
    await expect(processar.executar(evento.id)).rejects.toThrow(/falha injetada/);

    // A "queda" passou: o gatilho sai e a fila tenta de novo.
    await aplicacao.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS falha_ao_criar_entrada ON movimentacoes');
    await processar.executar(evento.id);

    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id }, include: { movimentacao: true } });
    expect(paga.situacao).toBe('PAGA');
    expect(paga.movimentacao?.valorCentavos).toBe(VALOR_QUE_FALHA);
  });
});

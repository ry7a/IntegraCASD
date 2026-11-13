// CT-MOV-02 (integração, tabela de decisão): estorno de movimentação pela rota HTTP, com banco real.
//
// Tabela de decisão (origem da movimentação x já estornada -> ação esperada):
//   R1  MANUAL                       não estornada -> cria o espelho de sinal contrário; o efeito no resultado zera (FP)
//   R2  MANUAL                       já estornada  -> recusa (409) e não cria outro espelho (E2)
//   R3  REGISTRO_MANUAL_DE_COBRANCA  não estornada -> recusa (400): trate pela cobrança (E1)
//   R4  CONCILIACAO_AUTOMATICA       não estornada -> recusa (400): trate pela cobrança (E1)
//   R5  ESTORNO (o próprio espelho)  -             -> recusa (400): estorno não se estorna
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  type UsuarioDeTeste,
  criarAluno,
  criarCategoria,
  criarCobrancaAberta,
  criarConta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
  sufixo,
} from '../../apoio/cenario.js';
import { deDia } from '../../../src/compartilhado/datas.js';

const HOJE = diaDeHojeMais(0);
const MES = HOJE.slice(0, 7);

describe('[Movimentações.RF002] CT-MOV-02 estorno de movimentação', () => {
  let aplicacao: AplicacaoDeTeste;
  let autor: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    autor = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, autor.email, autor.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  function estornar(id: string, motivo = 'Valor lançado errado no teste') {
    return aplicacao.http().post(`/api/movimentacoes/${id}/estornar`).set('Cookie', cookie).send({ motivo });
  }

  // Totais da consulta do mês, só na categoria do teste: assim nenhum outro lançamento do banco entra na conta.
  async function totaisDaCategoria(categoriaId: string) {
    const resposta = await aplicacao.http().get(`/api/movimentacoes?mes=${MES}&categoriaId=${categoriaId}`).set('Cookie', cookie).expect(200);
    return resposta.body.totais as { entradasCentavos: number; saidasCentavos: number; saldoCentavos: number };
  }

  // Item da consulta do mês, como a tela de Movimentações o recebe.
  async function itemDaLista(categoriaId: string, id: string) {
    const resposta = await aplicacao.http().get(`/api/movimentacoes?mes=${MES}&categoriaId=${categoriaId}`).set('Cookie', cookie).expect(200);
    return (resposta.body.itens as Array<{ id: string; podeEstornar: boolean; motivoSemEstorno: string | null; estornadaEm: string | null }>).find(
      (item) => item.id === id,
    );
  }

  async function espelhosDe(id: string): Promise<number> {
    return aplicacao.prisma.movimentacao.count({ where: { estornoDeId: id } });
  }

  // Uma saída manual de R$ 1.200,00 vinculada a um projeto, lançada pela rota (como a tela faz).
  async function lancarSaidaManual() {
    const conta = await criarConta(aplicacao.prisma);
    const categoria = await criarCategoria(aplicacao.prisma, 'SAIDA');
    const projeto = await aplicacao
      .http()
      .post('/api/projetos')
      .set('Cookie', cookie)
      .send({ nome: `Projeto de teste ${sufixo()}`, dataInicio: '2026-01-01' })
      .expect(201);
    const resposta = await aplicacao
      .http()
      .post('/api/movimentacoes')
      .set('Cookie', cookie)
      .send({
        contaId: conta.id,
        tipo: 'SAIDA',
        valorCentavos: 120000,
        data: HOJE,
        categoriaId: categoria.id,
        forma: 'TRANSFERENCIA',
        descricao: `NF de teste ${sufixo()}`,
        projetoId: projeto.body.id,
      })
      .expect(201);
    return { id: resposta.body.id as string, contaId: conta.id, categoriaId: categoria.id, projetoId: projeto.body.id as string };
  }

  it('R1 (fluxo FP): estorno de lançamento manual cria o espelho de sinal contrário e zera o efeito no resultado', async () => {
    const original = await lancarSaidaManual();
    const totaisComAOriginal = await totaisDaCategoria(original.categoriaId);
    expect(totaisComAOriginal).toMatchObject({ entradasCentavos: 0, saidasCentavos: 120000, saldoCentavos: -120000 });

    const resposta = await estornar(original.id, 'Valor lançado errado; o certo é outro');

    expect(resposta.status).toBe(200);
    const espelhoId: string = resposta.body.espelhoId;

    // Caixa cinza: o espelho tem o tipo oposto e copia valor, conta, categoria, forma e vínculo.
    const espelho = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: espelhoId } });
    expect(espelho).toMatchObject({
      tipo: 'ENTRADA',
      valorCentavos: 120000,
      contaId: original.contaId,
      categoriaId: original.categoriaId,
      projetoId: original.projetoId,
      formaPagamento: 'TRANSFERENCIA',
      origem: 'ESTORNO',
      estornoDeId: original.id,
      motivoEstorno: 'Valor lançado errado; o certo é outro',
      registradaPorId: autor.id,
    });
    expect(espelho.data).toEqual(deDia(HOJE));

    // A original continua no banco, sem mudança, e a lista a mostra marcada como estornada.
    const gravada = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: original.id } });
    expect(gravada).toMatchObject({ tipo: 'SAIDA', valorCentavos: 120000, origem: 'MANUAL' });
    expect(await itemDaLista(original.categoriaId, original.id)).toMatchObject({ estornadaEm: HOJE, podeEstornar: false });

    // O par se anula: entradas e saídas do recorte voltam a zero.
    expect(await totaisDaCategoria(original.categoriaId)).toMatchObject({ entradasCentavos: 0, saidasCentavos: 0, saldoCentavos: 0 });

    // A trilha registra o estorno da original, com o autor.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({
      where: { entidade: 'MOVIMENTACAO', registroId: original.id },
      orderBy: { ocorridoEm: 'asc' },
    });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([
      ['INCLUSAO', autor.id],
      ['ESTORNO', autor.id],
    ]);
  });

  it('R2 (fluxo E2): movimentação já estornada não ganha outro espelho', async () => {
    const original = await lancarSaidaManual();
    await estornar(original.id).expect(200);

    const segunda = await estornar(original.id);

    expect(segunda.status).toBe(409);
    expect(segunda.body.message).toContain('já foi estornada');
    expect(await espelhosDe(original.id)).toBe(1);
    expect(await totaisDaCategoria(original.categoriaId)).toMatchObject({ saidasCentavos: 0, saldoCentavos: 0 });
  });

  it('R3 (fluxo E1): movimentação do registro manual de pagamento de cobrança não pode ser estornada', async () => {
    // A entrada nasce pelo caminho real: pagamento manual de uma cobrança [Cobranças.RF006].
    const diretor = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    const parametros = await definirParametros(aplicacao.prisma, diretor.id);
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, valorCentavos: 8500 });
    await aplicacao
      .http()
      .post(`/api/cobrancas/${cobranca.id}/pagamento-manual`)
      .set('Cookie', cookie)
      .send({ pagoEm: HOJE, valorCentavos: 8500, formaPagamento: 'PIX', justificativa: 'Pix recebido na conta do CASD, teste' })
      .expect(204);
    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id }, include: { movimentacao: true } });
    expect(paga.movimentacao?.origem).toBe('REGISTRO_MANUAL_DE_COBRANCA');
    const movimentacaoId = paga.movimentacao!.id;

    // A lista já não oferece o estorno e diz o porquê.
    const item = await itemDaLista(parametros.categoriaAvulsaId, movimentacaoId);
    expect(item).toMatchObject({ podeEstornar: false });
    expect(item?.motivoSemEstorno).toContain('trate pela cobrança');

    // E a rota recusa, se alguém chamar mesmo assim.
    const resposta = await estornar(movimentacaoId);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('trate pela cobrança');
    expect(await espelhosDe(movimentacaoId)).toBe(0);
    expect((await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).situacao).toBe('PAGA_COM_REGISTRO_MANUAL');
  });

  it('R4 (fluxo E1): movimentação da conciliação automática não pode ser estornada', async () => {
    // A entrada que o worker grava ao conciliar um pagamento do Asaas.
    const conta = await criarConta(aplicacao.prisma);
    const categoria = await criarCategoria(aplicacao.prisma, 'ENTRADA');
    const conciliada = await aplicacao.prisma.movimentacao.create({
      data: {
        contaId: conta.id,
        tipo: 'ENTRADA',
        valorCentavos: 8500,
        data: deDia(HOJE),
        categoriaId: categoria.id,
        formaPagamento: 'ASAAS',
        origem: 'CONCILIACAO_AUTOMATICA',
        descricao: `Mensalidade de teste ${sufixo()}`,
      },
    });
    expect(await itemDaLista(categoria.id, conciliada.id)).toMatchObject({ podeEstornar: false });

    const resposta = await estornar(conciliada.id);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('trate pela cobrança');
    expect(await espelhosDe(conciliada.id)).toBe(0);
    expect(await totaisDaCategoria(categoria.id)).toMatchObject({ entradasCentavos: 8500, saldoCentavos: 8500 });
  });

  it('R5: o próprio espelho (origem ESTORNO) não pode ser estornado', async () => {
    const original = await lancarSaidaManual();
    const { body } = await estornar(original.id).expect(200);

    const resposta = await estornar(body.espelhoId);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('Um estorno não é estornado');
    expect(await espelhosDe(body.espelhoId)).toBe(0);
  });
});

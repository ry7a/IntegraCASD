// CT-MOV-01 (integração, valor-limite): lançamento manual de movimentação pela rota HTTP, com banco real.
//
// Limites testados (o valor válido mais próximo e o inválido mais próximo de cada regra):
//   data  (fluxo E1): hoje é aceita;      amanhã é recusada (movimentação registra fato, não previsão)
//   valor (fluxo E2): 1 centavo é aceito; 0 é recusado
// Em cada recusa, confere no banco que nada foi gravado: nem a movimentação, nem a trilha.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarCategoria, criarConta, criarUsuario, diaDeHojeMais, sufixo } from '../../apoio/cenario.js';

describe('[Movimentações.RF001] CT-MOV-01 registro de movimentação', () => {
  let aplicacao: AplicacaoDeTeste;
  let autor: UsuarioDeTeste;
  let cookie: string;
  let contaId: string;
  let categoriaId: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    autor = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, autor.email, autor.senha);
    contaId = (await criarConta(aplicacao.prisma)).id;
    categoriaId = (await criarCategoria(aplicacao.prisma, 'SAIDA')).id;
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // Corpo de uma "Nova movimentação" válida; cada teste troca só o campo que está testando.
  // A descrição leva um sufixo para o teste achar no banco exatamente o que ele lançou.
  function novaMovimentacao(campos: { data?: string; valorCentavos?: number } = {}) {
    return {
      contaId,
      tipo: 'SAIDA',
      valorCentavos: 120000,
      data: diaDeHojeMais(0),
      categoriaId,
      forma: 'PIX',
      descricao: `NF de teste ${sufixo()}`,
      ...campos,
    };
  }

  async function lancar(corpo: ReturnType<typeof novaMovimentacao>) {
    return aplicacao.http().post('/api/movimentacoes').set('Cookie', cookie).send(corpo);
  }

  // O que ficou gravado com aquela descrição: as movimentações e os registros da trilha.
  async function gravadoNoBanco(descricao: string) {
    const movimentacoes = await aplicacao.prisma.movimentacao.count({ where: { descricao } });
    const trilha = await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'MOVIMENTACAO', detalhe: { contains: descricao } } });
    return { movimentacoes, trilha };
  }

  it('fluxo FP: movimentação válida é gravada como lançamento manual, com o autor e a trilha', async () => {
    const corpo = novaMovimentacao();

    const resposta = await lancar(corpo);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ id: expect.any(String), aviso: null });

    // Caixa cinza: a linha gravada, com o autor e a data e hora do registro.
    const gravada = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: resposta.body.id } });
    expect(gravada).toMatchObject({
      contaId,
      tipo: 'SAIDA',
      valorCentavos: 120000,
      categoriaId,
      formaPagamento: 'PIX',
      origem: 'MANUAL',
      descricao: corpo.descricao,
      registradaPorId: autor.id,
      estornoDeId: null,
    });
    expect(gravada.data.toISOString().slice(0, 10)).toBe(corpo.data);
    expect(gravada.dataCriacao).toBeInstanceOf(Date);

    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'MOVIMENTACAO', registroId: gravada.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['INCLUSAO', autor.id]]);

    // Passa a compor o resultado do período: aparece na consulta do mês, na categoria.
    const consulta = await aplicacao
      .http()
      .get(`/api/movimentacoes?mes=${corpo.data.slice(0, 7)}&categoriaId=${categoriaId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect((consulta.body.itens as Array<{ id: string }>).map((item) => item.id)).toContain(gravada.id);
  });

  it.each([
    { quando: 'hoje', dias: 0, status: 201, gravadas: 1 },
    { quando: 'amanhã', dias: 1, status: 400, gravadas: 0 },
  ])('fluxo E1 (valor-limite): data de $quando responde $status', async ({ dias, status, gravadas }) => {
    const corpo = novaMovimentacao({ data: diaDeHojeMais(dias) });

    const resposta = await lancar(corpo);

    expect(resposta.status).toBe(status);
    if (status === 400) expect(resposta.body.message).toContain('não pode ser no futuro');
    expect(await gravadoNoBanco(corpo.descricao)).toEqual({ movimentacoes: gravadas, trilha: gravadas });
  });

  it.each([
    { rotulo: '1 centavo', valorCentavos: 1, status: 201, gravadas: 1 },
    { rotulo: 'zero', valorCentavos: 0, status: 400, gravadas: 0 },
  ])('fluxo E2 (valor-limite): valor de $rotulo responde $status', async ({ valorCentavos, status, gravadas }) => {
    const corpo = novaMovimentacao({ valorCentavos });

    const resposta = await lancar(corpo);

    expect(resposta.status).toBe(status);
    if (status === 400) expect(resposta.body.message).toContain('maior que zero');
    expect(await gravadoNoBanco(corpo.descricao)).toEqual({ movimentacoes: gravadas, trilha: gravadas });
    if (status === 201) {
      const gravada = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: resposta.body.id } });
      expect(gravada.valorCentavos).toBe(1);
    }
  });
});

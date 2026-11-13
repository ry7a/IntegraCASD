// CT-CAD-04 (integração, caixa cinza): cadastro de projeto e lançamento em projeto encerrado, pelas rotas HTTP.
//
// Fluxo E1 do [Cadastros.RF005] (e A2 do [Movimentações.RF001]): movimentação em projeto encerrado é aceita
// e o sistema sinaliza, em vez de recusar. "Encerrado", no próprio sistema, é executado OU cancelado
// (MER, decisão 5; ProjetoDto.encerrado). Por isso as duas situações são testadas.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarCategoria, criarConta, criarUsuario, diaDeHojeMais, sufixo } from '../../apoio/cenario.js';

describe('[Cadastros.RF005] CT-CAD-04 cadastro de projeto', () => {
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

  function novoProjeto() {
    return {
      nome: `Projeto de teste ${sufixo()}`,
      responsavel: 'Responsavel Ficticio',
      dataInicio: '2026-03-01',
      dataFim: '2026-06-30',
      orcamentoPrevistoCentavos: 500000,
    };
  }

  async function criarProjeto(): Promise<string> {
    const resposta = await aplicacao.http().post('/api/projetos').set('Cookie', cookie).send(novoProjeto()).expect(201);
    return resposta.body.id;
  }

  // Lança uma saída de R$ 300,00 vinculada ao projeto, como o diálogo "Nova movimentação".
  function lancarSaidaNoProjeto(projetoId: string) {
    return aplicacao
      .http()
      .post('/api/movimentacoes')
      .set('Cookie', cookie)
      .send({
        contaId,
        tipo: 'SAIDA',
        valorCentavos: 30000,
        data: diaDeHojeMais(0),
        categoriaId,
        forma: 'PIX',
        descricao: `Nota fiscal de teste ${sufixo()}`,
        projetoId,
      });
  }

  it('fluxo FP: projeto válido é gravado com o código gerado e a inclusão na trilha', async () => {
    const dados = novoProjeto();

    const resposta = await aplicacao.http().post('/api/projetos').set('Cookie', cookie).send(dados);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ ...dados, situacao: 'A_LIBERAR', encerrado: false, saidasCentavos: 0, entradasCentavos: 0 });
    // Código no formato da planilha: ano com 2 dígitos + P + sequência (ex.: 26P001).
    const anoCorrente = diaDeHojeMais(0).slice(2, 4);
    expect(resposta.body.codigo).toMatch(new RegExp(`^${anoCorrente}P\\d{3}$`));

    // Caixa cinza: a linha gravada e a trilha, na mesma transação.
    const gravado = await aplicacao.prisma.projeto.findUniqueOrThrow({ where: { id: resposta.body.id } });
    expect(gravado).toMatchObject({
      codigo: resposta.body.codigo,
      nome: dados.nome,
      responsavel: dados.responsavel,
      orcamentoPrevistoCentavos: 500000,
      situacao: 'A_LIBERAR',
    });
    expect(gravado.dataInicio.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(gravado.dataFim?.toISOString().slice(0, 10)).toBe('2026-06-30');
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'PROJETO', registroId: gravado.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['INCLUSAO', autor.id]]);

    // Aparece entre os projetos em andamento.
    const lista = await aplicacao.http().get('/api/projetos').set('Cookie', cookie).expect(200);
    expect((lista.body.itens as Array<{ id: string }>).map((projeto) => projeto.id)).toContain(gravado.id);
  });

  it('contraste do fluxo E1: em projeto em andamento a movimentação é aceita sem aviso', async () => {
    const projetoId = await criarProjeto();

    const resposta = await lancarSaidaNoProjeto(projetoId);

    expect(resposta.status).toBe(201);
    expect(resposta.body.aviso).toBeNull();
  });

  it.each(['EXECUTADO', 'CANCELADO'])(
    'fluxo E1: movimentação em projeto encerrado (%s) é aceita, gravada no projeto e sinalizada com aviso',
    async (situacao) => {
      const projetoId = await criarProjeto();
      // Fluxo A1: encerrar é mudar a situação para executado ou cancelado.
      const encerrado = await aplicacao.http().patch(`/api/projetos/${projetoId}`).set('Cookie', cookie).send({ situacao }).expect(200);
      expect(encerrado.body.encerrado).toBe(true);

      const resposta = await lancarSaidaNoProjeto(projetoId);

      // Aceita (não recusa) e devolve um aviso para a tela mostrar.
      expect(resposta.status).toBe(201);
      const movimentacao = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: resposta.body.id } });
      expect(movimentacao).toMatchObject({ projetoId, tipo: 'SAIDA', valorCentavos: 30000, origem: 'MANUAL' });
      const lista = await aplicacao.http().get('/api/projetos?situacao=encerrados').set('Cookie', cookie).expect(200);
      const projeto = (lista.body.itens as Array<{ id: string; saidasCentavos: number }>).find((item) => item.id === projetoId);
      expect(projeto?.saidasCentavos).toBe(30000);
      expect(resposta.body.aviso).toEqual(expect.any(String));
    },
  );
});

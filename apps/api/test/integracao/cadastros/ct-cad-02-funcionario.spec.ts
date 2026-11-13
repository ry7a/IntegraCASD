// CT-CAD-02 (integração, caixa cinza + valor-limite): cadastro de funcionário pelas rotas HTTP, com banco real.
//
// Fluxo A1: "o sistema inativa o funcionário automaticamente a partir da data de desligamento". O limite é
// o dia de hoje: desligamento ontem ou hoje -> já inativo; amanhã -> ainda ativo (ex.: aviso prévio).
// Os três valores em volta do limite são testados com a mesma sequência de passos.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarCategoria, criarConta, criarUsuario, diaDeHojeMais, gerarCpf, sufixo } from '../../apoio/cenario.js';

describe('[Cadastros.RF002] CT-CAD-02 cadastro de funcionário', () => {
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

  // Corpo de um "Novo funcionário" válido, com dados fictícios e admitido no ano passado.
  function novoFuncionario() {
    return {
      nome: `Funcionario Ficticio ${sufixo()}`,
      cpf: gerarCpf(),
      cargo: 'Auxiliar de limpeza',
      salarioReferenciaCentavos: 245000,
      dataAdmissao: '2025-03-01',
    };
  }

  async function idsNaLista(situacao: 'ativos' | 'inativos'): Promise<string[]> {
    const resposta = await aplicacao.http().get(`/api/funcionarios?situacao=${situacao}`).set('Cookie', cookie).expect(200);
    return (resposta.body.itens as Array<{ id: string }>).map((funcionario) => funcionario.id);
  }

  it('fluxo FP: funcionário válido é gravado ativo, com a inclusão na trilha', async () => {
    const dados = novoFuncionario();

    const resposta = await aplicacao.http().post('/api/funcionarios').set('Cookie', cookie).send(dados);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ ...dados, dataDesligamento: null, ativo: true });

    // Caixa cinza: a linha gravada, com a coluna `ativo` que o índice de CPF único entre ativos usa.
    const gravado = await aplicacao.prisma.funcionario.findUniqueOrThrow({ where: { id: resposta.body.id } });
    expect(gravado).toMatchObject({
      nome: dados.nome,
      cpf: dados.cpf,
      cargo: dados.cargo,
      salarioReferenciaCentavos: 245000,
      dataDesligamento: null,
      ativo: true,
    });
    expect(gravado.dataAdmissao.toISOString().slice(0, 10)).toBe('2025-03-01');

    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'FUNCIONARIO', registroId: gravado.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['INCLUSAO', autor.id]]);
    expect(await idsNaLista('ativos')).toContain(gravado.id);
  });

  it.each([
    { quando: 'ontem', dias: -1, ativo: false, operacao: 'INATIVACAO' },
    { quando: 'hoje', dias: 0, ativo: false, operacao: 'INATIVACAO' },
    { quando: 'amanhã', dias: 1, ativo: true, operacao: 'ALTERACAO' },
  ])(
    'fluxo A1 (valor-limite): desligamento $quando deixa o funcionário ativo = $ativo e mantém o histórico de pagamentos',
    async ({ dias, ativo, operacao }) => {
      const criado = await aplicacao.http().post('/api/funcionarios').set('Cookie', cookie).send(novoFuncionario()).expect(201);
      const id: string = criado.body.id;

      // Um pagamento já lançado para ele: o histórico que o desligamento precisa manter.
      const conta = await criarConta(aplicacao.prisma);
      const categoria = await criarCategoria(aplicacao.prisma, 'SAIDA');
      const pagamento = await aplicacao
        .http()
        .post('/api/movimentacoes')
        .set('Cookie', cookie)
        .send({
          contaId: conta.id,
          tipo: 'SAIDA',
          valorCentavos: 245000,
          data: diaDeHojeMais(-1),
          categoriaId: categoria.id,
          forma: 'PIX',
          descricao: `Salario de teste ${sufixo()}`,
          funcionarioId: id,
        })
        .expect(201);

      const dataDesligamento = diaDeHojeMais(dias);
      const resposta = await aplicacao.http().patch(`/api/funcionarios/${id}`).set('Cookie', cookie).send({ dataDesligamento });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ dataDesligamento, ativo });

      // Banco: a data gravada e a coluna `ativo` alinhada com ela.
      const gravado = await aplicacao.prisma.funcionario.findUniqueOrThrow({ where: { id } });
      expect(gravado.dataDesligamento?.toISOString().slice(0, 10)).toBe(dataDesligamento);
      expect(gravado.ativo).toBe(ativo);

      // A lista por situação e as opções de vínculo de uma movimentação nova seguem a mesma regra.
      expect((await idsNaLista('ativos')).includes(id)).toBe(ativo);
      expect((await idsNaLista('inativos')).includes(id)).toBe(!ativo);
      const opcoes = await aplicacao.http().get('/api/movimentacoes/opcoes').set('Cookie', cookie).expect(200);
      const oferecidos = (opcoes.body.funcionarios as Array<{ id: string }>).map((funcionario) => funcionario.id);
      expect(oferecidos.includes(id)).toBe(ativo);

      // Trilha: inclusão e, depois, inativação (ontem/hoje) ou só alteração (amanhã).
      const trilha = await aplicacao.prisma.registroAuditoria.findMany({
        where: { entidade: 'FUNCIONARIO', registroId: id },
        orderBy: { ocorridoEm: 'asc' },
      });
      expect(trilha.map((registro) => registro.operacao)).toEqual(['INCLUSAO', operacao]);

      // O histórico continua: o pagamento segue gravado e vinculado ao funcionário.
      const movimentacao = await aplicacao.prisma.movimentacao.findUniqueOrThrow({ where: { id: pagamento.body.id } });
      expect(movimentacao.funcionarioId).toBe(id);
      expect(await aplicacao.prisma.funcionario.count({ where: { id } })).toBe(1);
    },
  );
});

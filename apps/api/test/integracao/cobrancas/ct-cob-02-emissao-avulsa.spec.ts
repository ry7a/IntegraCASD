// CT-COB-02 (integração, tabela de decisão): emissão de cobrança avulsa pela rota HTTP, com banco real.
// Cada regra da tabela 3.2 do Plano de Testes é um `it`:
//   R1 aluno ativo, e-mail e CPF válidos, vencimento hoje ou depois, Asaas responde -> cria a cobrança Aberta
//   R2 aluno inativo                                                                -> recusa
//   R3 e-mail ou CPF inválido                                                       -> recusa e aponta o campo
//   R4 vencimento no passado                                                        -> recusa (ontem não, hoje sim)
//   R5 Asaas não responde                                                           -> nada é gravado
// "E-mail inválido" aqui é o e-mail vazio: o cadastro só aceita e-mail no formato certo, e a carga inicial grava
// vazio quando a planilha traz um e-mail fora do formato. O Asaas é o falso; o resto é o código de produção.
import type { Aluno } from '../../../src/generated/prisma/client.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarAluno, criarUsuario, definirParametros, diaDeHojeMais } from '../../apoio/cenario.js';
import { cpfComDigitoErrado } from './apoio-de-cobrancas.js';

describe('[Cobranças.RF002] CT-COB-02 emissão de cobrança avulsa (tabela de decisão)', () => {
  let aplicacao: AplicacaoDeTeste;
  let atendente: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
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
    aplicacao.asaas.indisponivel = false;
  });

  // O que o formulário "Nova cobrança" manda para a API.
  function emitir(aluno: Aluno, vencimento = diaDeHojeMais(5)) {
    return aplicacao
      .http()
      .post('/api/cobrancas')
      .set('Cookie', cookie)
      .send({ alunoId: aluno.id, valorCentavos: 4500, vencimento, descricao: 'Camiseta do CASD (teste)' });
  }

  // Fotografia do que poderia mudar numa emissão: cobranças do aluno, pedidos ao Asaas e trilha.
  async function fotografar(aluno: Aluno) {
    return {
      cobrancasDoAluno: await aplicacao.prisma.cobranca.count({ where: { alunoId: aluno.id } }),
      clienteAsaasDoAluno: await aplicacao.prisma.clienteAsaas.count({ where: { alunoId: aluno.id } }),
      clientesPedidosAoAsaas: aplicacao.asaas.clientesCriados.length,
      cobrancasPedidasAoAsaas: aplicacao.asaas.cobrancasCriadas.length,
      registrosNaTrilha: await aplicacao.prisma.registroAuditoria.count(),
    };
  }

  it('R1: aluno ativo com e-mail e CPF válidos, vencimento futuro e Asaas no ar: cria a cobrança Aberta com o id do Asaas [Confiabilidade.NF005]', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const vencimento = diaDeHojeMais(5);

    const resposta = await emitir(aluno, vencimento);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      alunoId: aluno.id,
      origem: 'AVULSA',
      descricao: 'Camiseta do CASD (teste)',
      valorCentavos: 4500,
      vencimento,
      situacao: 'ABERTA',
      // Multa e juros dos parâmetros vigentes, enviados ao Asaas.
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    });
    expect(resposta.body.urlBoleto).toEqual(expect.any(String));

    // Caixa cinza: a cobrança gravada tem o id que o Asaas devolveu, e o Asaas recebeu o pedido completo.
    const gravada = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: resposta.body.id as string } });
    expect(gravada).toMatchObject({ situacao: 'ABERTA', origem: 'AVULSA', referencia: null, emitidaPorId: atendente.id });
    expect(gravada.idAsaas).not.toBeNull();
    expect(aplicacao.asaas.noAsaas.get(gravada.idAsaas!)).toMatchObject({
      valorCentavos: 4500,
      vencimento,
      descricao: 'Camiseta do CASD (teste)',
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    });
    // O aluno virou cliente no Asaas, com CPF e e-mail, e o vínculo ficou gravado.
    expect(aplicacao.asaas.clientesCriados).toContainEqual({ nome: aluno.nome, cpf: aluno.cpf, email: aluno.email });
    expect(await aplicacao.prisma.clienteAsaas.count({ where: { alunoId: aluno.id } })).toBe(1);
    // A emissão fica na trilha com o autor.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'COBRANCA', registroId: gravada.id } });
    expect(trilha).toEqual([expect.objectContaining({ operacao: 'INCLUSAO', usuarioId: atendente.id })]);
  });

  it('R2: aluno inativo: recusa a emissão, sem chamar o Asaas e sem gravar nada', async () => {
    const aluno = await criarAluno(aplicacao.prisma, { ativo: false });
    const antes = await fotografar(aluno);

    const resposta = await emitir(aluno);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('inativo');
    expect(await fotografar(aluno)).toEqual(antes);
  });

  it('R3: aluno sem e-mail: recusa e aponta o e-mail como o campo pendente (fluxo A1)', async () => {
    const aluno = await criarAluno(aplicacao.prisma, { email: '' });
    const antes = await fotografar(aluno);

    const resposta = await emitir(aluno);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('falta o e-mail');
    expect(await fotografar(aluno)).toEqual(antes);
  });

  it('R3: aluno com CPF inválido: recusa e aponta o CPF como o campo pendente (fluxo A1)', async () => {
    const aluno = await criarAluno(aplicacao.prisma, { cpf: cpfComDigitoErrado() });
    const antes = await fotografar(aluno);

    const resposta = await emitir(aluno);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('CPF válido');
    expect(await fotografar(aluno)).toEqual(antes);
  });

  it('R4: vencimento no passado é recusado (fluxo E2): ontem não é aceito, hoje é', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const antes = await fotografar(aluno);

    const ontem = await emitir(aluno, diaDeHojeMais(-1));

    expect(ontem.status).toBe(400);
    expect(ontem.body.message).toContain('vencimento não pode ser anterior a hoje');
    expect(await fotografar(aluno)).toEqual(antes);

    // O limite: hoje ainda vale.
    const hoje = await emitir(aluno, diaDeHojeMais(0));

    expect(hoje.status).toBe(201);
    expect(hoje.body).toMatchObject({ vencimento: diaDeHojeMais(0), situacao: 'ABERTA' });
    expect(await aplicacao.prisma.cobranca.count({ where: { alunoId: aluno.id } })).toBe(1);
  });

  it('R5: Asaas fora do ar: nada é gravado nem enfileirado, e a mensagem orienta nova tentativa (fluxo E1) [Confiabilidade.NF005] [Usabilidade.NF002]', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    const antes = await fotografar(aluno);
    const tarefasNaFila = async () => {
      const linhas = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`SELECT count(*) AS total FROM pgboss.job`;
      return Number(linhas[0].total);
    };
    const tarefasAntes = await tarefasNaFila();

    aplicacao.asaas.indisponivel = true;
    const resposta = await emitir(aluno);

    expect(resposta.status).toBe(502);
    // A mensagem já vem traduzida para o usuário, sem a resposta crua da plataforma.
    expect(resposta.body.message).toBe('O Asaas está fora do ar no momento. Tente novamente em alguns minutos.');
    expect(await fotografar(aluno)).toEqual(antes);
    // A emissão não vira uma tarefa para depois: a área administrativa sabe na hora que a cobrança não existe.
    expect(await tarefasNaFila()).toBe(tarefasAntes);
  });
});

// CT-CAD-01 (integração, caixa cinza + tabela de decisão): cadastro de aluno pelas rotas HTTP, com banco real.
// Cada cenário chama a rota como a tela chamaria e depois confere no banco o que ficou gravado.
//
// Tabela de decisão (condição -> ação esperada):
//   R1  CPF que ninguém usa                          -> grava o aluno ativo e a inclusão na trilha (FP)
//   R2  CPF de outro cadastro ATIVO                  -> recusa (409) e não grava nada (E1)
//   R3  CPF que só existe num cadastro INATIVO       -> grava (E1: "um cadastro inativo não impede")
//   R4  inativar aluno com cobrança aberta e vencida -> a API informa o débito; confirmada a inativação,
//                                                      o aluno fica inativo e as cobranças continuam valendo (E2)
//
// Sobre a "confirmação explícita" do fluxo E2: hoje ela é o diálogo da tela (DialogoInativarAluno.tsx), que
// busca o débito em GET /api/alunos/:id/cobrancas e, quando a pessoa confirma, envia PATCH { ativo: false }.
// A API não tem um campo de confirmação. Por isso o teste confere a parte da API: o débito é informado antes
// e, depois do PATCH, nada é cancelado.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarAluno, criarCobrancaAberta, criarUsuario, diaDeHojeMais, gerarCpf, sufixo } from '../../apoio/cenario.js';

// CPF como a pessoa digita na tela: 000.000.000-00.
function comPontuacao(cpf: string): string {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

// Corpo de um "Novo aluno" válido, com dados fictícios.
function novoAluno(cpf: string) {
  const marca = sufixo();
  return {
    nome: `Aluno Ficticio ${marca}`,
    cpf: comPontuacao(cpf),
    email: `aluno.${marca}@exemplo.com`,
    turma: 'T28',
    curso: 'COMP',
    posto: 'CIVIL',
  };
}

describe('[Cadastros.RF001] CT-CAD-01 cadastro de aluno', () => {
  let aplicacao: AplicacaoDeTeste;
  let autor: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    // O ator dos cadastros é a área administrativa.
    autor = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, autor.email, autor.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  async function inclusoesDoAutor(): Promise<number> {
    return aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'ALUNO', operacao: 'INCLUSAO', usuarioId: autor.id } });
  }

  it('R1 (fluxo FP): aluno válido é gravado ativo e a inclusão fica na trilha de auditoria', async () => {
    const cpf = gerarCpf();
    const dados = novoAluno(cpf);

    const resposta = await aplicacao.http().post('/api/alunos').set('Cookie', cookie).send(dados);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ nome: dados.nome, cpf, email: dados.email, ativo: true, cadastroIncompleto: false });

    // Caixa cinza: o que a rota gravou no banco. O CPF fica só com os dígitos.
    const gravado = await aplicacao.prisma.aluno.findUniqueOrThrow({ where: { id: resposta.body.id }, include: { turma: true } });
    expect(gravado).toMatchObject({ nome: dados.nome, cpf, email: dados.email, ativo: true, curso: 'COMP', posto: 'CIVIL' });
    expect(gravado.turma?.nome).toBe('T28');

    // Um registro de inclusão na trilha, com o autor.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'ALUNO', registroId: gravado.id } });
    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({ operacao: 'INCLUSAO', usuarioId: autor.id });
    // A trilha não pode ser apagada: por isso não leva nome, CPF nem e-mail (LGPD).
    expect(trilha[0].detalhe).not.toContain(dados.nome);
    expect(trilha[0].detalhe).not.toContain(cpf);
    expect(trilha[0].detalhe).not.toContain(dados.email);
  });

  it('R2 (fluxo E1): CPF de outro cadastro ativo é recusado e nada é gravado', async () => {
    const existente = await criarAluno(aplicacao.prisma);
    const inclusoesAntes = await inclusoesDoAutor();

    // Mesmo CPF, com outra pontuação, nome e e-mail: continua sendo a mesma pessoa pagadora.
    const resposta = await aplicacao.http().post('/api/alunos').set('Cookie', cookie).send(novoAluno(existente.cpf));

    expect(resposta.status).toBe(409);
    // A mensagem aponta o cadastro existente, para a pessoa abri-lo e atualizar.
    expect(resposta.body.message).toContain('Já existe um cadastro ativo com este CPF');
    expect(resposta.body.message).toContain(existente.nome);
    expect(await aplicacao.prisma.aluno.count({ where: { cpf: existente.cpf } })).toBe(1);
    expect(await inclusoesDoAutor()).toBe(inclusoesAntes);
  });

  it('R3 (fluxo E1): CPF que só existe num cadastro inativo não impede a inclusão', async () => {
    const inativo = await criarAluno(aplicacao.prisma, { ativo: false });

    const resposta = await aplicacao.http().post('/api/alunos').set('Cookie', cookie).send(novoAluno(inativo.cpf));

    expect(resposta.status).toBe(201);
    const comOMesmoCpf = await aplicacao.prisma.aluno.findMany({ where: { cpf: inativo.cpf }, orderBy: { ativo: 'asc' } });
    expect(comOMesmoCpf.map((aluno) => [aluno.id, aluno.ativo])).toEqual([
      [inativo.id, false],
      [resposta.body.id, true],
    ]);
  });

  it('R4 (fluxo E2): inativar aluno com débito informa o débito antes e, confirmada, mantém as cobranças', async () => {
    const aluno = await criarAluno(aplicacao.prisma);
    // Uma cobrança "Aberta" (vence daqui a 10 dias) e uma "Vencida" (venceu há 5 dias).
    const aberta = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, {
      alunoId: aluno.id,
      vencimento: diaDeHojeMais(10),
      valorCentavos: 8500,
    });
    const vencida = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, {
      alunoId: aluno.id,
      vencimento: diaDeHojeMais(-5),
      valorCentavos: 4000,
    });
    const inadimplenciaAntes = await aplicacao.http().get('/api/indicadores/inadimplencia').set('Cookie', cookie).expect(200);

    // 1. Antes de confirmar: a API informa o débito, que é o que o diálogo de confirmação mostra.
    const debito = await aplicacao.http().get(`/api/alunos/${aluno.id}/cobrancas`).set('Cookie', cookie);
    expect(debito.status).toBe(200);
    expect(debito.body).toMatchObject({ totalEmAbertoCentavos: 12500, quantidadeVencidas: 1, totalVencidoCentavos: 4000 });

    // 2. A pessoa confirma: o diálogo envia a inativação.
    const resposta = await aplicacao.http().patch(`/api/alunos/${aluno.id}`).set('Cookie', cookie).send({ ativo: false });
    expect(resposta.status).toBe(200);
    expect(resposta.body.ativo).toBe(false);

    // 3. Banco: aluno inativo (não excluído) e as duas cobranças continuam abertas, aqui e no Asaas.
    expect((await aplicacao.prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).ativo).toBe(false);
    const cobrancas = await aplicacao.prisma.cobranca.findMany({ where: { alunoId: aluno.id } });
    expect(cobrancas.map((cobranca) => cobranca.situacao)).toEqual(['ABERTA', 'ABERTA']);
    expect(aplicacao.asaas.cobrancasCanceladas).not.toContain(aberta.idAsaas);
    expect(aplicacao.asaas.cobrancasCanceladas).not.toContain(vencida.idAsaas);

    // 4. A inativação fica na trilha, com o autor.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'ALUNO', registroId: aluno.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['INATIVACAO', autor.id]]);

    // 5. O cadastro continua consultável, as cobranças continuam visíveis e na inadimplência.
    const cadastro = await aplicacao.http().get(`/api/alunos/${aluno.id}`).set('Cookie', cookie);
    expect(cadastro.status).toBe(200);
    expect(cadastro.body.ativo).toBe(false);
    const depois = await aplicacao.http().get(`/api/alunos/${aluno.id}/cobrancas`).set('Cookie', cookie);
    expect(depois.body).toMatchObject({ totalEmAbertoCentavos: 12500, quantidadeVencidas: 1, totalVencidoCentavos: 4000 });
    const inadimplenciaDepois = await aplicacao.http().get('/api/indicadores/inadimplencia').set('Cookie', cookie).expect(200);
    expect(inadimplenciaDepois.body.alunosInadimplentes).toBe(inadimplenciaAntes.body.alunosInadimplentes);
    expect(inadimplenciaDepois.body.valorEmAbertoCentavos).toBe(inadimplenciaAntes.body.valorEmAbertoCentavos);
  });
});

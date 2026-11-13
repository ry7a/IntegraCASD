// CT-ADM-05 (sistema, caso de uso): consulta da trilha de auditoria pela API, e a trilha inalterável
// [Segurança.NF006]. Duas pessoas fazem operações pela API (cada uma vira um registro na trilha); a consulta
// é filtrada por período e por usuário. Depois, o fluxo E1: não há rota que altere ou exclua a trilha, e o
// próprio banco recusa UPDATE, DELETE e TRUNCATE nela.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarUsuario, diaDeHojeMais, gerarCpf, sufixo } from '../../apoio/cenario.js';

const HOJE = diaDeHojeMais(0);
const ONTEM = diaDeHojeMais(-1);

type ItemDaTrilha = {
  id: string;
  ocorridoEm: string;
  usuarioNome: string | null;
  operacao: string;
  entidade: string;
  registroId: string | null;
  detalhe: string;
};

describe('[Administração.RF005] CT-ADM-05 consulta da trilha de auditoria', () => {
  let aplicacao: AplicacaoDeTeste;
  let diretor: UsuarioDeTeste;
  let cookieDiretor: string;
  let operador: UsuarioDeTeste;
  // Os registros que este teste produziu (ou plantou) na trilha.
  let inclusaoDoAluno: string;
  let inclusaoDaCategoria: string;
  let registroAntigo: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    diretor = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    cookieDiretor = await entrar(aplicacao, diretor.email, diretor.senha);
    operador = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    const cookieOperador = await entrar(aplicacao, operador.email, operador.senha);

    // O operador inclui um aluno e o diretor inclui uma categoria, pela API.
    const marca = sufixo();
    const aluno = await aplicacao
      .http()
      .post('/api/alunos')
      .set('Cookie', cookieOperador)
      .send({ nome: `Aluno Ficticio ${marca}`, cpf: gerarCpf(), email: `aluno.${marca}@exemplo.com` })
      .expect(201);
    const categoria = await aplicacao
      .http()
      .post('/api/admin/categorias')
      .set('Cookie', cookieDiretor)
      .send({ nome: `Categoria de teste ${marca}`, tipo: 'SAIDA' })
      .expect(201);
    inclusaoDoAluno = (await aplicacao.prisma.registroAuditoria.findFirstOrThrow({ where: { registroId: aluno.body.id } })).id;
    inclusaoDaCategoria = (await aplicacao.prisma.registroAuditoria.findFirstOrThrow({ where: { registroId: categoria.body.id } })).id;

    // Um registro de um período passado. A API só grava com a hora atual, então ele é plantado direto no
    // banco (inclusão é a única operação que a trilha aceita).
    const antigo = await aplicacao.prisma.registroAuditoria.create({
      data: {
        usuarioId: operador.id,
        operacao: 'ALTERACAO',
        entidade: 'ALUNO',
        registroId: aluno.body.id,
        detalhe: 'Aluno alterado: celular.',
        ocorridoEm: new Date('2025-06-15T15:00:00-03:00'),
      },
    });
    registroAntigo = antigo.id;
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  async function consultar(filtros: string): Promise<{ itens: ItemDaTrilha[]; total: number }> {
    const resposta = await aplicacao.http().get(`/api/admin/trilha-auditoria${filtros}`).set('Cookie', cookieDiretor);
    expect(resposta.status).toBe(200);
    return resposta.body;
  }

  it('fluxo FP: por usuário, no período padrão (mês corrente), mostra só as operações daquela pessoa', async () => {
    const { itens, total } = await consultar(`?usuario=${operador.id}`);

    // O operador é novo: no mês corrente, a única operação dele é a inclusão do aluno.
    expect(itens.map((item) => item.id)).toEqual([inclusaoDoAluno]);
    expect(total).toBe(1);
    // Cada linha traz usuário, data e hora, operação, registro afetado e detalhe.
    expect(itens[0]).toMatchObject({
      usuarioNome: expect.stringContaining('Usuario Ficticio'),
      ocorridoEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
      operacao: 'INCLUSAO',
      entidade: 'ALUNO',
      registroId: expect.any(String),
      detalhe: expect.any(String),
    });

    const doDiretor = await consultar(`?usuario=${diretor.id}&de=${HOJE}&ate=${HOJE}`);
    expect(doDiretor.itens.map((item) => item.id)).toEqual([inclusaoDaCategoria]);
  });

  it('fluxo FP: por período, o mesmo usuário mostra só o que ocorreu entre as datas, do mais recente ao mais antigo', async () => {
    const soOPassado = await consultar(`?usuario=${operador.id}&de=2025-06-01&ate=2025-06-30`);
    expect(soOPassado.itens.map((item) => item.id)).toEqual([registroAntigo]);

    const tudo = await consultar(`?usuario=${operador.id}&de=2025-06-01&ate=${HOJE}`);
    expect(tudo.itens.map((item) => item.id)).toEqual([inclusaoDoAluno, registroAntigo]);

    const soOntem = await consultar(`?usuario=${operador.id}&de=${ONTEM}&ate=${ONTEM}`);
    expect(soOntem).toEqual({ itens: [], total: 0 });
  });

  it('fluxo FP: a consulta não altera o estado do sistema', async () => {
    const antes = await aplicacao.prisma.registroAuditoria.count();

    await consultar('');
    await consultar(`?usuario=${operador.id}&de=2025-06-01&ate=${HOJE}`);

    expect(await aplicacao.prisma.registroAuditoria.count()).toBe(antes);
  });

  it('fluxo E1: não existe rota que altere ou exclua a trilha, nem para a diretoria [Segurança.NF006]', async () => {
    const original = await aplicacao.prisma.registroAuditoria.findUniqueOrThrow({ where: { id: inclusaoDoAluno } });
    const corpo = { detalhe: 'alterado pelo teste', operacao: 'EXCLUSAO' };
    const umRegistro = `/api/admin/trilha-auditoria/${inclusaoDoAluno}`;
    const aLista = '/api/admin/trilha-auditoria';
    // Funções, e não as requisições já montadas: o supertest abre um servidor por requisição e fecha ao
    // terminar, então cada uma precisa ser criada só na hora de enviar.
    const tentativas = [
      () => aplicacao.http().put(umRegistro).set('Cookie', cookieDiretor).send(corpo),
      () => aplicacao.http().patch(umRegistro).set('Cookie', cookieDiretor).send(corpo),
      () => aplicacao.http().delete(umRegistro).set('Cookie', cookieDiretor),
      () => aplicacao.http().put(aLista).set('Cookie', cookieDiretor).send(corpo),
      () => aplicacao.http().patch(aLista).set('Cookie', cookieDiretor).send(corpo),
      () => aplicacao.http().delete(aLista).set('Cookie', cookieDiretor),
    ];

    const situacoes: number[] = [];
    for (const tentativa of tentativas) situacoes.push((await tentativa()).status);

    expect(situacoes).toEqual([404, 404, 404, 404, 404, 404]);
    expect(await aplicacao.prisma.registroAuditoria.findUniqueOrThrow({ where: { id: inclusaoDoAluno } })).toEqual(original);
  });

  it('fluxo E1: o próprio banco recusa UPDATE, DELETE e TRUNCATE na trilha [Segurança.NF006]', async () => {
    // Cada comando roda numa transação que é sempre desfeita no fim: se o banco aceitasse (um defeito),
    // a trilha dos outros arquivos não seria apagada. Devolve a mensagem de erro do banco.
    async function tentarNoBanco(sql: string, ...parametros: string[]): Promise<string> {
      try {
        await aplicacao.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(sql, ...parametros);
          throw new Error('O banco ACEITOU o comando na trilha.');
        });
      } catch (erro) {
        return erro instanceof Error ? erro.message : String(erro);
      }
      return '';
    }
    const original = await aplicacao.prisma.registroAuditoria.findUniqueOrThrow({ where: { id: registroAntigo } });

    const update = await tentarNoBanco('UPDATE "registros_auditoria" SET "detalhe" = $1 WHERE "id" = $2::uuid', 'alterado', registroAntigo);
    const remocao = await tentarNoBanco('DELETE FROM "registros_auditoria" WHERE "id" = $1::uuid', registroAntigo);
    const truncate = await tentarNoBanco('TRUNCATE "registros_auditoria"');

    expect(update).toContain('só de inclusão');
    expect(remocao).toContain('só de inclusão');
    expect(truncate).toContain('só de inclusão');
    expect(await aplicacao.prisma.registroAuditoria.findUniqueOrThrow({ where: { id: registroAntigo } })).toEqual(original);
  });
});

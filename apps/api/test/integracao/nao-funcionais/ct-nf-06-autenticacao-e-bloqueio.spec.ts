// CT-NF-06 (integração, partição de equivalência e valor-limite), com banco real e pelas rotas HTTP:
// - rota sem sessão (ou com sessão forjada) devolve 401 [Segurança.NF001];
// - a senha fica guardada só como resumo com sal (argon2id) [Segurança.NF005];
// - quatro falhas de login não bloqueiam; cinco bloqueiam, e o bloqueio fica na trilha [Segurança.NF007].
import { criarHashDaSenha } from '../../../src/compartilhado/autenticacao/senha.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarUsuario } from '../../apoio/cenario.js';

describe('[Segurança.NF001] [Segurança.NF005] [Segurança.NF007] CT-NF-06 autenticação, senha e bloqueio', () => {
  let aplicacao: AplicacaoDeTeste;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  async function tentarLogin(usuario: UsuarioDeTeste, senha: string): Promise<number> {
    const resposta = await aplicacao.http().post('/api/auth/login').send({ email: usuario.email, senha });
    return resposta.status;
  }

  it.each(['/api/alunos', '/api/cobrancas', '/api/movimentacoes', '/api/indicadores/resumo', '/api/admin/usuarios', '/api/auth/sessao'])(
    'sem sessão, %s devolve 401',
    async (rota) => {
      expect((await aplicacao.http().get(rota)).status).toBe(401);
    },
  );

  it('com um cookie de sessão forjado também devolve 401', async () => {
    const resposta = await aplicacao.http().get('/api/alunos').set('Cookie', `integracasd_sessao=${'a'.repeat(64)}`);
    expect(resposta.status).toBe(401);
  });

  it('a senha fica só como resumo argon2id com sal: a mesma senha gera resumos diferentes e nenhum contém a senha', async () => {
    const primeiro = await criarUsuario(aplicacao.prisma);
    const segundo = await criarUsuario(aplicacao.prisma);
    // Dá ao segundo a mesma senha do primeiro, pela mesma função que o sistema usa.
    await aplicacao.prisma.usuario.update({ where: { id: segundo.id }, data: { senhaHash: await criarHashDaSenha(primeiro.senha) } });

    const guardados = await aplicacao.prisma.usuario.findMany({ where: { id: { in: [primeiro.id, segundo.id] } }, select: { senhaHash: true } });
    // Formato do projeto (senha.ts): argon2id$v=19$<parâmetros>$<sal>$<resumo>.
    const partes = guardados.map(({ senhaHash }) => senhaHash.split('$'));
    expect(partes.every((parte) => parte.length === 5 && parte[0] === 'argon2id')).toBe(true);
    // Sal aleatório: a mesma senha, sal diferente, resumo diferente.
    expect(partes[0][3]).not.toBe(partes[1][3]);
    expect(guardados[0].senhaHash).not.toBe(guardados[1].senhaHash);
    expect(guardados.some(({ senhaHash }) => senhaHash.includes(primeiro.senha))).toBe(false);
    // E a senha continua valendo para os dois: o resumo é verificável, não reversível.
    expect(await tentarLogin(primeiro, primeiro.senha)).toBe(200);
    expect(await tentarLogin({ ...segundo, senha: primeiro.senha }, primeiro.senha)).toBe(200);
  });

  it('quatro senhas erradas não bloqueiam: a senha certa ainda entra e zera o contador', async () => {
    const usuario = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    const respostas = [];
    for (let tentativa = 1; tentativa <= 4; tentativa += 1) respostas.push(await tentarLogin(usuario, 'senha-errada'));

    expect(respostas).toEqual([401, 401, 401, 401]);
    expect(await tentarLogin(usuario, usuario.senha)).toBe(200);
    const depois = await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(depois).toMatchObject({ tentativasFalhas: 0, bloqueadoAte: null });
  });

  it('cinco senhas erradas bloqueiam por 15 minutos, até a senha certa é recusada, e o bloqueio fica na trilha', async () => {
    const usuario = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    const respostas = [];
    for (let tentativa = 1; tentativa <= 5; tentativa += 1) respostas.push(await tentarLogin(usuario, 'senha-errada'));

    expect(respostas).toEqual([401, 401, 401, 401, 401]);
    expect(await tentarLogin(usuario, usuario.senha)).toBe(429);
    const bloqueado = await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const minutos = (bloqueado.bloqueadoAte!.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { registroId: usuario.id, operacao: 'BLOQUEIO_AUTENTICACAO' } });
    expect(trilha).toHaveLength(1);
  });

  it('a sessão de quem entrou funciona até o logout; depois dele, 401', async () => {
    const usuario = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    const cookie = await entrar(aplicacao, usuario.email, usuario.senha);
    expect((await aplicacao.http().get('/api/alunos').set('Cookie', cookie)).status).toBe(200);
    await aplicacao.http().post('/api/auth/logout').set('Cookie', cookie);
    expect((await aplicacao.http().get('/api/alunos').set('Cookie', cookie)).status).toBe(401);
  });
});

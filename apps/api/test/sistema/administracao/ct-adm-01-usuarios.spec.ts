// CT-ADM-01 (sistema, partição de equivalência): usuários e permissões pela API, com banco real.
//
// Partições do perfil de quem chama [Segurança.NF001]:
//   sem sessão      -> 401 em qualquer rota autenticada
//   ADMINISTRATIVO  -> 403 em toda rota de Administração (/api/admin/...); as demais funcionam
//   DIRETORIA       -> acessa a Administração e tudo o que o administrativo acessa (perfis concêntricos)
// Partições do número de diretores ativos (fluxo A1):
//   dois ou mais    -> um diretor pode inativar outro
//   só um           -> rebaixar ou inativar esse último diretor é recusado
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarUsuario, sufixo } from '../../apoio/cenario.js';

type Metodo = 'get' | 'post' | 'put' | 'patch';

describe('[Administração.RF001] CT-ADM-01 usuários e permissões', () => {
  let aplicacao: AplicacaoDeTeste;
  let diretor: UsuarioDeTeste;
  let cookieDiretor: string;
  let administrativo: UsuarioDeTeste;
  let cookieAdministrativo: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    diretor = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    cookieDiretor = await entrar(aplicacao, diretor.email, diretor.senha);
    administrativo = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookieAdministrativo = await entrar(aplicacao, administrativo.email, administrativo.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // Uma requisição com (ou sem) o cookie da sessão.
  function chamar(metodo: Metodo, caminho: string, cookie: string | null, corpo?: object) {
    let requisicao = aplicacao.http()[metodo](caminho);
    if (cookie !== null) requisicao = requisicao.set('Cookie', cookie);
    return corpo === undefined ? requisicao : requisicao.send(corpo);
  }

  it('fluxo FP: a diretoria cria um usuário, que entra com a senha inicial; a inclusão vai para a trilha', async () => {
    const email = `novo.usuario.${sufixo()}@exemplo.com`;
    const senhaInicial = `senha-inicial-${sufixo()}`;

    const resposta = await chamar('post', '/api/admin/usuarios', cookieDiretor, {
      nome: 'Usuario Novo Ficticio',
      email,
      perfil: 'ADMINISTRATIVO',
      senhaInicial,
    });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ email, perfil: 'ADMINISTRATIVO', ativo: true });
    // A senha não volta na resposta, e no banco só existe o hash.
    expect(resposta.text).not.toContain(senhaInicial);
    const gravado = await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: resposta.body.id } });
    expect(gravado).toMatchObject({ email, perfil: 'ADMINISTRATIVO', ativo: true });
    expect(gravado.senhaHash).not.toContain(senhaInicial);

    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'USUARIO', registroId: gravado.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['INCLUSAO', diretor.id]]);

    // O acesso concedido funciona e a lista mostra perfil, situação e último acesso.
    const cookieDoNovo = await entrar(aplicacao, email, senhaInicial);
    await chamar('get', '/api/alunos', cookieDoNovo).expect(200);
    const lista = await chamar('get', '/api/admin/usuarios', cookieDiretor).expect(200);
    const naLista = (lista.body.itens as Array<{ id: string; perfil: string; ativo: boolean; ultimoAcessoEm: string | null }>).find(
      (usuario) => usuario.id === gravado.id,
    );
    expect(naLista).toMatchObject({ perfil: 'ADMINISTRATIVO', ativo: true, ultimoAcessoEm: expect.any(String) });
  });

  // Revisão da spec #57 (defeito D6): o PostgreSQL recusa o \u0000, e a consulta do e-mail (ou a gravação) dava 500.
  it('caractere nulo no nome ou no e-mail: 400 citando o campo, na inclusão e na alteração, sem gravar [Usabilidade.NF002]', async () => {
    const outro = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    const outroAntes = await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: outro.id } });
    const usuariosAntes = await aplicacao.prisma.usuario.count();
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'USUARIO' } });
    const casos = [
      { campo: 'nome', corpo: { nome: 'Usuario\u0000 Ficticio' } },
      { campo: 'e-mail', corpo: { email: `nulo\u0000.${sufixo()}@exemplo.com` } },
    ];

    for (const { campo, corpo } of casos) {
      const novo = { nome: 'Usuario Ficticio', email: `nulo.${sufixo()}@exemplo.com`, perfil: 'ADMINISTRATIVO', senhaInicial: `senha-${sufixo()}`, ...corpo };
      const inclusao = await chamar('post', '/api/admin/usuarios', cookieDiretor, novo);
      expect(inclusao.status, `inclusão com nulo no ${campo}`).toBe(400);
      expect(inclusao.body.message).toContain(campo);

      const alteracao = await chamar('patch', `/api/admin/usuarios/${outro.id}`, cookieDiretor, corpo);
      expect(alteracao.status, `alteração com nulo no ${campo}`).toBe(400);
      expect(alteracao.body.message).toContain(campo);
    }

    expect(await aplicacao.prisma.usuario.count()).toBe(usuariosAntes);
    expect(await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: outro.id } })).toMatchObject({ nome: outroAntes.nome, email: outro.email });
    expect(await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'USUARIO' } })).toBe(trilhaAntes);
  });

  it('partição ADMINISTRATIVO: 403 em todas as rotas de Administração, sem efeito no banco [Segurança.NF001]', async () => {
    const emailTentado = `tentativa.${sufixo()}@exemplo.com`;
    const categoriaTentada = `Categoria tentada ${sufixo()}`;
    // Uma rota de cada aba da Administração, com leituras e escritas.
    const rotas: Array<{ metodo: Metodo; caminho: string; corpo?: object }> = [
      { metodo: 'get', caminho: '/api/admin/usuarios' },
      {
        metodo: 'post',
        caminho: '/api/admin/usuarios',
        corpo: { nome: 'Usuario Tentado', email: emailTentado, perfil: 'DIRETORIA', senhaInicial: 'senha-de-teste-longa' },
      },
      // Tentar promover a si mesmo a diretoria.
      { metodo: 'patch', caminho: `/api/admin/usuarios/${administrativo.id}`, corpo: { perfil: 'DIRETORIA' } },
      { metodo: 'get', caminho: '/api/admin/categorias' },
      { metodo: 'post', caminho: '/api/admin/categorias', corpo: { nome: categoriaTentada, tipo: 'SAIDA' } },
      { metodo: 'get', caminho: '/api/admin/parametros-cobranca' },
      { metodo: 'get', caminho: '/api/admin/integracao-asaas' },
      { metodo: 'put', caminho: '/api/admin/integracao-asaas/chave', corpo: { ambiente: 'SANDBOX', chave: `chave_ficticia_tentada_${sufixo()}${sufixo()}` } },
      { metodo: 'get', caminho: '/api/admin/trilha-auditoria' },
    ];

    const situacoes: string[] = [];
    for (const rota of rotas) {
      const resposta = await chamar(rota.metodo, rota.caminho, cookieAdministrativo, rota.corpo);
      situacoes.push(`${rota.metodo.toUpperCase()} ${rota.caminho} -> ${resposta.status}`);
    }

    expect(situacoes).toEqual(rotas.map((rota) => `${rota.metodo.toUpperCase()} ${rota.caminho} -> 403`));
    // Nada mudou: nem usuário novo, nem promoção, nem categoria.
    expect(await aplicacao.prisma.usuario.count({ where: { email: emailTentado } })).toBe(0);
    expect((await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: administrativo.id } })).perfil).toBe('ADMINISTRATIVO');
    expect(await aplicacao.prisma.categoria.count({ where: { nome: categoriaTentada } })).toBe(0);
    // Fora da Administração, o perfil administrativo trabalha normalmente.
    await chamar('get', '/api/alunos', cookieAdministrativo).expect(200);
    await chamar('get', '/api/movimentacoes', cookieAdministrativo).expect(200);
  });

  it('partição DIRETORIA: acessa a Administração e tudo o que o administrativo acessa [Segurança.NF001]', async () => {
    const rotas = [
      '/api/admin/usuarios',
      '/api/admin/categorias',
      '/api/admin/parametros-cobranca',
      '/api/admin/integracao-asaas',
      '/api/admin/trilha-auditoria',
      '/api/alunos',
      '/api/funcionarios',
      '/api/projetos',
      '/api/movimentacoes',
      '/api/cobrancas',
    ];

    const situacoes: string[] = [];
    for (const caminho of rotas) {
      const resposta = await chamar('get', caminho, cookieDiretor);
      situacoes.push(`${caminho} -> ${resposta.status}`);
    }

    expect(situacoes).toEqual(rotas.map((caminho) => `${caminho} -> 200`));
  });

  it('partição sem sessão: 401 nas rotas de Administração e nas demais [Segurança.NF001]', async () => {
    const rotas = ['/api/admin/usuarios', '/api/admin/trilha-auditoria', '/api/alunos', '/api/movimentacoes'];

    const situacoes: string[] = [];
    for (const caminho of rotas) {
      situacoes.push(`${caminho} -> ${(await chamar('get', caminho, null)).status}`);
    }

    expect(situacoes).toEqual(rotas.map((caminho) => `${caminho} -> 401`));
  });

  it('fluxo FP: rebaixar um diretor vale a partir do próximo acesso', async () => {
    const outro = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    const cookieAntigo = await entrar(aplicacao, outro.email, outro.senha);
    await chamar('get', '/api/admin/usuarios', cookieAntigo).expect(200);

    await chamar('patch', `/api/admin/usuarios/${outro.id}`, cookieDiretor, { perfil: 'ADMINISTRATIVO' }).expect(200);

    // A sessão aberta cai; no novo acesso, o perfil administrativo já não entra na Administração.
    expect((await chamar('get', '/api/admin/usuarios', cookieAntigo)).status).toBe(401);
    const cookieNovo = await entrar(aplicacao, outro.email, outro.senha);
    expect((await chamar('get', '/api/admin/usuarios', cookieNovo)).status).toBe(403);
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'USUARIO', registroId: outro.id } });
    expect(trilha.map((registro) => [registro.operacao, registro.usuarioId])).toEqual([['ALTERACAO', diretor.id]]);
  });

  it('fluxo A1: com dois diretores ativos um inativa o outro; o último diretor ativo não pode ser rebaixado nem inativado', async () => {
    const segundo = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    // A regra conta os diretores ativos do banco inteiro, e o banco é compartilhado com os outros arquivos.
    // Para montar a partição "só um diretor", os outros diretores ativos são inativados aqui, direto no
    // banco, e voltam no `finally`, do jeito que estavam.
    const outros = await aplicacao.prisma.usuario.findMany({
      where: { perfil: 'DIRETORIA', ativo: true, id: { notIn: [diretor.id, segundo.id] } },
      select: { id: true },
    });
    const idsDosOutros = outros.map((usuario) => usuario.id);
    await aplicacao.prisma.usuario.updateMany({ where: { id: { in: idsDosOutros } }, data: { ativo: false } });
    try {
      // Partição "dois diretores ativos": o diretor inativa o segundo, e continua sendo diretor.
      const inativacao = await chamar('patch', `/api/admin/usuarios/${segundo.id}`, cookieDiretor, { ativo: false });
      expect(inativacao.status).toBe(200);
      expect((await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: segundo.id } })).ativo).toBe(false);

      // Partição "só um diretor ativo": ele mesmo.
      expect(await aplicacao.prisma.usuario.count({ where: { perfil: 'DIRETORIA', ativo: true } })).toBe(1);
      const trilhaAntes = await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'USUARIO', registroId: diretor.id } });

      const rebaixar = await chamar('patch', `/api/admin/usuarios/${diretor.id}`, cookieDiretor, { perfil: 'ADMINISTRATIVO' });
      expect(rebaixar.status).toBe(400);
      expect(rebaixar.body.message).toContain('Mantenha ao menos um usuario de diretoria ativo');

      // Inativar a si mesmo também é recusado (aqui pesa primeiro o fluxo E1, autoinativação).
      const inativarASiMesmo = await chamar('patch', `/api/admin/usuarios/${diretor.id}`, cookieDiretor, { ativo: false });
      expect(inativarASiMesmo.status).toBe(400);

      // O último diretor continua diretor e ativo, e nada foi para a trilha.
      expect(await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: diretor.id } })).toMatchObject({
        perfil: 'DIRETORIA',
        ativo: true,
      });
      expect(await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'USUARIO', registroId: diretor.id } })).toBe(trilhaAntes);
    } finally {
      await aplicacao.prisma.usuario.updateMany({ where: { id: { in: idsDosOutros } }, data: { ativo: true } });
    }
  });
});

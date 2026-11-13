// CT-ADM-04 (integração, caixa cinza): substituição da chave do Asaas pela rota HTTP, com banco real.
// O Asaas é o dublê da aplicação de teste: ele anota cada chave testada e recusa as de `chavesRecusadas`.
//
// O que se confere:
//   FP  a chave nova é testada no Asaas ANTES de ser guardada, e é guardada cifrada (nunca em texto puro);
//   E1  se o teste falha (chave recusada ou Asaas fora do ar), a chave vigente continua a mesma;
//   E2  nenhuma resposta da API, nenhuma linha da trilha e nenhum log contém a chave [Segurança.NF003].
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type UsuarioDeTeste, criarUsuario, sufixo } from '../../apoio/cenario.js';
import { chaveMestraDoAmbiente, decifrar } from '../../../src/compartilhado/seguranca/cifra.js';

// Chave fictícia no formato que a API aceita (20 caracteres ou mais, sem espaços). Sem o prefixo das chaves
// reais do Asaas de propósito: a regra B11 barra esse prefixo em qualquer arquivo versionado.
function chaveFicticia(): string {
  return `chave_ficticia_teste_${sufixo()}${sufixo()}${sufixo()}`;
}

describe('[Administração.RF004] CT-ADM-04 chave de acesso do Asaas', () => {
  let aplicacao: AplicacaoDeTeste;
  let diretor: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    diretor = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    cookie = await entrar(aplicacao, diretor.email, diretor.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // Se um teste falhar no meio, o Asaas falso não fica "fora do ar" para os seguintes.
  afterEach(() => {
    aplicacao.asaas.indisponivel = false;
  });

  function substituirChave(chave: string, ambiente: 'SANDBOX' | 'PRODUCAO' = 'SANDBOX') {
    return aplicacao.http().put('/api/admin/integracao-asaas/chave').set('Cookie', cookie).send({ ambiente, chave, prazoAlertaHoras: 24 });
  }

  // A configuração vigente é a linha mais recente (uma linha por alteração).
  function vigente() {
    return aplicacao.prisma.configuracaoAsaas.findFirstOrThrow({ orderBy: { dataCriacao: 'desc' } });
  }

  it('fluxo FP: a chave nova é testada no Asaas antes de ser guardada, e é guardada cifrada', async () => {
    const chave = chaveFicticia();
    const testadasAntes = aplicacao.asaas.credenciaisTestadas.length;

    const resposta = await substituirChave(chave);

    expect(resposta.status).toBe(204);
    // Foi testada no Asaas, com o ambiente escolhido.
    expect(aplicacao.asaas.credenciaisTestadas.slice(testadasAntes)).toEqual([{ ambiente: 'SANDBOX', chaveApi: chave }]);

    // Caixa cinza: a linha nova guarda a chave cifrada. O texto puro não aparece em coluna nenhuma, e só a
    // CHAVE_DE_CIFRAGEM do ambiente devolve a chave original.
    const guardada = await vigente();
    expect(guardada).toMatchObject({ ambiente: 'SANDBOX', prazoAlertaHoras: 24, alteradoPorId: diretor.id });
    expect(JSON.stringify(guardada)).not.toContain(chave);
    expect(decifrar(guardada.chaveCifrada, chaveMestraDoAmbiente())).toBe(chave);

    // A troca vai para a trilha, sem a chave.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'CONFIGURACAO', registroId: guardada.id } });
    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({ operacao: 'ALTERACAO', usuarioId: diretor.id });
    expect(trilha[0].detalhe).not.toContain(chave);

    // A situação da integração passa a mostrar a chave da tela em uso.
    const situacao = await aplicacao.http().get('/api/admin/integracao-asaas').set('Cookie', cookie).expect(200);
    expect(situacao.body).toMatchObject({ ambiente: 'SANDBOX', conectada: true, origemDaChave: 'TELA', prazoAlertaHoras: 24 });
  });

  it.each([
    { falha: 'a chave é recusada pelo Asaas', foraDoAr: false },
    { falha: 'o Asaas está fora do ar', foraDoAr: true },
  ])('fluxo E1: quando $falha, a chave não é salva e a vigente continua valendo', async ({ foraDoAr }) => {
    // Uma chave boa em uso antes da tentativa.
    const chaveVigente = chaveFicticia();
    await substituirChave(chaveVigente).expect(204);
    const antes = await vigente();
    const linhasAntes = await aplicacao.prisma.configuracaoAsaas.count();
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'CONFIGURACAO' } });

    const chaveNova = chaveFicticia();
    aplicacao.asaas.chavesRecusadas.add(chaveNova);
    aplicacao.asaas.indisponivel = foraDoAr;
    const resposta = await substituirChave(chaveNova, 'PRODUCAO');
    aplicacao.asaas.indisponivel = false;

    // Informa a falha, sem repetir a chave na mensagem.
    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('A chave não foi salva');
    expect(resposta.body.message).toContain('A chave anterior continua valendo');
    expect(resposta.text).not.toContain(chaveNova);

    // Banco: nenhuma linha nova; a vigente é a mesma, no mesmo ambiente, com a mesma chave; nada na trilha.
    expect(await aplicacao.prisma.configuracaoAsaas.count()).toBe(linhasAntes);
    const depois = await vigente();
    expect(depois.id).toBe(antes.id);
    expect(depois.ambiente).toBe('SANDBOX');
    expect(decifrar(depois.chaveCifrada, chaveMestraDoAmbiente())).toBe(chaveVigente);
    expect(await aplicacao.prisma.registroAuditoria.count({ where: { entidade: 'CONFIGURACAO' } })).toBe(trilhaAntes);
  });

  it('fluxo E2: nenhuma resposta da API, linha da trilha ou log contém a chave [Segurança.NF003]', async () => {
    const chaveBoa = chaveFicticia();
    const chaveRecusada = chaveFicticia();
    aplicacao.asaas.chavesRecusadas.add(chaveRecusada);
    // Tudo o que a aplicação escrever no terminal (logs do Nest) enquanto a chave circula.
    const saida = vi.spyOn(process.stdout, 'write');
    const erros = vi.spyOn(process.stderr, 'write');

    // Todas as rotas que tocam na integração: as que recebem a chave e as que mostram a situação.
    const respostas = [
      await substituirChave(chaveBoa),
      await substituirChave(chaveRecusada),
      await aplicacao.http().put('/api/admin/integracao-asaas/prazo-alerta').set('Cookie', cookie).send({ prazoAlertaHoras: 48 }),
      await aplicacao.http().get('/api/admin/integracao-asaas').set('Cookie', cookie),
      await aplicacao.http().get('/api/integracao/ambiente').set('Cookie', cookie),
      await aplicacao.http().get('/api/admin/trilha-auditoria?entidade=CONFIGURACAO').set('Cookie', cookie),
    ];
    const logs = [...saida.mock.calls, ...erros.mock.calls].map((chamada) => String(chamada[0])).join('\n');
    saida.mockRestore();
    erros.mockRestore();

    expect(respostas.map((resposta) => resposta.status)).toEqual([204, 400, 204, 200, 200, 200]);
    for (const resposta of respostas) {
      const textoCompleto = `${resposta.text}\n${JSON.stringify(resposta.headers)}`;
      expect(textoCompleto).not.toContain(chaveBoa);
      expect(textoCompleto).not.toContain(chaveRecusada);
    }
    // A situação da integração não tem campo de chave, nem cifrada.
    expect(Object.keys(respostas[3].body)).not.toContain('chave');
    expect(Object.keys(respostas[3].body)).not.toContain('chaveCifrada');
    expect(respostas[3].text).not.toContain((await vigente()).chaveCifrada);

    // A trilha, lida direto do banco, também não tem a chave em linha nenhuma.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { entidade: 'CONFIGURACAO' } });
    expect(trilha.length).toBeGreaterThan(0);
    for (const registro of trilha) {
      expect(registro.detalhe).not.toContain(chaveBoa);
      expect(registro.detalhe).not.toContain(chaveRecusada);
    }
    expect(logs).not.toContain(chaveBoa);
    expect(logs).not.toContain(chaveRecusada);
  });
});

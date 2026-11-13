// CT-COB-08 (sistema, caso de uso): consultar cobranças pela API, como a tela "Cobranças" faz.
// O cenário é montado pelas rotas reais (registro manual, cancelamento, sincronização), e a consulta é
// conferida só pela resposta HTTP, mais uma olhada no banco para provar que a consulta não muda nada.
//
// O banco é compartilhado: a lista sem filtro traz cobranças de outros testes. Nessa consulta o teste confere
// as regras (só abertas e vencidas, por vencimento, total igual ao do banco); nas filtradas por aluno, que só
// têm as cobranças deste teste, confere a lista exata.
import { deDia } from '../../../src/compartilhado/datas.js';
import type { Aluno, Cobranca } from '../../../src/generated/prisma/client.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { criarAluno, criarCobrancaAberta, criarUsuario, definirParametros, diaDeHojeMais } from '../../apoio/cenario.js';
import { cancelarCobranca, pagarNoAsaasESincronizar, registrarPagamentoManual } from '../../integracao/cobrancas/apoio-de-cobrancas.js';

// Um item da lista, como a API devolve (GET /api/cobrancas).
type ItemDaLista = {
  id: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  situacao: string;
  diasDeAtraso: number | null;
};

const TODAS_AS_SITUACOES = 'ABERTA,VENCIDA,PAGA,PAGA_COM_REGISTRO_MANUAL,CANCELADA,ESTORNADA';

describe('[Cobranças.RF008] CT-COB-08 consulta de cobranças pela API', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;
  let alunoA: Aluno;
  let alunoB: Aluno;
  // As cobranças do aluno A, uma em cada situação, com vencimentos diferentes.
  let vencida: Cobranca;
  let abertaCedo: Cobranca;
  let abertaTarde: Cobranca;
  let pagaAMao: Cobranca;
  let cancelada: Cobranca;
  let paga: Cobranca;

  async function consultar(filtros: Record<string, string | number>): Promise<{ itens: ItemDaLista[]; total: number }> {
    const resposta = await aplicacao.http().get('/api/cobrancas').query(filtros).set('Cookie', cookie);
    expect(resposta.status).toBe(200);
    return resposta.body as { itens: ItemDaLista[]; total: number };
  }

  // "AAAA-MM-DD" ordena como texto na mesma ordem das datas.
  function emOrdemDeVencimento(itens: ItemDaLista[]): boolean {
    const vencimentos = itens.map((item) => item.vencimento);
    return vencimentos.every((vencimento, posicao) => posicao === 0 || vencimentos[posicao - 1] <= vencimento);
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    await definirParametros(aplicacao.prisma, diretor.id);
    const atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);

    alunoA = await criarAluno(aplicacao.prisma);
    alunoB = await criarAluno(aplicacao.prisma);
    const nova = (aluno: Aluno, vencimento: string) =>
      criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, vencimento });

    // A ordem de criação é diferente da ordem de vencimento, para a ordenação não acertar por acaso.
    abertaTarde = await nova(alunoA, diaDeHojeMais(40));
    vencida = await nova(alunoA, diaDeHojeMais(-20));
    abertaCedo = await nova(alunoA, diaDeHojeMais(5));
    pagaAMao = await nova(alunoA, diaDeHojeMais(10));
    cancelada = await nova(alunoA, diaDeHojeMais(15));
    paga = await nova(alunoA, diaDeHojeMais(20));
    // Do outro aluno: não pode aparecer quando o filtro é o aluno A.
    await nova(alunoB, diaDeHojeMais(5));

    await registrarPagamentoManual(aplicacao, cookie, pagaAMao.id);
    await cancelarCobranca(aplicacao, cookie, cancelada.id);
    await pagarNoAsaasESincronizar(aplicacao, aplicacao.asaas, cookie, paga);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it('FP: sem nenhum filtro, mostra só as abertas e as vencidas, ordenadas por vencimento, e não altera nada', async () => {
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count();

    const lista = await consultar({});

    expect(lista.itens.length).toBeGreaterThan(0);
    expect(lista.itens.every((item) => item.situacao === 'ABERTA' || item.situacao === 'VENCIDA')).toBe(true);
    expect(emOrdemDeVencimento(lista.itens)).toBe(true);
    // O total conta todas as páginas: todas as cobranças em aberto do banco (vencidas ou não), e só elas.
    expect(lista.total).toBe(await aplicacao.prisma.cobranca.count({ where: { situacao: 'ABERTA' } }));
    // Consultar não é alteração: nada entra na trilha.
    expect(await aplicacao.prisma.registroAuditoria.count()).toBe(trilhaAntes);
  });

  it('FP: filtro por aluno, sem escolher a situação: só as abertas e vencidas dele, por vencimento, com os dias de atraso', async () => {
    const lista = await consultar({ alunoId: alunoA.id });

    expect(lista.total).toBe(3);
    expect(lista.itens.map((item) => item.id)).toEqual([vencida.id, abertaCedo.id, abertaTarde.id]);
    expect(lista.itens.map((item) => item.situacao)).toEqual(['VENCIDA', 'ABERTA', 'ABERTA']);
    expect(lista.itens.map((item) => item.diasDeAtraso)).toEqual([20, null, null]);
    expect(lista.itens[0]).toMatchObject({
      alunoId: alunoA.id,
      alunoNome: alunoA.nome,
      descricao: vencida.descricao,
      valorCentavos: vencida.valorCentavos,
      vencimento: diaDeHojeMais(-20),
    });
  });

  it('FP: filtro por aluno e situação: cada situação escolhida traz só as cobranças nela', async () => {
    const encerradas = await consultar({ alunoId: alunoA.id, situacoes: 'PAGA,PAGA_COM_REGISTRO_MANUAL,CANCELADA' });
    expect(encerradas.itens.map((item) => [item.id, item.situacao])).toEqual([
      [pagaAMao.id, 'PAGA_COM_REGISTRO_MANUAL'],
      [cancelada.id, 'CANCELADA'],
      [paga.id, 'PAGA'],
    ]);

    const soVencidas = await consultar({ alunoId: alunoA.id, situacoes: 'VENCIDA' });
    expect(soVencidas.itens.map((item) => item.id)).toEqual([vencida.id]);

    const todas = await consultar({ alunoId: alunoA.id, situacoes: TODAS_AS_SITUACOES });
    expect(todas.total).toBe(6);
    expect(emOrdemDeVencimento(todas.itens)).toBe(true);
  });

  it('FP: filtro só por situação: todas as cobranças do banco nessa situação, e nenhuma outra', async () => {
    const canceladas = await consultar({ situacoes: 'CANCELADA', tamanhoPagina: 200 });

    expect(canceladas.itens.every((item) => item.situacao === 'CANCELADA')).toBe(true);
    expect(canceladas.total).toBe(await aplicacao.prisma.cobranca.count({ where: { situacao: 'CANCELADA' } }));
    if (canceladas.total <= 200) expect(canceladas.itens.map((item) => item.id)).toContain(cancelada.id);
  });

  it('FP: filtro por período de vencimento, com os dois limites incluídos', async () => {
    const doAluno = await consultar({
      alunoId: alunoA.id,
      situacoes: TODAS_AS_SITUACOES,
      vencimentoDe: diaDeHojeMais(5),
      vencimentoAte: diaDeHojeMais(15),
    });
    expect(doAluno.itens.map((item) => item.id)).toEqual([abertaCedo.id, pagaAMao.id, cancelada.id]);

    // Só o período (e a situação padrão): de qualquer aluno, sempre dentro do período.
    const dia = diaDeHojeMais(5);
    const doPeriodo = await consultar({ vencimentoDe: dia, vencimentoAte: dia, tamanhoPagina: 200 });
    expect(doPeriodo.itens.every((item) => item.vencimento === dia)).toBe(true);
    expect(doPeriodo.total).toBe(await aplicacao.prisma.cobranca.count({ where: { situacao: 'ABERTA', vencimento: deDia(dia) } }));
    if (doPeriodo.total <= 200) {
      expect(doPeriodo.itens.map((item) => item.alunoId)).toEqual(expect.arrayContaining([alunoA.id, alunoB.id]));
    }
  });
});

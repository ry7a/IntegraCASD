// CT-COB-07 (integração, caixa cinza): sincronização das cobranças de um período com o Asaas, pela rota HTTP,
// com banco real. O teste muda a situação das cobranças no Asaas falso (como se o aluno tivesse pago e o
// aviso do webhook não tivesse chegado), pede a sincronização e confere no banco o que mudou e o que não mudou.
//
// O período é um único dia, longe de hoje, que nenhum outro arquivo usa: a sincronização confere TODAS as
// cobranças do período, e as de outros testes não estão neste Asaas falso.
import { deDia } from '../../../src/compartilhado/datas.js';
import type { Cobranca } from '../../../src/generated/prisma/client.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  type ParametrosDeTeste,
  type UsuarioDeTeste,
  criarAluno,
  criarCobrancaAberta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
} from '../../apoio/cenario.js';
import { JUSTIFICATIVA_DE_TESTE, registrarPagamentoManual } from './apoio-de-cobrancas.js';

const DIA_DO_PERIODO = diaDeHojeMais(333);

describe('[Cobranças.RF007] CT-COB-07 sincronização com o Asaas', () => {
  let aplicacao: AplicacaoDeTeste;
  let parametros: ParametrosDeTeste;
  let atendente: UsuarioDeTeste;
  let cookie: string;

  // As três cobranças do período, uma para cada situação do cenário.
  let pagaNoAsaas: Cobranca;
  let aindaPendente: Cobranca;
  let pagaAMaoEPagaNoAsaas: Cobranca;
  // A resposta da sincronização e o estado depois dela.
  let resposta: { status: number; body: Record<string, unknown> };

  // Diz no Asaas falso que a cobrança foi recebida hoje.
  function receberNoAsaas(cobranca: Cobranca) {
    const noAsaas = aplicacao.asaas.noAsaas.get(cobranca.idAsaas!)!;
    aplicacao.asaas.noAsaas.set(cobranca.idAsaas!, { ...noAsaas, situacao: 'RECEIVED', pagoEm: diaDeHojeMais(0), disponivelEm: diaDeHojeMais(0) });
  }

  function entradasDaCobranca(cobranca: Cobranca) {
    // A descrição de toda entrada de cobrança traz o id do Asaas dela.
    return aplicacao.prisma.movimentacao.findMany({ where: { descricao: { contains: cobranca.idAsaas! } } });
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    parametros = await definirParametros(aplicacao.prisma, diretor.id);
    atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);

    const novaCobranca = async (origem: 'AVULSA' | 'MENSALIDADE') => {
      const aluno = await criarAluno(aplicacao.prisma);
      return criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, origem, vencimento: DIA_DO_PERIODO });
    };
    // Paga no Asaas, aberta aqui: o aviso do webhook se perdeu.
    pagaNoAsaas = await novaCobranca('MENSALIDADE');
    receberNoAsaas(pagaNoAsaas);
    // Pendente lá e aberta aqui: nada a mudar.
    aindaPendente = await novaCobranca('AVULSA');
    // Paga à mão aqui (Pix direto na conta do CASD) e, depois, paga também no Asaas (fluxo A4).
    pagaAMaoEPagaNoAsaas = await novaCobranca('AVULSA');
    await registrarPagamentoManual(aplicacao, cookie, pagaAMaoEPagaNoAsaas.id);
    receberNoAsaas(pagaAMaoEPagaNoAsaas);

    // As contagens da resposta valem para o período inteiro: confere que ele só tem as cobranças deste teste.
    const minhas = [pagaNoAsaas.id, aindaPendente.id, pagaAMaoEPagaNoAsaas.id];
    const outrasNoPeriodo = await aplicacao.prisma.cobranca.count({
      where: { vencimento: deDia(DIA_DO_PERIODO), id: { notIn: minhas } },
    });
    if (outrasNoPeriodo > 0) throw new Error(`O dia ${DIA_DO_PERIODO} tem cobranças de outro teste; escolha outro dia.`);

    // A área administrativa pede a sincronização do período na lista de cobranças.
    const respostaHttp = await aplicacao
      .http()
      .post('/api/cobrancas/sincronizar')
      .set('Cookie', cookie)
      .send({ vencimentoDe: DIA_DO_PERIODO, vencimentoAte: DIA_DO_PERIODO });
    resposta = { status: respostaHttp.status, body: respostaHttp.body as Record<string, unknown> };
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it('FP: adota a situação do Asaas (recebida lá vira Paga aqui) e cria a entrada que faltava', async () => {
    expect(resposta.status).toBe(200);

    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: pagaNoAsaas.id }, include: { movimentacao: true } });
    expect(paga.situacao).toBe('PAGA');
    expect(paga.pagaEm).toEqual(deDia(diaDeHojeMais(0)));
    expect(paga.movimentacao).toMatchObject({
      tipo: 'ENTRADA',
      origem: 'CONCILIACAO_AUTOMATICA',
      formaPagamento: 'ASAAS',
      valorCentavos: pagaNoAsaas.valorCentavos,
      contaId: parametros.contaId,
      // Mensalidade: categoria de mensalidade dos parâmetros.
      categoriaId: parametros.categoriaMensalidadeId,
      // Pedida por alguém na tela: a entrada leva o autor.
      registradaPorId: atendente.id,
    });
    expect(await entradasDaCobranca(pagaNoAsaas)).toHaveLength(1);
    // A trilha diz de onde veio a informação.
    const trilha = await aplicacao.prisma.registroAuditoria.findMany({ where: { registroId: pagaNoAsaas.id } });
    expect(trilha).toEqual([
      expect.objectContaining({ operacao: 'ALTERACAO', usuarioId: atendente.id, detalhe: expect.stringContaining('sincronização com o Asaas') }),
    ]);
  });

  it('FP: cobrança sem divergência (pendente lá, aberta aqui) não muda nem ganha entrada, mas fica marcada como conferida', async () => {
    const conferida = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: aindaPendente.id } });
    expect(conferida.situacao).toBe('ABERTA');
    expect(conferida.movimentacaoId).toBeNull();
    expect(await entradasDaCobranca(aindaPendente)).toHaveLength(0);
    expect(conferida.sincronizadaEm).toBeInstanceOf(Date);
  });

  it('A4: cobrança Paga com registro manual não é sobrescrita: vai para a fila de pendências, sem segunda entrada', async () => {
    const depois = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: pagaAMaoEPagaNoAsaas.id } });
    expect(depois.situacao).toBe('PAGA_COM_REGISTRO_MANUAL');
    expect(depois.justificativaManual).toBe(JUSTIFICATIVA_DE_TESTE);
    // Só a entrada do registro manual: a sincronização não criou outra.
    const entradas = await entradasDaCobranca(pagaAMaoEPagaNoAsaas);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].origem).toBe('REGISTRO_MANUAL_DE_COBRANCA');
    // A divergência é apresentada para conferência humana.
    const pendencias = await aplicacao.prisma.pendenciaConciliacao.findMany({ where: { cobrancaId: pagaAMaoEPagaNoAsaas.id } });
    expect(pendencias).toEqual([
      expect.objectContaining({ tipo: 'APOS_REGISTRO_MANUAL', origem: 'SINCRONIZACAO', idAsaas: pagaAMaoEPagaNoAsaas.idAsaas, resolvidaEm: null }),
    ]);
  });

  // Revisão da spec #57 (defeito D6): o PostgreSQL recusa o \u0000 e a gravação da resolução dava 500.
  it('a resolução da pendência com caractere nulo é recusada com 400 citando a resolução, e a pendência continua aberta', async () => {
    const pendencia = await aplicacao.prisma.pendenciaConciliacao.findFirstOrThrow({ where: { cobrancaId: pagaAMaoEPagaNoAsaas.id } });

    const recusa = await aplicacao
      .http()
      .post(`/api/cobrancas/conciliacao/pendencias/${pendencia.id}/resolver`)
      .set('Cookie', cookie)
      .send({ resolucao: 'Conferido\u0000 com o Asaas (teste)' });

    expect(recusa.status).toBe(400);
    expect(recusa.body.message).toContain('resolução');
    const depois = await aplicacao.prisma.pendenciaConciliacao.findUniqueOrThrow({ where: { id: pendencia.id } });
    expect(depois).toMatchObject({ resolvidaEm: null, resolucao: null });
  });

  it('[Confiabilidade.NF007] a execução fica registrada com início, fim, autor e o resumo do que mudou, que a resposta também mostra', async () => {
    const resumoEsperado = { conferidas: 3, atualizadas: 1, somenteNoAsaas: 0, naoIdentificadas: 0, paraConferir: 1, falha: null };
    expect(resposta.body).toMatchObject(resumoEsperado);

    const execucoes = await aplicacao.prisma.execucaoSincronizacao.findMany({ where: { pedidaPorId: atendente.id } });
    expect(execucoes).toHaveLength(1);
    const execucao = execucoes[0];
    expect(execucao).toMatchObject({
      ...resumoEsperado,
      origem: 'MANUAL',
      vencimentoDe: deDia(DIA_DO_PERIODO),
      vencimentoAte: deDia(DIA_DO_PERIODO),
      cobrancaId: null,
    });
    expect(execucao.finalizadaEm).not.toBeNull();
    expect(execucao.finalizadaEm!.getTime()).toBeGreaterThanOrEqual(execucao.iniciadaEm.getTime());
    expect(resposta.body.iniciadaEm).toBe(execucao.iniciadaEm.toISOString());
    expect(resposta.body.finalizadaEm).toBe(execucao.finalizadaEm!.toISOString());
  });
});

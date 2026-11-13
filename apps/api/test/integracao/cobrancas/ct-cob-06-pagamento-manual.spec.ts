// CT-COB-06 (integração, caixa cinza): registrar manualmente o pagamento de uma cobrança pela rota HTTP,
// com banco real. Confere no banco os três efeitos que precisam andar juntos: a cobrança "Paga com registro
// manual", a movimentação de entrada (na conta e na categoria dos parâmetros) e a trilha com a justificativa.
// A prova de que uma falha no meio desfaz tudo (falha injetada no banco) está no CT-NF-02.
//
// Transições: Aberta e Vencida aceitam o registro; Cancelada e Paga com registro manual são tentadas e recusadas.
import type { Cobranca } from '../../../src/generated/prisma/client.js';
import { deDia } from '../../../src/compartilhado/datas.js';
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
import { JUSTIFICATIVA_DE_TESTE, cancelarCobranca, registrarPagamentoManual } from './apoio-de-cobrancas.js';

describe('[Cobranças.RF006] CT-COB-06 registro manual de pagamento', () => {
  let aplicacao: AplicacaoDeTeste;
  let parametros: ParametrosDeTeste;
  let atendente: UsuarioDeTeste;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    parametros = await definirParametros(aplicacao.prisma, diretor.id);
    atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  async function cobrancaAberta(dados: { origem?: 'AVULSA' | 'MENSALIDADE'; vencimento?: string } = {}): Promise<Cobranca> {
    const aluno = await criarAluno(aplicacao.prisma);
    return criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, ...dados });
  }

  function registrar(cobrancaId: string, corpo: Record<string, unknown>) {
    return aplicacao.http().post(`/api/cobrancas/${cobrancaId}/pagamento-manual`).set('Cookie', cookie).send(corpo);
  }

  // Entradas de dinheiro ligadas a esta cobrança: a descrição da movimentação traz o id do Asaas dela.
  function entradasDaCobranca(cobranca: Cobranca) {
    return aplicacao.prisma.movimentacao.findMany({ where: { descricao: { contains: cobranca.idAsaas! } } });
  }

  // Nada mudou: mesma situação, sem pagamento, sem entrada e sem nada novo na trilha da cobrança.
  async function conferirQueNadaMudou(antes: Cobranca, registrosNaTrilhaAntes: number) {
    const depois = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: antes.id } });
    expect(depois.situacao).toBe(antes.situacao);
    expect(depois.pagaEm).toEqual(antes.pagaEm);
    expect(depois.movimentacaoId).toBe(antes.movimentacaoId);
    expect(depois.justificativaManual).toBe(antes.justificativaManual);
    expect(await aplicacao.prisma.registroAuditoria.count({ where: { registroId: antes.id } })).toBe(registrosNaTrilhaAntes);
  }

  it('FP: cobrança Aberta fica Paga com registro manual e a entrada vai para a conta e a categoria dos parâmetros, na mesma operação [Confiabilidade.NF004]', async () => {
    const cobranca = await cobrancaAberta({ origem: 'AVULSA' });
    const hoje = diaDeHojeMais(0);

    const resposta = await registrar(cobranca.id, {
      pagoEm: hoje,
      valorCentavos: 8500,
      formaPagamento: 'PIX',
      justificativa: JUSTIFICATIVA_DE_TESTE,
    });

    expect(resposta.status).toBe(204);
    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id }, include: { movimentacao: true } });
    expect(paga).toMatchObject({
      situacao: 'PAGA_COM_REGISTRO_MANUAL',
      pagaEm: deDia(hoje),
      justificativaManual: JUSTIFICATIVA_DE_TESTE,
    });
    // A entrada criada é a que a cobrança aponta, com os dados do pagamento e o destino dos parâmetros.
    expect(paga.movimentacao).toMatchObject({
      tipo: 'ENTRADA',
      origem: 'REGISTRO_MANUAL_DE_COBRANCA',
      valorCentavos: 8500,
      data: deDia(hoje),
      formaPagamento: 'PIX',
      contaId: parametros.contaId,
      categoriaId: parametros.categoriaAvulsaId,
      registradaPorId: atendente.id,
    });
    expect(await entradasDaCobranca(cobranca)).toHaveLength(1);

    // A trilha guarda a justificativa e o autor, da cobrança e da entrada.
    const trilhaDaCobranca = await aplicacao.prisma.registroAuditoria.findMany({ where: { registroId: cobranca.id } });
    expect(trilhaDaCobranca).toEqual([
      expect.objectContaining({ operacao: 'ALTERACAO', usuarioId: atendente.id, detalhe: expect.stringContaining(JUSTIFICATIVA_DE_TESTE) }),
    ]);
    const trilhaDaEntrada = await aplicacao.prisma.registroAuditoria.findMany({ where: { registroId: paga.movimentacaoId! } });
    expect(trilhaDaEntrada).toEqual([expect.objectContaining({ operacao: 'INCLUSAO', entidade: 'MOVIMENTACAO', usuarioId: atendente.id })]);

    // A origem do dado fica visível: o detalhe mostra a situação distinta de "Paga" e a justificativa.
    const detalhe = await aplicacao.http().get(`/api/cobrancas/${cobranca.id}`).set('Cookie', cookie);
    expect(detalhe.body).toMatchObject({
      situacao: 'PAGA_COM_REGISTRO_MANUAL',
      justificativaManual: JUSTIFICATIVA_DE_TESTE,
      podeRegistrarPagamentoManual: false,
    });
  });

  it('FP: cobrança Vencida de mensalidade também aceita o registro, e a entrada vai para a categoria de mensalidade', async () => {
    const cobranca = await cobrancaAberta({ origem: 'MENSALIDADE', vencimento: diaDeHojeMais(-15) });
    const pagoEm = diaDeHojeMais(-2);

    const resposta = await registrar(cobranca.id, {
      pagoEm,
      valorCentavos: 8700,
      formaPagamento: 'DINHEIRO',
      justificativa: JUSTIFICATIVA_DE_TESTE,
    });

    expect(resposta.status).toBe(204);
    const paga = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id }, include: { movimentacao: true } });
    expect(paga.situacao).toBe('PAGA_COM_REGISTRO_MANUAL');
    expect(paga.pagaEm).toEqual(deDia(pagoEm));
    expect(paga.movimentacao).toMatchObject({
      valorCentavos: 8700,
      data: deDia(pagoEm),
      formaPagamento: 'DINHEIRO',
      contaId: parametros.contaId,
      categoriaId: parametros.categoriaMensalidadeId,
    });
  });

  it('E1: sem justificativa escrita o registro é recusado e nada muda', async () => {
    const cobranca = await cobrancaAberta();
    const pagamento = { pagoEm: diaDeHojeMais(0), valorCentavos: 8500, formaPagamento: 'PIX' };

    const semJustificativa = await registrar(cobranca.id, pagamento);
    const soEspacos = await registrar(cobranca.id, { ...pagamento, justificativa: '      ' });

    for (const resposta of [semJustificativa, soEspacos]) {
      expect(resposta.status).toBe(400);
      expect(resposta.body.message).toContain('A justificativa é obrigatória');
    }
    await conferirQueNadaMudou(cobranca, 0);
    expect(await entradasDaCobranca(cobranca)).toHaveLength(0);
  });

  it('transição proibida: registrar pagamento numa cobrança Cancelada é recusado e não cria entrada', async () => {
    const aberta = await cobrancaAberta();
    await cancelarCobranca(aplicacao, cookie, aberta.id);
    const cancelada = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: aberta.id } });
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count({ where: { registroId: cancelada.id } });

    const resposta = await registrar(cancelada.id, {
      pagoEm: diaDeHojeMais(0),
      valorCentavos: 8500,
      formaPagamento: 'PIX',
      justificativa: JUSTIFICATIVA_DE_TESTE,
    });

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('está cancelada');
    await conferirQueNadaMudou(cancelada, trilhaAntes);
    expect(await entradasDaCobranca(cancelada)).toHaveLength(0);
  });

  it('transição proibida: registrar de novo numa cobrança já Paga com registro manual é recusado, sem segunda entrada', async () => {
    const aberta = await cobrancaAberta();
    await registrarPagamentoManual(aplicacao, cookie, aberta.id);
    const pagaAMao = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: aberta.id } });
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count({ where: { registroId: pagaAMao.id } });

    const resposta = await registrar(pagaAMao.id, {
      pagoEm: diaDeHojeMais(0),
      valorCentavos: 8500,
      formaPagamento: 'PIX',
      justificativa: JUSTIFICATIVA_DE_TESTE,
    });

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toContain('já está paga');
    await conferirQueNadaMudou(pagaAMao, trilhaAntes);
    expect(await entradasDaCobranca(pagaAMao)).toHaveLength(1);
  });
});

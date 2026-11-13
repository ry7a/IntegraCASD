// CT-ADM-03 (integração, valor-limite), com banco real e pelas rotas HTTP. Complementa o teste de unidade
// (parametros-de-cobranca.spec.ts, que confere as regras de cada campo):
// - parâmetros novos valem só para as cobranças futuras: as que já existem não mudam;
// - dia de geração no dia do vencimento ou depois é recusado (fluxo E1), e os vigentes continuam os mesmos.
import { hojeEmSaoPaulo } from '../../../src/compartilhado/datas.js';
import { GerarCobrancasRecorrentes } from '../../../src/modulos/cobrancas/aplicacao/gerar-cobrancas-recorrentes.js';
import { RitmoDoAsaas } from '../../../src/modulos/cobrancas/infra/ritmo-do-asaas.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { type ParametrosDeTeste, criarAluno, criarCobrancaAberta, criarUsuario, definirParametros } from '../../apoio/cenario.js';

describe('[Administração.RF003] CT-ADM-03 parâmetros de cobrança valem só para o futuro', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;
  let antigos: ParametrosDeTeste;

  // Corpo do PUT com a conta e as categorias que já estavam valendo.
  function parametros(valores: { valorMensalidadeCentavos: number; diaGeracao: number; diaVencimento: number }) {
    return {
      ...valores,
      multaPercentual: 2,
      jurosMensalPercentual: 1,
      contaRecebimentoId: antigos.contaId,
      categoriaMensalidadeId: antigos.categoriaMensalidadeId,
      categoriaAvulsaId: antigos.categoriaAvulsaId,
    };
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    // Sem a espera de 300 ms entre os alunos: aqui não se mede o ritmo (isso é o CT-NF-05).
    vi.spyOn(aplicacao.app.get(RitmoDoAsaas), 'aguardar').mockResolvedValue(undefined);
    const diretor = await criarUsuario(aplicacao.prisma);
    antigos = await definirParametros(aplicacao.prisma, diretor.id, { valorMensalidadeCentavos: 8500 });
    cookie = await entrar(aplicacao, diretor.email, diretor.senha);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await aplicacao?.encerrar();
  });

  it('FP: a mensalidade nova sai com o valor novo, e as cobranças que já existiam ficam com o antigo', async () => {
    const alunoComCobranca = await criarAluno(aplicacao.prisma);
    const existente = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, {
      alunoId: alunoComCobranca.id,
      origem: 'AVULSA',
      valorCentavos: antigos.valorMensalidadeCentavos,
    });
    const alunoNovo = await criarAluno(aplicacao.prisma);

    await aplicacao
      .http()
      .put('/api/admin/parametros-cobranca')
      .set('Cookie', cookie)
      .send(parametros({ valorMensalidadeCentavos: 9900, diaGeracao: 1, diaVencimento: 10 }))
      .expect(204);

    // A cobrança que já existia não foi tocada: nem o valor, nem a multa e os juros, nem a data de alteração.
    const depois = await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: existente.id } });
    expect(depois).toMatchObject({ valorCentavos: 8500, multaPercentual: 2, jurosMensalPercentual: 1 });
    expect(depois.dataAlteracao).toEqual(existente.dataAlteracao);

    // A próxima geração já usa o valor novo.
    await aplicacao.app.get(GerarCobrancasRecorrentes).executar('MANUAL', hojeEmSaoPaulo(), null);
    const mensalidade = await aplicacao.prisma.cobranca.findFirstOrThrow({ where: { alunoId: alunoNovo.id, origem: 'MENSALIDADE' } });
    expect(mensalidade.valorCentavos).toBe(9900);
  });

  it.each([
    { diaGeracao: 9, diaVencimento: 10, status: 204, leitura: 'um dia antes do vencimento: aceito' },
    { diaGeracao: 10, diaVencimento: 10, status: 400, leitura: 'no dia do vencimento: recusado (E1)' },
    { diaGeracao: 11, diaVencimento: 10, status: 400, leitura: 'depois do vencimento: recusado (E1)' },
  ])('valor-limite do dia de geração, $leitura', async ({ diaGeracao, diaVencimento, status }) => {
    const antes = await aplicacao.prisma.parametrosCobranca.count();

    const resposta = await aplicacao
      .http()
      .put('/api/admin/parametros-cobranca')
      .set('Cookie', cookie)
      .send(parametros({ valorMensalidadeCentavos: 9900, diaGeracao, diaVencimento }));

    expect(resposta.status).toBe(status);
    // Aceito grava um registro novo (o histórico fica); recusado não grava nada.
    expect(await aplicacao.prisma.parametrosCobranca.count()).toBe(status === 204 ? antes + 1 : antes);
  });
});

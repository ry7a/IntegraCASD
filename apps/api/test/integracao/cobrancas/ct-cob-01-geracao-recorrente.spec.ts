// CT-COB-01 (integração, caixa cinza): a geração recorrente das mensalidades, com banco real.
// Caminho o mais próximo do real: a área administrativa pede "gerar agora" pela rota HTTP (fluxo A2), o pedido
// vira uma tarefa na fila do pg-boss e o consumidor da fila, o mesmo que o main-worker.ts liga, roda a geração.
// Depois o teste confere no banco as cobranças criadas e o registro da execução.
//
// O banco é compartilhado com os outros arquivos: a geração cobra TODOS os alunos ativos que encontrar,
// inclusive os criados por outros testes. Por isso as conferências olham só os alunos deste arquivo, e os
// totais da execução são comparados com contagens do banco, nunca com números fixos.
import { paraDia } from '../../../src/compartilhado/datas.js';
import type { Aluno, ExecucaoGeracao } from '../../../src/generated/prisma/client.js';
import { ConsumidorDaGeracaoRecorrente } from '../../../src/modulos/cobrancas/index.js';
import { RitmoDoAsaas } from '../../../src/modulos/cobrancas/infra/ritmo-do-asaas.js';
import { type AplicacaoDeTeste, entrar, esperarAte, subirAplicacao } from '../../apoio/aplicacao.js';
import { type ParametrosDeTeste, criarAluno, criarUsuario, definirParametros, diaDeHojeMais } from '../../apoio/cenario.js';
import { cpfComDigitoErrado } from './apoio-de-cobrancas.js';

const DIA_DE_VENCIMENTO = 10;

// Um item da lista de execuções, como a API devolve (GET /api/cobrancas/geracao-recorrente/execucoes).
type ExecucaoNaApi = {
  id: string;
  referencia: string;
  origem: string;
  iniciadaEm: string;
  finalizadaEm: string | null;
  totalProcessado: number;
  totalJaExistentes: number;
  totalFalhas: number;
  falhas: Array<{ alunoId: string; alunoNome: string; motivo: string }>;
  interrompida: boolean;
};

describe('[Cobranças.RF001] CT-COB-01 geração recorrente das mensalidades', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;
  let parametros: ParametrosDeTeste;
  let alunosCompletos: Aluno[];
  let alunoSemEmail: Aluno;
  let alunoComCpfInvalido: Aluno;
  let alunoInativo: Aluno;
  let primeiraExecucao: ExecucaoGeracao;

  // Hoje e o mês de hoje (São Paulo), como a aplicação calcula. O dia de geração é 1: o mês sempre já começou.
  const hoje = diaDeHojeMais(0);
  const referencia = hoje.slice(0, 7);
  // O vencimento é o dia dos parâmetros no mês; se esse dia já passou, vence hoje (o Asaas não aceita passado).
  const vencimentoNoDia = `${referencia}-${String(DIA_DE_VENCIMENTO).padStart(2, '0')}`;
  const vencimentoEsperado = vencimentoNoDia < hoje ? hoje : vencimentoNoDia;

  // Tarefas da geração ainda por fazer na fila do pg-boss: em andamento, ou esperando e já liberadas para rodar.
  // Uma nova tentativa marcada para daqui a uma hora (fluxo E1 de outra execução) não conta: ela não roda agora.
  async function tarefasPendentesDaGeracao(): Promise<number> {
    const linhas = await aplicacao.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pgboss.job
      WHERE name = 'geracao-recorrente'
        AND (state = 'active' OR (state IN ('created', 'retry') AND start_after <= now()))`;
    return Number(linhas[0].total);
  }

  // Pede "gerar agora" pela rota, espera o worker esvaziar a fila da geração e devolve a execução nova.
  // A execução é achada pelo id que não existia antes do pedido (e não pelo relógio, que pode diferir do banco).
  async function pedirGeracaoEEsperar(): Promise<ExecucaoGeracao> {
    const anteriores = await aplicacao.prisma.execucaoGeracao.findMany({ select: { id: true } });
    const resposta = await aplicacao.http().post('/api/cobrancas/geracao-recorrente').set('Cookie', cookie);
    expect(resposta.status).toBe(202);
    expect(resposta.body).toEqual({ referencia });

    // Com mil alunos de outros arquivos no banco, a geração leva alguns segundos.
    await esperarAte(async () => (await tarefasPendentesDaGeracao()) === 0, 150_000);
    const novas = await aplicacao.prisma.execucaoGeracao.findMany({
      where: { id: { notIn: anteriores.map((execucao) => execucao.id) } },
      orderBy: { iniciadaEm: 'desc' },
    });
    if (novas.length === 0) throw new Error('O worker esvaziou a fila, mas nenhuma execução da geração foi registrada.');
    return novas[0];
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    // O intervalo de 300 ms entre um aluno e outro protege o Asaas real do limite de requisições. Com o Asaas
    // falso ele só deixaria o teste lento: com mil alunos de outros arquivos no banco, seriam 5 minutos.
    vi.spyOn(aplicacao.app.get(RitmoDoAsaas), 'aguardar').mockResolvedValue();

    const diretor = await criarUsuario(aplicacao.prisma);
    parametros = await definirParametros(aplicacao.prisma, diretor.id, { diaGeracao: 1, diaVencimento: DIA_DE_VENCIMENTO });
    const atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);

    alunosCompletos = [await criarAluno(aplicacao.prisma), await criarAluno(aplicacao.prisma)];
    alunoSemEmail = await criarAluno(aplicacao.prisma, { email: '' });
    alunoComCpfInvalido = await criarAluno(aplicacao.prisma, { cpf: cpfComDigitoErrado() });
    alunoInativo = await criarAluno(aplicacao.prisma, { ativo: false });

    // Liga o consumidor da fila da geração, como o main-worker.ts faz.
    await aplicacao.app.get(ConsumidorDaGeracaoRecorrente).iniciar();
    primeiraExecucao = await pedirGeracaoEEsperar();
  }, 180_000);

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it('FP: cria uma cobrança Aberta por aluno ativo, primeiro no Asaas e depois aqui; o aluno inativo não é cobrado', async () => {
    for (const aluno of alunosCompletos) {
      const cobrancas = await aplicacao.prisma.cobranca.findMany({ where: { alunoId: aluno.id } });
      expect(cobrancas).toHaveLength(1);
      const mensalidade = cobrancas[0];
      expect(mensalidade).toMatchObject({
        origem: 'MENSALIDADE',
        referencia,
        situacao: 'ABERTA',
        valorCentavos: parametros.valorMensalidadeCentavos,
        multaPercentual: 2,
        jurosMensalPercentual: 1,
        // Gerada pela rotina, sem intervenção humana.
        emitidaPorId: null,
      });
      expect(paraDia(mensalidade.vencimento)).toBe(vencimentoEsperado);

      // A cobrança gravada é a que o Asaas criou: mesmo id, com o pagador, os valores e a referência da mensalidade.
      expect(mensalidade.idAsaas).not.toBeNull();
      expect(aplicacao.asaas.noAsaas.get(mensalidade.idAsaas!)).toMatchObject({
        situacao: 'PENDING',
        valorCentavos: parametros.valorMensalidadeCentavos,
        vencimento: vencimentoEsperado,
        multaPercentual: 2,
        jurosMensalPercentual: 1,
        referenciaExterna: `mensalidade:${aluno.id}:${referencia}`,
      });
      expect(aplicacao.asaas.clientesCriados.map((cliente) => cliente.cpf)).toContain(aluno.cpf);
    }

    expect(await aplicacao.prisma.cobranca.count({ where: { alunoId: alunoInativo.id } })).toBe(0);
    expect(aplicacao.asaas.clientesCriados.map((cliente) => cliente.cpf)).not.toContain(alunoInativo.cpf);
  });

  it('A2: aluno sem e-mail ou com CPF inválido vai para a lista de falhas, com o campo que falta, e não chega ao Asaas', async () => {
    expect(primeiraExecucao.falhas).toEqual(
      expect.arrayContaining([
        { alunoId: alunoSemEmail.id, alunoNome: alunoSemEmail.nome, motivo: expect.stringContaining('e-mail') },
        { alunoId: alunoComCpfInvalido.id, alunoNome: alunoComCpfInvalido.nome, motivo: expect.stringContaining('CPF') },
      ]),
    );

    const incompletos = [alunoSemEmail, alunoComCpfInvalido];
    expect(await aplicacao.prisma.cobranca.count({ where: { alunoId: { in: incompletos.map((aluno) => aluno.id) } } })).toBe(0);
    const cpfsEnviadosAoAsaas = aplicacao.asaas.clientesCriados.map((cliente) => cliente.cpf);
    for (const aluno of incompletos) expect(cpfsEnviadosAoAsaas).not.toContain(aluno.cpf);
  });

  it('[Confiabilidade.NF007] a execução fica registrada com início, fim, totais e falhas, e a API a mostra', async () => {
    const execucao = primeiraExecucao;
    expect(execucao).toMatchObject({ referencia, origem: 'MANUAL', interrompida: false });
    expect(execucao.finalizadaEm).not.toBeNull();
    expect(execucao.finalizadaEm!.getTime()).toBeGreaterThanOrEqual(execucao.iniciadaEm.getTime());

    // Cada aluno ativo entra em exatamente um total: cobrança criada, já existente ou falha.
    const alunosAtivos = await aplicacao.prisma.aluno.count({ where: { ativo: true } });
    expect(execucao.totalCriadas + execucao.totalJaExistentes + execucao.totalFalhas).toBe(alunosAtivos);
    expect(execucao.totalCriadas).toBeGreaterThanOrEqual(alunosCompletos.length);
    expect(execucao.totalFalhas).toBe((execucao.falhas as unknown[]).length);

    // O resultado pode ser consultado pela área administrativa.
    const resposta = await aplicacao.http().get('/api/cobrancas/geracao-recorrente/execucoes').set('Cookie', cookie);
    expect(resposta.status).toBe(200);
    const itens = resposta.body.itens as ExecucaoNaApi[];
    const naApi = itens.find((item) => item.id === execucao.id);
    expect(naApi).toMatchObject({
      referencia,
      origem: 'MANUAL',
      iniciadaEm: execucao.iniciadaEm.toISOString(),
      finalizadaEm: execucao.finalizadaEm!.toISOString(),
      totalProcessado: execucao.totalCriadas,
      totalJaExistentes: execucao.totalJaExistentes,
      totalFalhas: execucao.totalFalhas,
      interrompida: false,
    });
    expect(naApi!.falhas.map((falha) => falha.alunoId)).toEqual(expect.arrayContaining([alunoSemEmail.id, alunoComCpfInvalido.id]));
  });

  it('A1: rodar de novo não duplica: quem já tem a mensalidade do mês é pulado e o Asaas não é chamado de novo', async () => {
    const pedidosAoAsaasAntes = aplicacao.asaas.cobrancasCriadas.length;

    const segundaExecucao = await pedirGeracaoEEsperar();

    expect(segundaExecucao.id).not.toBe(primeiraExecucao.id);
    expect(segundaExecucao.finalizadaEm).not.toBeNull();
    expect(segundaExecucao.totalCriadas).toBe(0);
    expect(segundaExecucao.totalJaExistentes).toBeGreaterThanOrEqual(alunosCompletos.length);
    expect(aplicacao.asaas.cobrancasCriadas.length).toBe(pedidosAoAsaasAntes);
    for (const aluno of alunosCompletos) {
      expect(await aplicacao.prisma.cobranca.count({ where: { alunoId: aluno.id, referencia } })).toBe(1);
    }
    // Quem tinha o cadastro incompleto continua na lista de falhas até o cadastro ser corrigido (fluxo A2).
    expect((segundaExecucao.falhas as Array<{ alunoId: string }>).map((falha) => falha.alunoId)).toEqual(
      expect.arrayContaining([alunoSemEmail.id, alunoComCpfInvalido.id]),
    );
  });
});

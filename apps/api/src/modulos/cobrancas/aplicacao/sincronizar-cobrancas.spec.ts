import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { CobrancaNoAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { AcaoDaConciliacao } from '../dominio/conciliacao.js';
import type { CobrancaParaConciliar, ConciliacaoRepositorio, DestinoDaBaixa } from '../infra/conciliacao.repositorio.js';
import type { NovaPendencia, PendenciasRepositorio } from '../infra/pendencias.repositorio.js';
import type { RitmoDoAsaas } from '../infra/ritmo-do-asaas.js';
import type { CobrancaTrazidaDoAsaas, ResumoDaSincronizacao, SincronizacaoRepositorio } from '../infra/sincronizacao.repositorio.js';
import { SincronizarCobrancas } from './sincronizar-cobrancas.js';

// Tudo fictício (LGPD). Cobranças daqui guardadas em memória, com o vencimento para o filtro do período.
type Local = CobrancaParaConciliar & { vencimento: string };
const ALUNO = 'aaaaaaaa-0000-4000-8000-000000000001';
const PERIODO = { vencimentoDe: '2026-10-01', vencimentoAte: '2026-10-31' };
const HOJE = '2026-10-26';

function local(idAsaas: string, situacao: Local['situacao'] = 'ABERTA'): Local {
  return {
    id: `id-${idAsaas}`,
    idAsaas,
    origem: 'MENSALIDADE',
    descricao: 'Mensalidade 10/2026',
    situacao,
    valorCentavos: 8500,
    disponivelEm: null,
    movimentacaoId: situacao === 'ABERTA' ? null : 'mov-1',
    vencimento: '2026-10-10',
  };
}

function noAsaas(idAsaas: string, mudancas: Partial<CobrancaNoAsaas> = {}): CobrancaNoAsaas {
  return {
    idAsaas,
    idCliente: 'cus_ficticio_1',
    situacao: 'PENDING',
    removida: false,
    valorCentavos: 8500,
    vencimento: '2026-10-10',
    descricao: 'Mensalidade 10/2026',
    referenciaExterna: null,
    pagoEm: null,
    disponivelEm: null,
    multaPercentual: 2,
    jurosMensalPercentual: 1,
    urlBoleto: null,
    urlFatura: null,
    ...mudancas,
  };
}

function montar(
  opcoes: { locais?: Local[]; destino?: boolean; clientes?: Record<string, string>; herdadas?: string[] } = {},
) {
  const asaas = new ClienteAsaasFalso();
  const locais = new Map((opcoes.locais ?? []).map((cobranca) => [cobranca.idAsaas, cobranca]));
  const aplicadas: Array<{ idAsaas: string; acao: AcaoDaConciliacao; destino: DestinoDaBaixa | null }> = [];
  const trazidas: CobrancaTrazidaDoAsaas[] = [];
  const finalizadas: ResumoDaSincronizacao[] = [];
  const marcadas: string[] = [];
  const pendencias: NovaPendencia[] = [];

  const conciliacao = {
    buscarCobranca: async (idAsaas: string) => locais.get(idAsaas) ?? null,
    buscarCobrancaPorId: async (id: string) => [...locais.values()].find((cobranca) => cobranca.id === id) ?? null,
    // As herdadas (ADR-0005) existem só aqui: o repositório real não as devolve para conciliar.
    origemDaCobranca: async (id: string) =>
      opcoes.herdadas?.includes(id) ? 'HERDADA' : ([...locais.values()].find((cobranca) => cobranca.id === id)?.origem ?? null),
    aplicar: async (_evento: null, cobranca: Local, acao: AcaoDaConciliacao, destino: DestinoDaBaixa | null) => {
      aplicadas.push({ idAsaas: cobranca.idAsaas, acao, destino });
      return 'aplicado';
    },
  } as unknown as ConciliacaoRepositorio;

  const sincronizacoes = {
    iniciar: async () => 'execucao-1',
    finalizar: async (_id: string, resumo: ResumoDaSincronizacao) => {
      finalizadas.push(resumo);
      return { id: 'execucao-1', iniciadaEm: new Date(), finalizadaEm: new Date(), ...resumo };
    },
    cobrancasDoPeriodo: async (de: string, ate: string) =>
      [...locais.values()].filter((cobranca) => cobranca.vencimento >= de && cobranca.vencimento <= ate),
    marcarSincronizadas: async (ids: string[]) => void marcadas.push(...ids),
    alunoDoClienteAsaas: async (idCliente: string) => opcoes.clientes?.[idCliente] ?? null,
    alunoExiste: async (alunoId: string) => alunoId === ALUNO,
    existeMensalidade: async () => false,
    registrarTrazidaDoAsaas: async (dados: CobrancaTrazidaDoAsaas) => {
      trazidas.push(dados);
      const registrada: Local = { ...local(dados.idAsaas), origem: dados.origem, descricao: dados.descricao };
      locais.set(dados.idAsaas, registrada);
      return registrada;
    },
  } as unknown as SincronizacaoRepositorio;

  const parametros = {
    executar: async () =>
      opcoes.destino === false
        ? null
        : { contaRecebimentoId: 'conta-1', categoriaMensalidadeId: 'cat-mensalidade', categoriaAvulsaId: 'cat-avulsa' },
  } as unknown as BuscarParametrosVigentes;
  const ritmo = { aguardar: async () => undefined } as RitmoDoAsaas;

  const filaDePendencias = { registrar: async (nova: NovaPendencia) => void pendencias.push(nova) } as unknown as PendenciasRepositorio;

  const casoDeUso = new SincronizarCobrancas(asaas, conciliacao, sincronizacoes, parametros, ritmo, filaDePendencias);
  return { casoDeUso, asaas, aplicadas, trazidas, finalizadas, marcadas, pendencias };
}

describe('SincronizarCobrancas [Cobranças.RF007]', () => {
  it('baixa aqui a cobrança paga no Asaas e marca todas as conferidas', async () => {
    const { casoDeUso, asaas, aplicadas, marcadas } = montar({ locais: [local('pay_1'), local('pay_2')] });
    asaas.noAsaas.set('pay_1', noAsaas('pay_1', { situacao: 'RECEIVED', pagoEm: '2026-10-09', disponivelEm: '2026-10-11' }));
    asaas.noAsaas.set('pay_2', noAsaas('pay_2'));

    const resultado = await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE);

    expect(resultado).toMatchObject({ conferidas: 2, atualizadas: 1, somenteNoAsaas: 0, paraConferir: 0, falha: null });
    expect(aplicadas).toEqual([
      {
        idAsaas: 'pay_1',
        acao: { tipo: 'BAIXAR', valorPagoCentavos: 8500, pagoEm: '2026-10-09', disponivelEm: '2026-10-11' },
        destino: { contaId: 'conta-1', categoriaId: 'cat-mensalidade' },
      },
    ]);
    expect(marcadas.sort()).toEqual(['id-pay_1', 'id-pay_2']);
  });

  it('registra aqui a mensalidade que só existe no Asaas, reconhecida pela referência externa (RF001 E2)', async () => {
    const { casoDeUso, asaas, trazidas, aplicadas } = montar();
    asaas.noAsaas.set(
      'pay_9',
      noAsaas('pay_9', { referenciaExterna: `mensalidade:${ALUNO}:2026-10`, situacao: 'CONFIRMED', pagoEm: '2026-10-05' }),
    );

    const resultado = await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE);

    expect(resultado).toMatchObject({ somenteNoAsaas: 1, atualizadas: 1, naoIdentificadas: 0 });
    expect(trazidas).toEqual([
      expect.objectContaining({ idAsaas: 'pay_9', alunoId: ALUNO, origem: 'MENSALIDADE', referencia: '2026-10' }),
    ]);
    expect(aplicadas.map((aplicada) => aplicada.acao.tipo)).toEqual(['BAIXAR']);
  });

  it('cobrança avulsa do painel é registrada pelo cliente do Asaas; sem aluno, fica como não identificada', async () => {
    const { casoDeUso, asaas, trazidas, pendencias } = montar({ clientes: { cus_do_aluno: ALUNO } });
    asaas.noAsaas.set('pay_a', noAsaas('pay_a', { idCliente: 'cus_do_aluno', descricao: 'Camiseta', multaPercentual: 10 }));
    asaas.noAsaas.set('pay_b', noAsaas('pay_b', { idCliente: 'cus_desconhecido' }));

    const resultado = await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE);

    expect(resultado).toMatchObject({ somenteNoAsaas: 1, naoIdentificadas: 1 });
    expect(trazidas).toEqual([expect.objectContaining({ idAsaas: 'pay_a', origem: 'AVULSA', referencia: null, multaPercentual: 2 })]);
    // A não identificada vai para a fila de pendências.
    expect(pendencias).toEqual([expect.objectContaining({ tipo: 'SEM_COBRANCA', idAsaas: 'pay_b', origem: 'SINCRONIZACAO' })]);
  });

  it('cobrança aberta aqui e excluída no Asaas é cancelada', async () => {
    const { casoDeUso, asaas, aplicadas } = montar({ locais: [local('pay_1')] });
    asaas.noAsaas.set('pay_1', noAsaas('pay_1', { removida: true }));

    expect(await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE)).toMatchObject({ conferidas: 1, atualizadas: 1 });
    expect(aplicadas.map((aplicada) => aplicada.acao.tipo)).toEqual(['CANCELAR']);
  });

  it('paga à mão aqui e paga no Asaas: vai para a fila de pendências, sem segunda entrada (RF006 E2)', async () => {
    const { casoDeUso, asaas, aplicadas } = montar({ locais: [local('pay_1', 'PAGA_COM_REGISTRO_MANUAL')] });
    asaas.noAsaas.set('pay_1', noAsaas('pay_1', { situacao: 'RECEIVED', pagoEm: '2026-10-09' }));

    expect(await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE)).toMatchObject({ paraConferir: 1, atualizadas: 0 });
    expect(aplicadas.map((aplicada) => aplicada.acao)).toEqual([
      expect.objectContaining({ tipo: 'PENDENCIA', tipoDaPendencia: 'APOS_REGISTRO_MANUAL', idCobrancaAsaas: 'pay_1' }),
    ]);
  });

  it('aberta aqui e desconhecida no Asaas: vai para a fila como divergência', async () => {
    const { casoDeUso, pendencias } = montar({ locais: [local('pay_sumida')] });

    expect(await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE)).toMatchObject({ conferidas: 1, paraConferir: 1 });
    expect(pendencias).toEqual([expect.objectContaining({ tipo: 'DIVERGENCIA', idAsaas: 'pay_sumida', cobrancaId: 'id-pay_sumida' })]);
  });

  it('sem conta e categoria de recebimento, não baixa e explica na execução', async () => {
    const { casoDeUso, asaas, aplicadas } = montar({ locais: [local('pay_1')], destino: false });
    asaas.noAsaas.set('pay_1', noAsaas('pay_1', { situacao: 'RECEIVED', pagoEm: '2026-10-09' }));

    const resultado = await casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE);

    expect(resultado.falha).toMatch(/Administração > Parâmetros/);
    expect(aplicadas).toEqual([]);
  });

  it('com o Asaas fora do ar, registra a interrupção e avisa com 502 [Confiabilidade.NF007]', async () => {
    const { casoDeUso, asaas, finalizadas } = montar({ locais: [local('pay_1')] });
    asaas.indisponivel = true;

    await expect(casoDeUso.periodo(PERIODO, 'MANUAL', 'usuario-1', HOJE)).rejects.toBeInstanceOf(BadGatewayException);
    expect(finalizadas).toHaveLength(1);
    expect(finalizadas[0].falha).toMatch(/^Interrompida: O Asaas está fora do ar/);
  });

  it('sincroniza uma cobrança só, a partir do detalhe (fluxo A1)', async () => {
    const { casoDeUso, asaas, aplicadas } = montar({ locais: [local('pay_1')] });
    asaas.noAsaas.set('pay_1', noAsaas('pay_1', { situacao: 'CONFIRMED', pagoEm: '2026-10-09' }));

    expect(await casoDeUso.cobranca('id-pay_1', 'usuario-1', HOJE)).toMatchObject({ conferidas: 1, atualizadas: 1 });
    expect(aplicadas.map((aplicada) => aplicada.acao.tipo)).toEqual(['BAIXAR']);
  });

  it('cobrança herdada da planilha não é sincronizada: 400, sem consultar o Asaas (ADR-0005)', async () => {
    const { casoDeUso, finalizadas } = montar({ herdadas: ['id-herdada'] });
    const pedido = casoDeUso.cobranca('id-herdada', 'usuario-1', HOJE);
    await expect(pedido).rejects.toBeInstanceOf(BadRequestException);
    await expect(pedido).rejects.toThrow(/herdada da planilha/);
    expect(finalizadas).toEqual([]);
  });

  it('período inválido: 400, sem consultar o Asaas', async () => {
    const { casoDeUso, finalizadas } = montar();
    await expect(
      casoDeUso.periodo({ vencimentoDe: '2026-10-31', vencimentoAte: '2026-10-01' }, 'MANUAL', 'usuario-1', HOJE),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(finalizadas).toEqual([]);
  });
});

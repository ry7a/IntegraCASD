import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import { AgendadorDeRotinasFalso } from '../../../compartilhado/fila/agendador-de-rotinas.falso.js';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { AlunoDetalhe, ListarAlunos } from '../../cadastros/index.js';
import type { CobrancasRepositorio, DadosDaNovaCobranca } from '../infra/cobrancas.repositorio.js';
import type { ExecucoesRepositorio, ResultadoDaExecucao } from '../infra/execucoes.repositorio.js';
import type { RitmoDoAsaas } from '../infra/ritmo-do-asaas.js';
import { GarantirClienteAsaas } from './garantir-cliente-asaas.js';
import { GerarCobrancasRecorrentes } from './gerar-cobrancas-recorrentes.js';

// Dados fictícios (LGPD). Os CPFs só respeitam os dígitos verificadores.
const DIA_DE_GERACAO = '2026-11-01';
const parametros = { valorMensalidadeCentavos: 8500, diaVencimento: 10, diaGeracao: 1, multaPercentual: 2, jurosMensalPercentual: 1 };

function aluno(id: string, nome: string, cpf: string, extra: Partial<AlunoDetalhe> = {}): AlunoDetalhe {
  return { id, nome, cpf, email: `${id}@exemplo.com`, ativo: true, cadastroIncompleto: false, ...extra } as AlunoDetalhe;
}
const ana = aluno('a1', 'Ana Ficticia', '52998224725');
const bruno = aluno('a2', 'Bruno Ficticio', '39053344705');
const semEmail = aluno('a3', 'Caio Ficticio', '52601815906', { email: '', cadastroIncompleto: true });

function montar(opcoes: {
  alunos: AlunoDetalhe[];
  jaTemMensalidade?: string[];
  ultimaDoMes?: { interrompida: boolean } | null;
  diaGeracao?: number;
}) {
  const asaas = new ClienteAsaasFalso();
  const agendador = new AgendadorDeRotinasFalso();
  const gravadas: DadosDaNovaCobranca[] = [];
  const clientes = new Map<string, string>();
  const finalizadas: ResultadoDaExecucao[] = [];
  const iniciadas: string[] = [];
  const cobrancas = {
    existeMensalidade: async (alunoId: string) =>
      (opcoes.jaTemMensalidade ?? []).includes(alunoId) || gravadas.some((g) => g.alunoId === alunoId),
    idClienteAsaasDoAluno: async (id: string) => clientes.get(id) ?? null,
    registrarClienteAsaas: async (id: string, idAsaas: string) => void clientes.set(id, idAsaas),
    registrar: async (dados: DadosDaNovaCobranca) => void gravadas.push(dados),
  } as unknown as CobrancasRepositorio;
  const execucoes = {
    ultimaDoMes: async () => opcoes.ultimaDoMes ?? null,
    iniciar: async (referencia: string) => {
      iniciadas.push(referencia);
      return 'exec-1';
    },
    finalizar: async (_id: string, resultado: ResultadoDaExecucao) => void finalizadas.push(resultado),
  } as unknown as ExecucoesRepositorio;
  const listarAlunos = { executar: async () => opcoes.alunos } as unknown as ListarAlunos;
  const vigentes = { ...parametros, diaGeracao: opcoes.diaGeracao ?? parametros.diaGeracao };
  const buscarParametros = { executar: async () => vigentes } as unknown as BuscarParametrosVigentes;
  const ritmo = { aguardar: async () => undefined } as unknown as RitmoDoAsaas;
  const caso = new GerarCobrancasRecorrentes(
    cobrancas,
    execucoes,
    asaas,
    listarAlunos,
    buscarParametros,
    new GarantirClienteAsaas(cobrancas, asaas),
    agendador,
    ritmo,
  );
  return { caso, asaas, agendador, gravadas, finalizadas, iniciadas };
}

describe('GerarCobrancasRecorrentes [Cobranças.RF001]', () => {
  it('cria a mensalidade do mês para cada aluno ativo, com vencimento, multa e juros dos parâmetros', async () => {
    const { caso, asaas, gravadas, finalizadas } = montar({ alunos: [ana, bruno] });
    await caso.executar('AGENDADA', DIA_DE_GERACAO);
    expect(gravadas.map((g) => [g.alunoId, g.referencia, g.vencimento, g.valorCentavos])).toEqual([
      ['a1', '2026-11', '2026-11-10', 8500],
      ['a2', '2026-11', '2026-11-10', 8500],
    ]);
    expect(asaas.cobrancasCriadas[0]).toMatchObject({ multaPercentual: 2, referenciaExterna: 'mensalidade:a1:2026-11' });
    expect(finalizadas[0]).toMatchObject({ totalCriadas: 2, totalFalhas: 0, interrompida: false });
  });

  it('rodar de novo não duplica: quem já tem a mensalidade é pulado (fluxo A1)', async () => {
    const { caso, asaas, finalizadas } = montar({ alunos: [ana, bruno], jaTemMensalidade: ['a1'] });
    await caso.executar('MANUAL', DIA_DE_GERACAO);
    expect(asaas.cobrancasCriadas).toHaveLength(1);
    expect(finalizadas[0]).toMatchObject({ totalCriadas: 1, totalJaExistentes: 1 });
  });

  it('cadastro incompleto vira falha com o campo que falta, e os demais seguem (fluxo A2)', async () => {
    const { caso, finalizadas } = montar({ alunos: [semEmail, ana] });
    await caso.executar('AGENDADA', DIA_DE_GERACAO);
    expect(finalizadas[0].totalCriadas).toBe(1);
    expect(finalizadas[0].falhas).toEqual([{ alunoId: 'a3', alunoNome: 'Caio Ficticio', motivo: 'Cadastro incompleto: falta o e-mail.' }]);
  });

  it('dados recusados pelo Asaas afetam só aquele aluno', async () => {
    const { caso, asaas, finalizadas } = montar({ alunos: [ana, bruno] });
    asaas.cpfsRecusados.add(ana.cpf);
    await caso.executar('AGENDADA', DIA_DE_GERACAO);
    expect(finalizadas[0]).toMatchObject({ totalCriadas: 1, totalFalhas: 1, interrompida: false });
  });

  it('Asaas fora do ar interrompe, não grava nada só aqui e agenda nova tentativa (fluxo E1)', async () => {
    const { caso, asaas, agendador, gravadas, finalizadas } = montar({ alunos: [ana, bruno] });
    asaas.indisponivel = true;
    await caso.executar('AGENDADA', DIA_DE_GERACAO);
    expect(gravadas).toEqual([]);
    expect(finalizadas[0].interrompida).toBe(true);
    expect(agendador.pedidasDepois).toEqual([{ rotina: 'geracao-recorrente', segundos: 3600, dados: { origem: 'AGENDADA' } }]);
  });

  it('a rotina agendada não roda antes do dia de geração nem duas vezes no mês', async () => {
    const antes = montar({ alunos: [ana], diaGeracao: 5 });
    expect(await antes.caso.executar('AGENDADA', '2026-11-04')).toBeNull();
    const jaGerado = montar({ alunos: [ana], ultimaDoMes: { interrompida: false } });
    expect(await jaGerado.caso.executar('AGENDADA', '2026-11-05')).toBeNull();
    expect(jaGerado.asaas.cobrancasCriadas).toEqual([]);
  });

  // Trava GERACAO_A_PARTIR_DE: a planilha cobra até a referência 2027-01; o sistema começa em 2027-02.
  it('com a trava em 2027-02, em 31/01/2027 não gera nada nem grava execução (agendada e manual)', async () => {
    for (const origem of ['AGENDADA', 'MANUAL'] as const) {
      const { caso, asaas, gravadas, iniciadas } = montar({ alunos: [ana, bruno] });
      expect(await caso.executar(origem, '2027-01-31', '2027-02')).toBeNull();
      expect(asaas.cobrancasCriadas).toEqual([]);
      expect(gravadas).toEqual([]);
      // Sem registro de execução de janeiro: nada impede a geração de fevereiro depois.
      expect(iniciadas).toEqual([]);
    }
  });

  it('com a trava em 2027-02, em 01/02/2027 gera a mensalidade de fevereiro', async () => {
    const { caso, gravadas, iniciadas } = montar({ alunos: [ana] });
    await caso.executar('AGENDADA', '2027-02-01', '2027-02');
    expect(iniciadas).toEqual(['2027-02']);
    expect(gravadas.map((g) => [g.referencia, g.descricao])).toEqual([['2027-02', 'Mensalidade de fevereiro/2027']]);
  });

  it('trava vazia (null) não muda nada: gera o mês corrente', async () => {
    const { caso, gravadas } = montar({ alunos: [ana] });
    await caso.executar('AGENDADA', '2027-01-31', null);
    expect(gravadas.map((g) => g.referencia)).toEqual(['2027-01']);
  });
});

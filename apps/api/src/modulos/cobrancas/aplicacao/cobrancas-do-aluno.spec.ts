import type { CobrancaRegistrada, CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { ListarCobrancasDoAluno } from './cobrancas-do-aluno.js';

// Dados fictícios (LGPD).
function cobranca(id: string, situacao: CobrancaRegistrada['situacao'], vencimento: string, valorCentavos: number): CobrancaRegistrada {
  return {
    id,
    idAsaas: `pay_${id}`,
    alunoId: 'aluno-1',
    alunoNome: 'Aluno Fictício',
    origem: 'MENSALIDADE',
    referencia: vencimento.slice(0, 7),
    descricao: `Mensalidade ${vencimento.slice(0, 7)}`,
    valorCentavos,
    vencimento,
    multaPercentual: 2,
    jurosMensalPercentual: 1,
    situacao,
    urlBoleto: null,
    urlFatura: null,
    pagaEm: situacao === 'PAGA' ? vencimento : null,
    justificativaManual: null,
    sincronizadaEm: null,
    canceladaEm: null,
    motivoCancelamento: null,
    renegociacaoDeId: null,
    renegociadaPorId: null,
  };
}

describe('cobranças do aluno [Cadastros.RF001] fluxo E2', () => {
  it('soma o que está em aberto e o que já venceu, para o aviso de débito ao inativar', async () => {
    const repositorio = {
      listarDoAluno: async () => [
        cobranca('a', 'ABERTA', '2026-11-10', 8500), // ainda não venceu
        cobranca('b', 'ABERTA', '2026-10-10', 8500), // vencida
        cobranca('c', 'ABERTA', '2026-09-10', 9000), // vencida
        cobranca('d', 'PAGA', '2026-08-10', 8500),
        cobranca('e', 'CANCELADA', '2026-07-10', 8500),
      ],
    } as unknown as CobrancasRepositorio;

    const resultado = await new ListarCobrancasDoAluno(repositorio).executar('aluno-1', '2026-10-26');

    expect(resultado).toMatchObject({ totalEmAbertoCentavos: 26000, quantidadeVencidas: 2, totalVencidoCentavos: 17500 });
    expect(resultado.itens.map((item) => item.situacao)).toEqual(['ABERTA', 'VENCIDA', 'VENCIDA', 'PAGA', 'CANCELADA']);
  });

  it('aluno sem cobranças: tudo zerado', async () => {
    const repositorio = { listarDoAluno: async () => [] } as unknown as CobrancasRepositorio;
    expect(await new ListarCobrancasDoAluno(repositorio).executar('aluno-1', '2026-10-26')).toEqual({
      itens: [],
      totalEmAbertoCentavos: 0,
      quantidadeVencidas: 0,
      totalVencidoCentavos: 0,
    });
  });
});

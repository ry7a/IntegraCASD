// Regras do indicador de inadimplência [Indicadores.RF002]. Só TypeScript puro. Datas em "AAAA-MM-DD".

// Uma cobrança vencida (aberta, com o vencimento já passado). Valor original, sem multa e juros: o
// Asaas só calcula os encargos no pagamento.
export type CobrancaVencida = { alunoId: string; alunoNome: string; valorCentavos: number; vencimento: string };

export type Devedor = {
  alunoId: string;
  alunoNome: string;
  quantidade: number;
  valorCentavos: number;
  diasDeAtrasoMaisAntigo: number;
};

export type Inadimplencia = {
  alunosInadimplentes: number;
  valorEmAbertoCentavos: number;
  // Cada aluno entra na faixa do atraso da sua cobrança mais antiga.
  alunosPorFaixa: { ate30Dias: number; de31a60Dias: number; acimaDe60Dias: number };
  // Ordenados por valor, do maior para o menor.
  maioresDevedores: Devedor[];
};

export const QUANTIDADE_DE_MAIORES_DEVEDORES = 10;

function diasEntre(inicio: string, fim: string): number {
  const dia = (texto: string) => Date.UTC(Number(texto.slice(0, 4)), Number(texto.slice(5, 7)) - 1, Number(texto.slice(8, 10)));
  return Math.round((dia(fim) - dia(inicio)) / 86_400_000);
}

// Passos 2 e 3: agrupa as vencidas por aluno e apura os totais.
export function apurarInadimplencia(vencidas: CobrancaVencida[], hoje: string): Inadimplencia {
  const porAluno = new Map<string, Devedor>();
  for (const cobranca of vencidas) {
    const atraso = diasEntre(cobranca.vencimento, hoje);
    const devedor = porAluno.get(cobranca.alunoId) ?? {
      alunoId: cobranca.alunoId,
      alunoNome: cobranca.alunoNome,
      quantidade: 0,
      valorCentavos: 0,
      diasDeAtrasoMaisAntigo: 0,
    };
    devedor.quantidade += 1;
    devedor.valorCentavos += cobranca.valorCentavos;
    devedor.diasDeAtrasoMaisAntigo = Math.max(devedor.diasDeAtrasoMaisAntigo, atraso);
    porAluno.set(cobranca.alunoId, devedor);
  }
  const devedores = [...porAluno.values()].sort(
    (a, b) => b.valorCentavos - a.valorCentavos || b.diasDeAtrasoMaisAntigo - a.diasDeAtrasoMaisAntigo,
  );
  return {
    alunosInadimplentes: devedores.length,
    valorEmAbertoCentavos: devedores.reduce((soma, devedor) => soma + devedor.valorCentavos, 0),
    alunosPorFaixa: {
      ate30Dias: devedores.filter((devedor) => devedor.diasDeAtrasoMaisAntigo <= 30).length,
      de31a60Dias: devedores.filter((devedor) => devedor.diasDeAtrasoMaisAntigo > 30 && devedor.diasDeAtrasoMaisAntigo <= 60).length,
      acimaDe60Dias: devedores.filter((devedor) => devedor.diasDeAtrasoMaisAntigo > 60).length,
    },
    maioresDevedores: devedores.slice(0, QUANTIDADE_DE_MAIORES_DEVEDORES),
  };
}

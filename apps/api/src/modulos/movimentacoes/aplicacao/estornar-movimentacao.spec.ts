import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { OrigemMovimentacao } from '../dominio/movimentacao.js';
import type { MovimentacoesRepositorio } from '../infra/movimentacoes.repositorio.js';
import { EstornarMovimentacao } from './estornar-movimentacao.js';

const HOJE = '2026-10-26';

// Dublê: a original combinada no teste; o estorno guarda o que recebeu.
function montar(original: { origem: OrigemMovimentacao; estornadaEm?: string | null } | null, outroEstornouAntes = false) {
  const estornos: Array<{ id: string; motivo: string; data: string; autorId: string }> = [];
  const repositorio = {
    paraEstornar: async () => (original === null ? null : { descricao: 'NF fictícia', estornadaEm: null, ...original }),
    estornar: async (id: string, motivo: string, data: string, autorId: string) => {
      if (outroEstornouAntes) return null;
      estornos.push({ id, motivo, data, autorId });
      return 'espelho-1';
    },
  } as unknown as MovimentacoesRepositorio;
  return { casoDeUso: new EstornarMovimentacao(repositorio), estornos };
}

describe('estornar movimentação [Movimentações.RF002]', () => {
  it('cria o espelho com o motivo, a data de hoje e o autor', async () => {
    const { casoDeUso, estornos } = montar({ origem: 'MANUAL' });
    expect(await casoDeUso.executar('mov-1', { motivo: '  valor   lançado errado ' }, 'usuario-1', HOJE)).toEqual({ espelhoId: 'espelho-1' });
    expect(estornos).toEqual([{ id: 'mov-1', motivo: 'valor lançado errado', data: HOJE, autorId: 'usuario-1' }]);
  });

  it('exige o motivo', async () => {
    const { casoDeUso, estornos } = montar({ origem: 'MANUAL' });
    await expect(casoDeUso.executar('mov-1', { motivo: 'ops' }, 'u', HOJE)).rejects.toBeInstanceOf(BadRequestException);
    expect(estornos).toEqual([]);
  });

  // O PostgreSQL recusa o \u0000: antes, a gravação do espelho dava erro 500.
  it('motivo com caractere nulo: recusa com 400 citando o motivo, sem estornar', async () => {
    const { casoDeUso, estornos } = montar({ origem: 'MANUAL' });
    const estornando = casoDeUso.executar('mov-1', { motivo: 'valor\u0000 lançado errado' }, 'u', HOJE);
    await expect(estornando).rejects.toBeInstanceOf(BadRequestException);
    await expect(estornando).rejects.toThrow(/nulo\) no motivo/);
    expect(estornos).toEqual([]);
  });

  it('motivo com mais de 300 caracteres: recusa citando o motivo', async () => {
    const { casoDeUso, estornos } = montar({ origem: 'MANUAL' });
    await expect(casoDeUso.executar('mov-1', { motivo: 'm'.repeat(301) }, 'u', HOJE)).rejects.toThrow(/300 caracteres no motivo/);
    expect(estornos).toEqual([]);
  });

  it('movimentação de cobrança não é estornada aqui (fluxo E1)', async () => {
    for (const origem of ['CONCILIACAO_AUTOMATICA', 'REGISTRO_MANUAL_DE_COBRANCA', 'ESTORNO'] as const) {
      const { casoDeUso, estornos } = montar({ origem });
      await expect(casoDeUso.executar('mov-1', { motivo: 'valor errado' }, 'u', HOJE)).rejects.toBeInstanceOf(BadRequestException);
      expect(estornos).toEqual([]);
    }
  });

  it('já estornada: informa a data e não cria outro espelho (fluxo E2)', async () => {
    const { casoDeUso, estornos } = montar({ origem: 'MANUAL', estornadaEm: '2026-10-08' });
    await expect(casoDeUso.executar('mov-1', { motivo: 'valor errado' }, 'u', HOJE)).rejects.toThrow(/já foi estornada em 08\/10\/2026/);
    expect(estornos).toEqual([]);
  });

  it('outro estorno ao mesmo tempo: 409; inexistente: 404', async () => {
    await expect(montar({ origem: 'MANUAL' }, true).casoDeUso.executar('mov-1', { motivo: 'valor errado' }, 'u', HOJE)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(montar(null).casoDeUso.executar('mov-x', { motivo: 'valor errado' }, 'u', HOJE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

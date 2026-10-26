import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ExecucaoRegistrada, ExecucoesRepositorio } from '../infra/execucoes.repositorio.js';
import type { PendenciasRepositorio } from '../infra/pendencias.repositorio.js';
import { ListarPendencias, ResolverPendencia, falhasAtuaisDaGeracao } from './pendencias-de-conciliacao.js';

// Dados fictícios (LGPD).
function execucao(referencia: string, iniciadaEm: string, falhas: ExecucaoRegistrada['falhas']): ExecucaoRegistrada {
  return {
    id: `exec-${referencia}-${iniciadaEm}`,
    referencia,
    origem: 'AGENDADA',
    iniciadaEm: new Date(iniciadaEm),
    finalizadaEm: new Date(iniciadaEm),
    totalCriadas: 0,
    totalJaExistentes: 0,
    totalFalhas: falhas.length,
    falhas,
    interrompida: false,
  };
}

const falha = (alunoNome: string) => ({ alunoId: `id-${alunoNome}`, alunoNome, motivo: 'Cadastro sem e-mail' });

describe('fila de pendências de conciliação [Cobranças.RF005]', () => {
  it('das falhas da geração, só as da execução mais recente de cada mês, do mês passado em diante', () => {
    const execucoes = [
      execucao('2026-10', '2026-10-01T09:00:00Z', [falha('Ana'), falha('Bia')]),
      // Gerou os pendentes de novo depois de corrigir o cadastro da Ana: esta substitui a anterior.
      execucao('2026-10', '2026-10-03T09:00:00Z', [falha('Bia')]),
      execucao('2026-09', '2026-09-01T09:00:00Z', [falha('Caio')]),
      execucao('2026-08', '2026-08-01T09:00:00Z', [falha('Duda')]),
    ];
    expect(falhasAtuaisDaGeracao(execucoes, '2026-10-26').map((item) => `${item.referencia} ${item.alunoNome}`).sort()).toEqual([
      '2026-09 Caio',
      '2026-10 Bia',
    ]);
  });

  it('em janeiro, o mês passado é dezembro do ano anterior', () => {
    expect(falhasAtuaisDaGeracao([execucao('2026-12', '2026-12-01T09:00:00Z', [falha('Eva')])], '2027-01-05')).toHaveLength(1);
  });

  it('a lista de resolvidas não traz falhas da geração', async () => {
    const pendencias = { listar: async () => [] } as unknown as PendenciasRepositorio;
    const execucoes = { ultimas: async () => [execucao('2026-10', '2026-10-01T09:00:00Z', [falha('Ana')])] } as unknown as ExecucoesRepositorio;
    const listar = new ListarPendencias(pendencias, execucoes);
    expect((await listar.executar(false, '2026-10-26')).falhasDaGeracao).toHaveLength(1);
    expect((await listar.executar(true, '2026-10-26')).falhasDaGeracao).toEqual([]);
  });

  it('resolver exige o texto do que foi conferido e avisa se a pendência não está mais aberta', async () => {
    const resolvidas: Array<{ id: string; resolucao: string; autorId: string }> = [];
    const pendencias = {
      resolver: async (id: string, resolucao: string, autorId: string) => {
        if (id === 'ja-resolvida') return false;
        resolvidas.push({ id, resolucao, autorId });
        return true;
      },
    } as unknown as PendenciasRepositorio;
    const resolver = new ResolverPendencia(pendencias);

    await expect(resolver.executar('p1', { resolucao: ' ok ' }, 'u')).rejects.toBeInstanceOf(BadRequestException);
    await resolver.executar('p1', { resolucao: '  Pagamento   duplicado devolvido pelo Asaas ' }, 'usuario-1');
    expect(resolvidas).toEqual([{ id: 'p1', resolucao: 'Pagamento duplicado devolvido pelo Asaas', autorId: 'usuario-1' }]);
    await expect(resolver.executar('ja-resolvida', { resolucao: 'Conferido com o Asaas' }, 'u')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

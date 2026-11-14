import { BadRequestException } from '@nestjs/common';
import type { NovaMovimentacao } from '../dominio/movimentacao.js';
import { conferirCategoria, lerNovaMovimentacao } from '../dominio/movimentacao.js';
import type { MovimentacoesRepositorio } from '../infra/movimentacoes.repositorio.js';
import { RegistrarMovimentacao } from './registrar-movimentacao.js';

const HOJE = '2026-10-26';
const CONTA = '11111111-1111-4111-8111-111111111111';
const CATEGORIA = '22222222-2222-4222-8222-222222222222';
const PROJETO = '33333333-3333-4333-8333-333333333333';
const CONTRATO = '44444444-4444-4444-8444-444444444444';

const valida = {
  contaId: CONTA,
  tipo: 'SAIDA',
  valorCentavos: 120000,
  data: '2026-10-20',
  categoriaId: CATEGORIA,
  forma: 'PIX',
  descricao: '  NF 685,   limpeza ',
};

describe('registrar movimentação [Movimentações.RF001]', () => {
  it('lê e normaliza a entrada; sem vínculo, os três ficam nulos', () => {
    expect(lerNovaMovimentacao(valida, HOJE)).toEqual({
      ...valida,
      descricao: 'NF 685, limpeza',
      contratoId: null,
      projetoId: null,
      funcionarioId: null,
    });
  });

  it('recusa data no futuro (fluxo E1) e valor zero (fluxo E2)', () => {
    expect(() => lerNovaMovimentacao({ ...valida, data: '2026-10-27' }, HOJE)).toThrow(/futuro/);
    expect(() => lerNovaMovimentacao({ ...valida, valorCentavos: 0 }, HOJE)).toThrow(/maior que zero/);
    expect(() => lerNovaMovimentacao({ ...valida, valorCentavos: 10.5 }, HOJE)).toThrow(/centavos inteiros/);
  });

  it('Asaas não é forma de lançamento manual; só um vínculo por movimentação', () => {
    expect(() => lerNovaMovimentacao({ ...valida, forma: 'ASAAS' }, HOJE)).toThrow(/forma/);
    expect(() => lerNovaMovimentacao({ ...valida, contratoId: CONTRATO, projetoId: PROJETO }, HOJE)).toThrow(/um só cadastro/);
  });

  it('categoria precisa estar ativa e aceitar o tipo (MER, regra 2)', () => {
    expect(() => conferirCategoria('SAIDA', { ativo: true, tipo: 'AMBOS' })).not.toThrow();
    expect(() => conferirCategoria('SAIDA', { ativo: true, tipo: 'ENTRADA' })).toThrow(/só de entrada/);
    expect(() => conferirCategoria('ENTRADA', { ativo: false, tipo: 'ENTRADA' })).toThrow(/inativa/);
    expect(() => conferirCategoria('ENTRADA', null)).toThrow(/não foi encontrada/);
  });

  function montar(referencias: Partial<Awaited<ReturnType<MovimentacoesRepositorio['referenciasDoRegistro']>>> = {}) {
    const gravadas: Array<{ nova: NovaMovimentacao; autorId: string }> = [];
    const repositorio = {
      referenciasDoRegistro: async () => ({
        categoria: { ativo: true, tipo: 'SAIDA' },
        contaAtiva: true,
        vinculoEncontrado: true,
        situacaoDoProjeto: null,
        ...referencias,
      }),
      registrar: async (nova: NovaMovimentacao, autorId: string) => {
        gravadas.push({ nova, autorId });
        return 'mov-1';
      },
    } as unknown as MovimentacoesRepositorio;
    return { casoDeUso: new RegistrarMovimentacao(repositorio), gravadas };
  }

  it('grava com o autor e devolve o id', async () => {
    const { casoDeUso, gravadas } = montar();
    expect(await casoDeUso.executar(valida, 'usuario-1', HOJE)).toEqual({ id: 'mov-1', aviso: null });
    expect(gravadas[0].autorId).toBe('usuario-1');
  });

  it('em projeto executado, aceita e avisa (fluxo A2)', async () => {
    const { casoDeUso } = montar({ situacaoDoProjeto: 'EXECUTADO' });
    expect((await casoDeUso.executar({ ...valida, projetoId: PROJETO }, 'usuario-1', HOJE)).aviso).toMatch(/projeto já executado/);
  });

  // [Cadastros.RF005] E1: "encerrado" é executado OU cancelado (a definição é do Cadastros).
  it.each(['EXECUTADO', 'CANCELADO'] as const)('em projeto %s, aceita e avisa que o projeto está encerrado (fluxo A2)', async (situacaoDoProjeto) => {
    const { casoDeUso, gravadas } = montar({ situacaoDoProjeto });
    const registrada = await casoDeUso.executar({ ...valida, projetoId: PROJETO }, 'usuario-1', HOJE);
    expect(registrada.aviso).toMatch(/projeto encerrado/);
    expect(gravadas).toHaveLength(1);
  });

  it.each(['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO'] as const)('em projeto em andamento (%s), aceita sem aviso', async (situacaoDoProjeto) => {
    const { casoDeUso, gravadas } = montar({ situacaoDoProjeto });
    expect(await casoDeUso.executar({ ...valida, projetoId: PROJETO }, 'usuario-1', HOJE)).toEqual({ id: 'mov-1', aviso: null });
    expect(gravadas).toHaveLength(1);
  });

  it('conta inativa, vínculo inexistente ou categoria incompatível: 400, nada gravado', async () => {
    for (const referencias of [{ contaAtiva: false }, { vinculoEncontrado: false }, { categoria: { ativo: true, tipo: 'ENTRADA' as const } }]) {
      const { casoDeUso, gravadas } = montar(referencias);
      await expect(casoDeUso.executar(valida, 'usuario-1', HOJE)).rejects.toBeInstanceOf(BadRequestException);
      expect(gravadas).toEqual([]);
    }
  });
});

import { BadRequestException } from '@nestjs/common';
import type { OrigemDaCobranca, SituacaoGuardada } from '../dominio/cobranca.js';
import type { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { ObterBoleto } from './obter-boleto.js';

function montar(origem: OrigemDaCobranca, situacao: SituacaoGuardada = 'ABERTA') {
  const obtidos: string[] = [];
  const cobrancas = {
    buscarPorId: async () => ({
      id: 'cob-1',
      origem,
      situacao,
      urlBoleto: origem === 'HERDADA' ? null : 'https://exemplo.com/boleto/ficticio',
      urlFatura: null,
    }),
    registrarObtencaoDoBoleto: async (id: string) => void obtidos.push(id),
  } as unknown as CobrancasRepositorio;
  return { caso: new ObterBoleto(cobrancas), obtidos };
}

describe('ObterBoleto [Cobranças.RF003]', () => {
  it('entrega o link e registra quem obteve', async () => {
    const { caso, obtidos } = montar('MENSALIDADE');
    expect(await caso.executar('cob-1', 'usuario-1')).toEqual({ url: 'https://exemplo.com/boleto/ficticio' });
    expect(obtidos).toEqual(['cob-1']);
  });

  it('herdada da planilha não tem boleto: 400 com o que fazer, sem registrar nada (ADR-0005)', async () => {
    const { caso, obtidos } = montar('HERDADA');
    const pedido = caso.executar('cob-1', 'usuario-1');
    await expect(pedido).rejects.toBeInstanceOf(BadRequestException);
    await expect(pedido).rejects.toThrow(/renegociação/);
    expect(obtidos).toEqual([]);
  });
});

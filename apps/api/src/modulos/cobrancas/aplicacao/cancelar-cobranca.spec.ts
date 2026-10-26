import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import type { SituacaoGuardada } from '../dominio/cobranca.js';
import type { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { CancelarCobranca } from './cancelar-cobranca.js';

function montar(situacao: SituacaoGuardada) {
  const asaas = new ClienteAsaasFalso();
  const canceladasAqui: string[] = [];
  const cobrancas = {
    buscarPorId: async () => ({ id: 'cob-1', idAsaas: 'pay_1', situacao }),
    cancelar: async (id: string) => void canceladasAqui.push(id),
  } as unknown as CobrancasRepositorio;
  return { caso: new CancelarCobranca(cobrancas, asaas), asaas, canceladasAqui };
}

describe('CancelarCobranca [Cobranças.RF004]', () => {
  it('cancela primeiro no Asaas e depois aqui', async () => {
    const { caso, asaas, canceladasAqui } = montar('ABERTA');
    await caso.executar('cob-1', { motivo: 'Renegociação em 3 parcelas' }, 'usuario-1');
    expect(asaas.cobrancasCanceladas).toEqual(['pay_1']);
    expect(canceladasAqui).toEqual(['cob-1']);
  });

  it('Asaas fora do ar: nada muda aqui, para não deixar boleto válido circulando (fluxo E2)', async () => {
    const { caso, asaas, canceladasAqui } = montar('ABERTA');
    asaas.indisponivel = true;
    await expect(caso.executar('cob-1', { motivo: 'Erro de valor' }, 'usuario-1')).rejects.toBeInstanceOf(BadGatewayException);
    expect(canceladasAqui).toEqual([]);
  });

  it('cobrança paga não chega ao Asaas (fluxo E1)', async () => {
    const { caso, asaas } = montar('PAGA');
    await expect(caso.executar('cob-1', { motivo: 'Erro de valor' }, 'usuario-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(asaas.cobrancasCanceladas).toEqual([]);
  });

  it('sem motivo, recusa antes de falar com o Asaas', async () => {
    const { caso, asaas } = montar('ABERTA');
    await expect(caso.executar('cob-1', {}, 'usuario-1')).rejects.toThrow(/motivo/);
    expect(asaas.cobrancasCanceladas).toEqual([]);
  });
});

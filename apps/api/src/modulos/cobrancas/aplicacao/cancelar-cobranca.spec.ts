import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import type { SituacaoGuardada } from '../dominio/cobranca.js';
import type { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { CancelarCobranca } from './cancelar-cobranca.js';

// `herdada`: débito da planilha (ADR-0005), sem id no Asaas.
function montar(situacao: SituacaoGuardada, herdada = false) {
  const asaas = new ClienteAsaasFalso();
  const canceladasAqui: Array<{ id: string; herdada: boolean }> = [];
  const cobrancas = {
    buscarPorId: async () => ({
      id: 'cob-1',
      idAsaas: herdada ? null : 'pay_1',
      origem: herdada ? 'HERDADA' : 'MENSALIDADE',
      situacao,
    }),
    cancelar: async (id: string, _motivo: string, _autorId: string, ehHerdada = false) =>
      void canceladasAqui.push({ id, herdada: ehHerdada }),
  } as unknown as CobrancasRepositorio;
  return { caso: new CancelarCobranca(cobrancas, asaas), asaas, canceladasAqui };
}

describe('CancelarCobranca [Cobranças.RF004]', () => {
  it('cancela primeiro no Asaas e depois aqui', async () => {
    const { caso, asaas, canceladasAqui } = montar('ABERTA');
    await caso.executar('cob-1', { motivo: 'Renegociação em 3 parcelas' }, 'usuario-1');
    expect(asaas.cobrancasCanceladas).toEqual(['pay_1']);
    expect(canceladasAqui).toEqual([{ id: 'cob-1', herdada: false }]);
  });

  it('herdada da planilha: cancela só aqui, sem chamar o Asaas, onde ela não existe (ADR-0005)', async () => {
    const { caso, asaas, canceladasAqui } = montar('ABERTA', true);
    asaas.indisponivel = true; // nem precisa do Asaas no ar
    await caso.executar('cob-1', { motivo: 'Renegociação do débito da planilha' }, 'usuario-1');
    expect(asaas.cobrancasCanceladas).toEqual([]);
    expect(canceladasAqui).toEqual([{ id: 'cob-1', herdada: true }]);
  });

  it('herdada já paga também não pode ser cancelada', async () => {
    const { caso, canceladasAqui } = montar('PAGA_COM_REGISTRO_MANUAL', true);
    await expect(caso.executar('cob-1', { motivo: 'Erro de valor' }, 'usuario-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(canceladasAqui).toEqual([]);
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

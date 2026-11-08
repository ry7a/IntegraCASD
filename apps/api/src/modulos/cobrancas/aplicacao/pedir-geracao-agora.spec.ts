import { BadRequestException } from '@nestjs/common';
import { AgendadorDeRotinasFalso } from '../../../compartilhado/fila/agendador-de-rotinas.falso.js';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import { PedirGeracaoAgora } from './pedir-geracao-agora.js';

const parametros = { valorMensalidadeCentavos: 8500, diaVencimento: 10, diaGeracao: 1, multaPercentual: 2, jurosMensalPercentual: 1 };

function montar() {
  const agendador = new AgendadorDeRotinasFalso();
  const buscarParametros = { executar: async () => parametros } as unknown as BuscarParametrosVigentes;
  return { caso: new PedirGeracaoAgora(buscarParametros, agendador), agendador };
}

describe('PedirGeracaoAgora [Cobranças.RF001]', () => {
  it('sem trava, pede a geração do mês corrente ao worker', async () => {
    const { caso, agendador } = montar();
    expect(await caso.executar('2027-01-31', null)).toEqual({ referencia: '2027-01' });
    expect(agendador.pedidasAgora).toEqual([{ rotina: 'geracao-recorrente', dados: { origem: 'MANUAL' } }]);
  });

  // Trava GERACAO_A_PARTIR_DE: responde o motivo, em vez de aceitar um pedido que o worker não cumpriria.
  it('mês anterior à trava: 400 com o motivo, e nada vai para a fila', async () => {
    const { caso, agendador } = montar();
    const pedido = caso.executar('2027-01-31', '2027-02');
    await expect(pedido).rejects.toBeInstanceOf(BadRequestException);
    await expect(pedido).rejects.toThrow('A geração do sistema começa em fevereiro/2027 (GERACAO_A_PARTIR_DE).');
    expect(agendador.pedidasAgora).toEqual([]);
  });

  it('a partir do mês da trava, o pedido é aceito', async () => {
    const { caso, agendador } = montar();
    expect(await caso.executar('2027-02-01', '2027-02')).toEqual({ referencia: '2027-02' });
    expect(agendador.pedidasAgora).toHaveLength(1);
  });
});

import type { EventoWebhook } from '../../../generated/prisma/client.js';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { AcaoDaConciliacao } from '../dominio/conciliacao.js';
import type { CobrancaParaConciliar, ConciliacaoRepositorio, DestinoDaBaixa } from '../infra/conciliacao.repositorio.js';
import type { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import { DestinoDaBaixaNaoDefinido, ProcessarEventoWebhook } from './processar-evento-webhook.js';

// Dados fictícios (LGPD).
function criarEvento(processadoEm: Date | null, tipo = 'PAYMENT_RECEIVED'): EventoWebhook {
  return {
    id: 'uuid-do-evento',
    idAsaas: 'evt_falso_1',
    tipo,
    payload: { id: 'evt_falso_1', event: tipo, payment: { id: 'pay_falso_1', value: 85, paymentDate: '2026-10-20' } },
    processadoEm,
    pendencia: null,
    dataCriacao: new Date('2026-01-01'),
    dataAlteracao: new Date('2026-01-01'),
  };
}

const cobrancaAberta: CobrancaParaConciliar = {
  id: 'uuid-da-cobranca',
  idAsaas: 'pay_falso_1',
  origem: 'MENSALIDADE',
  descricao: 'Mensalidade 10/2026',
  situacao: 'ABERTA',
  valorCentavos: 8500,
  disponivelEm: null,
  movimentacaoId: null,
};

const parametrosCompletos = {
  contaRecebimentoId: 'uuid-da-conta',
  categoriaMensalidadeId: 'uuid-da-categoria-mensalidade',
  categoriaAvulsaId: 'uuid-da-categoria-avulsa',
};

// Dublês: o repositório de eventos devolve o evento combinado; o da conciliação guarda o que recebeu.
function montar(opcoes: {
  evento: EventoWebhook | null;
  cobranca?: CobrancaParaConciliar | null;
  parametros?: object | null;
  outroProcessouAntes?: boolean;
}) {
  const aplicadas: Array<{ acao: AcaoDaConciliacao; destino: DestinoDaBaixa | null }> = [];
  const eventos = { buscarPorId: async () => opcoes.evento } as unknown as EventosWebhookRepositorio;
  const conciliacao = {
    buscarCobranca: async () => opcoes.cobranca ?? null,
    aplicar: async (_evento: unknown, _cobranca: unknown, acao: AcaoDaConciliacao, destino: DestinoDaBaixa | null) => {
      aplicadas.push({ acao, destino });
      return opcoes.outroProcessouAntes ? 'ja-processado' : 'aplicado';
    },
  } as unknown as ConciliacaoRepositorio;
  const parametros = { executar: async () => opcoes.parametros ?? null } as unknown as BuscarParametrosVigentes;
  return { casoDeUso: new ProcessarEventoWebhook(eventos, conciliacao, parametros), aplicadas };
}

describe('ProcessarEventoWebhook [Cobranças.RF005]', () => {
  it('baixa a cobrança na conta e na categoria escolhidas para a origem dela', async () => {
    const { casoDeUso, aplicadas } = montar({
      evento: criarEvento(null),
      cobranca: cobrancaAberta,
      parametros: parametrosCompletos,
    });

    await expect(casoDeUso.executar('uuid-do-evento', '2026-10-26')).resolves.toBe('processado');
    expect(aplicadas).toEqual([
      {
        acao: { tipo: 'BAIXAR', valorPagoCentavos: 8500, pagoEm: '2026-10-20', disponivelEm: '2026-10-20' },
        destino: { contaId: 'uuid-da-conta', categoriaId: 'uuid-da-categoria-mensalidade' },
      },
    ]);
  });

  it('sem conta ou categoria de recebimento, não aplica nada e falha para a fila tentar de novo', async () => {
    const { casoDeUso, aplicadas } = montar({
      evento: criarEvento(null),
      cobranca: cobrancaAberta,
      parametros: { ...parametrosCompletos, categoriaMensalidadeId: null },
    });

    await expect(casoDeUso.executar('uuid-do-evento')).rejects.toBeInstanceOf(DestinoDaBaixaNaoDefinido);
    expect(aplicadas).toEqual([]);
  });

  it('evento que não é de pagamento é marcado como processado sem efeito', async () => {
    const { casoDeUso, aplicadas } = montar({ evento: criarEvento(null, 'PAYMENT_OVERDUE'), cobranca: cobrancaAberta });

    await expect(casoDeUso.executar('uuid-do-evento')).resolves.toBe('processado');
    expect(aplicadas).toEqual([{ acao: { tipo: 'NADA' }, destino: null }]);
  });

  it('não processa de novo um evento que já foi processado [Confiabilidade.NF003]', async () => {
    const { casoDeUso, aplicadas } = montar({ evento: criarEvento(new Date('2026-01-02')) });

    await expect(casoDeUso.executar('uuid-do-evento')).resolves.toBe('ja-processado');
    expect(aplicadas).toEqual([]);
  });

  it('se outro processamento marcou o evento primeiro, informa que já foi processado', async () => {
    const { casoDeUso } = montar({
      evento: criarEvento(null),
      cobranca: cobrancaAberta,
      parametros: parametrosCompletos,
      outroProcessouAntes: true,
    });

    await expect(casoDeUso.executar('uuid-do-evento')).resolves.toBe('ja-processado');
  });

  it('lança erro se o evento não existe, para a fila tentar de novo', async () => {
    const { casoDeUso } = montar({ evento: null });

    await expect(casoDeUso.executar('uuid-inexistente')).rejects.toThrow('não encontrado');
  });
});

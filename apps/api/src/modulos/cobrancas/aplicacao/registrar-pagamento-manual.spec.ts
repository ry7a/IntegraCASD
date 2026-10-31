import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import { conferirPagamentoManual, lerPagamentoManual, type PagamentoManual } from '../dominio/cobranca.js';
import type { CobrancaRegistrada, CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { RegistrarPagamentoManual } from './registrar-pagamento-manual.js';

const HOJE = '2026-10-26';
const valido = {
  pagoEm: '2026-10-20',
  valorCentavos: 8500,
  formaPagamento: 'PIX',
  justificativa: 'Pix recebido na conta do CASD, comprovante enviado pelo aluno',
};

// Dados fictícios (LGPD).
const cobranca = {
  id: 'uuid-da-cobranca',
  idAsaas: 'pay_falso_1',
  origem: 'AVULSA',
  descricao: 'Camiseta',
  situacao: 'ABERTA',
} as CobrancaRegistrada;

const parametros = {
  contaRecebimentoId: 'uuid-da-conta',
  categoriaMensalidadeId: 'uuid-cat-mensalidade',
  categoriaAvulsaId: 'uuid-cat-avulsa',
};

function montar(opcoes: { cobranca?: CobrancaRegistrada | null; parametros?: object | null } = {}) {
  const registros: Array<{ pagamento: PagamentoManual; destino: object; autorId: string }> = [];
  const repositorio = {
    buscarPorId: async () => (opcoes.cobranca === undefined ? cobranca : opcoes.cobranca),
    registrarPagamentoManual: async (_c: unknown, pagamento: PagamentoManual, destino: object, autorId: string) =>
      void registros.push({ pagamento, destino, autorId }),
  } as unknown as CobrancasRepositorio;
  const buscar = { executar: async () => (opcoes.parametros === undefined ? parametros : opcoes.parametros) } as unknown as BuscarParametrosVigentes;
  return { casoDeUso: new RegistrarPagamentoManual(repositorio, buscar), registros };
}

describe('registrar pagamento manualmente [Cobranças.RF006]', () => {
  it('lê data, valor, forma e justificativa', () => {
    expect(lerPagamentoManual(valido, HOJE)).toEqual(valido);
  });

  it('justificativa é obrigatória (fluxo E1)', () => {
    expect(() => lerPagamentoManual({ ...valido, justificativa: '  ' }, HOJE)).toThrow(/justificativa é obrigatória/);
  });

  it('recusa data no futuro, valor fracionado e forma desconhecida', () => {
    expect(() => lerPagamentoManual({ ...valido, pagoEm: '2026-10-27' }, HOJE)).toThrow(/futuro/);
    expect(() => lerPagamentoManual({ ...valido, valorCentavos: 85.5 }, HOJE)).toThrow(/centavos/);
    expect(() => lerPagamentoManual({ ...valido, formaPagamento: 'ASAAS' }, HOJE)).toThrow(/forma do pagamento/);
  });

  it('só cobrança aberta ou vencida recebe pagamento manual', () => {
    expect(() => conferirPagamentoManual('ABERTA')).not.toThrow();
    expect(() => conferirPagamentoManual('PAGA')).toThrow(/já está paga/);
    expect(() => conferirPagamentoManual('CANCELADA')).toThrow(/só cobrança aberta/);
  });

  it('registra com a conta e a categoria da origem da cobrança, e o autor', async () => {
    const { casoDeUso, registros } = montar();
    await casoDeUso.executar('uuid-da-cobranca', valido, 'usuario-1', HOJE);
    expect(registros).toEqual([
      { pagamento: valido, destino: { contaId: 'uuid-da-conta', categoriaId: 'uuid-cat-avulsa' }, autorId: 'usuario-1' },
    ]);
  });

  it('herdada da planilha: paga à mão, entra na categoria da mensalidade (ADR-0005)', async () => {
    const herdada: CobrancaRegistrada = { ...cobranca, idAsaas: null, origem: 'HERDADA' };
    const { casoDeUso, registros } = montar({ cobranca: herdada });
    await casoDeUso.executar('uuid-da-cobranca', valido, 'usuario-1', HOJE);
    expect(registros).toEqual([
      { pagamento: valido, destino: { contaId: 'uuid-da-conta', categoriaId: 'uuid-cat-mensalidade' }, autorId: 'usuario-1' },
    ]);
  });

  it('sem conta ou categoria nos parâmetros, avisa o que fazer e não grava', async () => {
    const { casoDeUso, registros } = montar({ parametros: { ...parametros, contaRecebimentoId: null } });
    await expect(casoDeUso.executar('uuid-da-cobranca', valido, 'usuario-1', HOJE)).rejects.toThrow(/Administração > Parâmetros/);
    expect(registros).toEqual([]);
  });

  it('cobrança já paga: 400; inexistente: 404', async () => {
    await expect(
      montar({ cobranca: { ...cobranca, situacao: 'PAGA' } }).casoDeUso.executar('x', valido, 'u', HOJE),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(montar({ cobranca: null }).casoDeUso.executar('x', valido, 'u', HOJE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { FiltroDaTrilhaInvalido, ROTINA_AUTOMATICA, intervaloEmSaoPaulo, lerFiltrosDaTrilha } from './trilha.js';

const HOJE = '2026-10-26';
const USUARIO = '11111111-1111-4111-8111-111111111111';

describe('filtros da trilha de auditoria [Administração.RF005]', () => {
  it('sem filtros, o mês corrente até hoje, primeira página de 50', () => {
    expect(lerFiltrosDaTrilha({}, HOJE)).toEqual({
      de: '2026-10-01',
      ate: '2026-10-26',
      usuario: null,
      operacao: null,
      entidade: null,
      registroId: null,
      pagina: 1,
      tamanhoPagina: 50,
    });
  });

  it('aceita usuário, rotina automática, operação, tipo de registro e um registro (fluxo A1)', () => {
    expect(lerFiltrosDaTrilha({ usuario: USUARIO, operacao: 'ESTORNO', entidade: 'MOVIMENTACAO', registroId: 'abc' }, HOJE)).toMatchObject({
      usuario: USUARIO,
      operacao: 'ESTORNO',
      entidade: 'MOVIMENTACAO',
      registroId: 'abc',
    });
    expect(lerFiltrosDaTrilha({ usuario: ROTINA_AUTOMATICA }, HOJE).usuario).toBe(ROTINA_AUTOMATICA);
  });

  it('recusa período invertido, operação desconhecida, usuário inválido e página fora do limite', () => {
    expect(() => lerFiltrosDaTrilha({ de: '2026-10-20', ate: '2026-10-01' }, HOJE)).toThrow(/antes da final/);
    expect(() => lerFiltrosDaTrilha({ operacao: 'APAGAR' }, HOJE)).toThrow(FiltroDaTrilhaInvalido);
    expect(() => lerFiltrosDaTrilha({ usuario: 'Fulano' }, HOJE)).toThrow(/usuário/);
    expect(() => lerFiltrosDaTrilha({ tamanhoPagina: '500' }, HOJE)).toThrow(/200/);
  });

  it('o período cobre os dias inteiros no fuso de São Paulo', () => {
    const { inicio, fim } = intervaloEmSaoPaulo('2026-10-01', '2026-10-26');
    expect(inicio.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-10-27T03:00:00.000Z');
  });
});

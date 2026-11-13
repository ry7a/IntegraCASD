// CT-MOV-03 (sistema, caso de uso): consulta de movimentações pela API, do jeito que a tela faz.
// Os lançamentos também entram pela API. Duas categorias criadas só para este teste isolam o recorte: o banco
// é compartilhado, então os totais exatos só são conferidos com o filtro de categoria ligado.
//
// Sobre "período": a API filtra por mês (?mes=AAAA-MM), que é o período que a tela oferece; sem mês, o corrente.
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import { criarCategoria, criarConta, criarUsuario, diaDeHojeMais, sufixo } from '../../apoio/cenario.js';

const HOJE = diaDeHojeMais(0);
const MES_CORRENTE = HOJE.slice(0, 7);

// Último dia do mês anterior ("dia 0" do mês corrente, na conta de datas do JavaScript).
function ultimoDiaDoMesAnterior(): string {
  const data = new Date(`${MES_CORRENTE}-01T00:00:00Z`);
  data.setUTCDate(0);
  return data.toISOString().slice(0, 10);
}
const DIA_DO_MES_ANTERIOR = ultimoDiaDoMesAnterior();
const MES_ANTERIOR = DIA_DO_MES_ANTERIOR.slice(0, 7);

type Item = { id: string; data: string; tipo: string; valorCentavos: number; origem: string; estornadaEm: string | null };
type Totais = { entradasCentavos: number; quantidadeEntradas: number; saidasCentavos: number; quantidadeSaidas: number; saldoCentavos: number };

describe('[Movimentações.RF003] CT-MOV-03 consulta de movimentações', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;
  let contaId: string;
  // Categoria "ambos" (entradas e saídas) e uma só de saída.
  let categoriaA: string;
  let categoriaB: string;
  const ids: Record<string, string> = {};

  // Lança pela API, como o diálogo "Nova movimentação", e devolve o id.
  async function lancar(tipo: 'ENTRADA' | 'SAIDA', valorCentavos: number, data: string, categoriaId: string): Promise<string> {
    const resposta = await aplicacao
      .http()
      .post('/api/movimentacoes')
      .set('Cookie', cookie)
      .send({ contaId, tipo, valorCentavos, data, categoriaId, forma: 'PIX', descricao: `Lancamento de teste ${sufixo()}` })
      .expect(201);
    return resposta.body.id;
  }

  async function consultar(filtros: string): Promise<{ itens: Item[]; total: number; totais: Totais }> {
    const resposta = await aplicacao.http().get(`/api/movimentacoes${filtros}`).set('Cookie', cookie);
    expect(resposta.status).toBe(200);
    return resposta.body;
  }

  function idsDe(itens: Item[]): string[] {
    return itens.map((item) => item.id).sort();
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const usuario = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    cookie = await entrar(aplicacao, usuario.email, usuario.senha);
    contaId = (await criarConta(aplicacao.prisma)).id;
    categoriaA = (await criarCategoria(aplicacao.prisma, 'AMBOS')).id;
    categoriaB = (await criarCategoria(aplicacao.prisma, 'SAIDA')).id;

    ids.entradaDoMes = await lancar('ENTRADA', 50000, `${MES_CORRENTE}-01`, categoriaA);
    ids.saidaDoMes = await lancar('SAIDA', 12000, HOJE, categoriaA);
    ids.outraSaidaDoMes = await lancar('SAIDA', 3000, HOJE, categoriaA);
    ids.entradaDoMesAnterior = await lancar('ENTRADA', 7000, DIA_DO_MES_ANTERIOR, categoriaA);
    ids.saidaDeOutraCategoria = await lancar('SAIDA', 9900, HOJE, categoriaB);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  it('fluxo FP, passo 2: sem filtro, mostra as movimentações do mês corrente', async () => {
    const { itens } = await consultar('');

    const encontrados = itens.map((item) => item.id);
    expect(encontrados).toEqual(expect.arrayContaining([ids.entradaDoMes, ids.saidaDoMes, ids.outraSaidaDoMes, ids.saidaDeOutraCategoria]));
    expect(encontrados).not.toContain(ids.entradaDoMesAnterior);
    // Todas do mês corrente e das mais recentes para as mais antigas.
    expect(itens.every((item) => item.data.startsWith(MES_CORRENTE))).toBe(true);
    const datas = itens.map((item) => item.data);
    expect(datas).toEqual([...datas].sort().reverse());
  });

  it('fluxo FP, passos 3 e 4: período (mês corrente) e categoria, com totais de entrada, saída e resultado', async () => {
    const { itens, total, totais } = await consultar(`?mes=${MES_CORRENTE}&categoriaId=${categoriaA}`);

    expect(idsDe(itens)).toEqual([ids.entradaDoMes, ids.saidaDoMes, ids.outraSaidaDoMes].sort());
    expect(total).toBe(3);
    expect(totais).toEqual({ entradasCentavos: 50000, quantidadeEntradas: 1, saidasCentavos: 15000, quantidadeSaidas: 2, saldoCentavos: 35000 });
    // Cada linha traz o que a tela mostra: data, descrição, categoria, forma, origem, conta e valor.
    expect(itens[0]).toEqual(
      expect.objectContaining({
        data: expect.any(String),
        descricao: expect.any(String),
        categoriaNome: expect.any(String),
        forma: 'PIX',
        origem: 'MANUAL',
        contaNome: expect.any(String),
        valorCentavos: expect.any(Number),
      }),
    );
  });

  it('fluxo FP, passos 3 e 4: outro período (mês anterior) na mesma categoria traz só o lançamento daquele mês', async () => {
    const { itens, totais } = await consultar(`?mes=${MES_ANTERIOR}&categoriaId=${categoriaA}`);

    expect(idsDe(itens)).toEqual([ids.entradaDoMesAnterior]);
    expect(totais).toEqual({ entradasCentavos: 7000, quantidadeEntradas: 1, saidasCentavos: 0, quantidadeSaidas: 0, saldoCentavos: 7000 });
  });

  it('fluxo FP, passos 3 e 4: outra categoria no mesmo período, e categoria combinada com tipo', async () => {
    const outraCategoria = await consultar(`?mes=${MES_CORRENTE}&categoriaId=${categoriaB}`);
    expect(idsDe(outraCategoria.itens)).toEqual([ids.saidaDeOutraCategoria]);
    expect(outraCategoria.totais).toEqual({
      entradasCentavos: 0,
      quantidadeEntradas: 0,
      saidasCentavos: 9900,
      quantidadeSaidas: 1,
      saldoCentavos: -9900,
    });

    const soSaidas = await consultar(`?mes=${MES_CORRENTE}&categoriaId=${categoriaA}&tipo=SAIDA`);
    expect(idsDe(soSaidas.itens)).toEqual([ids.saidaDoMes, ids.outraSaidaDoMes].sort());
    expect(soSaidas.totais).toMatchObject({ entradasCentavos: 0, saidasCentavos: 15000, saldoCentavos: -15000 });
  });

  it('fluxo FP: a consulta não altera o estado do sistema', async () => {
    const movimentacoesAntes = await aplicacao.prisma.movimentacao.count();
    const trilhaAntes = await aplicacao.prisma.registroAuditoria.count();

    await consultar('');
    await consultar(`?mes=${MES_CORRENTE}&categoriaId=${categoriaA}`);
    await consultar(`?mes=${MES_ANTERIOR}&categoriaId=${categoriaA}&tipo=ENTRADA`);

    expect(await aplicacao.prisma.movimentacao.count()).toBe(movimentacoesAntes);
    expect(await aplicacao.prisma.registroAuditoria.count()).toBe(trilhaAntes);
  });

  it('saída do caso de uso: a estornada aparece sinalizada junto ao espelho, e o par sai dos totais', async () => {
    await aplicacao
      .http()
      .post(`/api/movimentacoes/${ids.outraSaidaDoMes}/estornar`)
      .set('Cookie', cookie)
      .send({ motivo: 'Lançamento duplicado no teste' })
      .expect(200);

    const { itens, totais } = await consultar(`?mes=${MES_CORRENTE}&categoriaId=${categoriaA}`);

    const estornada = itens.find((item) => item.id === ids.outraSaidaDoMes);
    const espelho = itens.find((item) => item.origem === 'ESTORNO');
    expect(estornada?.estornadaEm).toBe(HOJE);
    expect(espelho).toMatchObject({ tipo: 'ENTRADA', valorCentavos: 3000 });
    expect(totais).toEqual({ entradasCentavos: 50000, quantidadeEntradas: 1, saidasCentavos: 12000, quantidadeSaidas: 1, saldoCentavos: 38000 });
  });
});

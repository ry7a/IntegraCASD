import {
  CobrancaInvalida,
  aceitaOperacoes,
  conferirBoletoDisponivel,
  conferirCobrancaNoAsaas,
  existeNoAsaas,
  conferirCancelamento,
  lerMotivoDoCancelamento,
  conferirAlunoCobravel,
  diasDeAtraso,
  lerFiltrosDaConsulta,
  lerNovaCobrancaAvulsa,
  situacaoExibida,
  vencimentoSugerido,
} from './cobranca.js';

const HOJE = '2026-10-26';
const entrada = {
  alunoId: '9b1df4c7-3820-4f1c-addb-5549c2ce2d21',
  valorCentavos: 4500,
  vencimento: '2026-11-10',
  descricao: '  Camiseta   do CASD ',
};

describe('cobrança avulsa [Cobranças.RF002]', () => {
  it('aceita a entrada e limpa a descrição', () => {
    expect(lerNovaCobrancaAvulsa(entrada, HOJE)).toEqual({ ...entrada, descricao: 'Camiseta do CASD', renegociacaoDeId: null });
  });

  it('recusa vencimento no passado (fluxo E2), mas aceita hoje', () => {
    expect(() => lerNovaCobrancaAvulsa({ ...entrada, vencimento: '2026-10-25' }, HOJE)).toThrow(/anterior a hoje/);
    expect(lerNovaCobrancaAvulsa({ ...entrada, vencimento: HOJE }, HOJE).vencimento).toBe(HOJE);
  });

  it('valor em centavos, inteiro e positivo', () => {
    expect(() => lerNovaCobrancaAvulsa({ ...entrada, valorCentavos: 45.5 }, HOJE)).toThrow(CobrancaInvalida);
    expect(() => lerNovaCobrancaAvulsa({ ...entrada, valorCentavos: 0 }, HOJE)).toThrow(CobrancaInvalida);
  });

  it('exige o aluno escolhido na lista', () => {
    expect(() => lerNovaCobrancaAvulsa({ ...entrada, alunoId: 'Ana' }, HOJE)).toThrow(/lista/);
  });
});

describe('vencimento sugerido e situação exibida', () => {
  it('sugere o próximo dia de vencimento a partir de hoje', () => {
    expect(vencimentoSugerido('2026-10-05', 10)).toBe('2026-10-10');
    expect(vencimentoSugerido('2026-12-26', 10)).toBe('2027-01-10');
  });

  it('aberta com vencimento passado aparece como VENCIDA', () => {
    expect(situacaoExibida('ABERTA', '2026-10-25', HOJE)).toBe('VENCIDA');
    expect(situacaoExibida('ABERTA', HOJE, HOJE)).toBe('ABERTA');
    expect(situacaoExibida('PAGA', '2026-10-01', HOJE)).toBe('PAGA');
  });
});

describe('aluno cobrável (fluxo A1)', () => {
  it('aluno inativo não recebe cobrança', () => {
    expect(() => conferirAlunoCobravel({ ativo: false, cadastroIncompleto: false, email: 'a@exemplo.com' })).toThrow(/inativo/);
  });

  it('cadastro incompleto diz o que falta', () => {
    expect(() => conferirAlunoCobravel({ ativo: true, cadastroIncompleto: true, email: '' })).toThrow(/falta o e-mail/);
    expect(() => conferirAlunoCobravel({ ativo: true, cadastroIncompleto: true, email: 'a@exemplo.com' })).toThrow(/CPF válido/);
  });
});

describe('consulta [Cobranças.RF008]', () => {
  it('sem filtro de situação, mostra abertas e vencidas', () => {
    expect(lerFiltrosDaConsulta({}).situacoes).toEqual(['ABERTA', 'VENCIDA']);
  });

  it('lê as situações separadas por vírgula e recusa as desconhecidas', () => {
    expect(lerFiltrosDaConsulta({ situacoes: 'PAGA,CANCELADA' }).situacoes).toEqual(['PAGA', 'CANCELADA']);
    expect(() => lerFiltrosDaConsulta({ situacoes: 'QUITADA' })).toThrow(/desconhecida/);
  });

  it('lê a página pedida pela tela; sem ela, a primeira', () => {
    expect(lerFiltrosDaConsulta({ pagina: '3', tamanhoPagina: '50' })).toMatchObject({ pagina: 3, tamanhoPagina: 50 });
    expect(lerFiltrosDaConsulta({}).pagina).toBe(1);
  });

  it('limita o tamanho da página e lê valores em centavos', () => {
    const filtros = lerFiltrosDaConsulta({ tamanhoPagina: '1000', valorMinimoCentavos: '5000' });
    expect(filtros.tamanhoPagina).toBe(200);
    expect(filtros.valorMinimoCentavos).toBe(5000);
    expect(() => lerFiltrosDaConsulta({ vencimentoDe: '10/11/2026' })).toThrow(/AAAA-MM-DD/);
  });

  it('recusa período de vencimento com data que não existe no calendário, citando o filtro', () => {
    expect(() => lerFiltrosDaConsulta({ vencimentoDe: '2026-13-45' })).toThrow(/início do período.*não existe no calendário/);
    expect(() => lerFiltrosDaConsulta({ vencimentoAte: '2026-00-10' })).toThrow(/fim do período.*não existe no calendário/);
    expect(() => lerFiltrosDaConsulta({ vencimentoDe: '2026-02-30' })).toThrow(CobrancaInvalida);
    expect(lerFiltrosDaConsulta({ vencimentoDe: '2028-02-29' }).vencimentoDe).toBe('2028-02-29');
  });

  it('recusa valor e página acima do maior inteiro do banco, citando o filtro', () => {
    expect(() => lerFiltrosDaConsulta({ valorMaximoCentavos: '99999999999999999999' })).toThrow(/valor máximo/);
    expect(() => lerFiltrosDaConsulta({ valorMinimoCentavos: '2147483648' })).toThrow(/valor mínimo/);
    expect(() => lerFiltrosDaConsulta({ pagina: '99999999999999999999' })).toThrow(/página/);
    expect(() => lerFiltrosDaConsulta({ tamanhoPagina: '99999999999999999999' })).toThrow(/tamanho da página/);
    expect(lerFiltrosDaConsulta({ valorMaximoCentavos: '2147483647' }).valorMaximoCentavos).toBe(2_147_483_647);
    expect(lerFiltrosDaConsulta({ valorMinimoCentavos: '0' }).valorMinimoCentavos).toBe(0);
  });

  it('dias de atraso só para vencida', () => {
    expect(diasDeAtraso('VENCIDA', '2026-10-16', HOJE)).toBe(10);
    expect(diasDeAtraso('ABERTA', '2026-11-10', HOJE)).toBeNull();
  });

  it('só cobrança aberta aceita cancelar e pagamento manual', () => {
    expect(aceitaOperacoes('ABERTA')).toBe(true);
    expect(aceitaOperacoes('PAGA')).toBe(false);
  });
});

describe('boleto [Cobranças.RF003]', () => {
  it('só cobrança aberta tem boleto; paga ou cancelada informa a situação (fluxo E1)', () => {
    expect(() => conferirBoletoDisponivel('ABERTA')).not.toThrow();
    expect(() => conferirBoletoDisponivel('PAGA')).toThrow(/está paga/);
    expect(() => conferirBoletoDisponivel('CANCELADA')).toThrow(/está cancelada/);
  });
});

describe('cobrança herdada da planilha (ADR-0005)', () => {
  it('só a herdada não existe no Asaas', () => {
    expect(existeNoAsaas('HERDADA')).toBe(false);
    expect(existeNoAsaas('MENSALIDADE')).toBe(true);
    expect(existeNoAsaas('AVULSA')).toBe(true);
  });

  it('herdada não tem boleto nem sincronização, e a mensagem diz o que fazer', () => {
    expect(() => conferirCobrancaNoAsaas('HERDADA')).toThrow(/renegociação/);
    expect(() => conferirCobrancaNoAsaas('MENSALIDADE')).not.toThrow();
  });
});

describe('cancelamento [Cobranças.RF004]', () => {
  it('cobrança paga não se cancela: a devolução é pelo Asaas (fluxo E1)', () => {
    expect(() => conferirCancelamento('PAGA')).toThrow(/devolução do valor é feita pelo Asaas/);
    expect(() => conferirCancelamento('CANCELADA')).toThrow(/já está cancelada/);
    expect(() => conferirCancelamento('ABERTA')).not.toThrow();
  });

  it('o motivo é obrigatório', () => {
    expect(() => lerMotivoDoCancelamento('  ')).toThrow(/motivo/);
    expect(lerMotivoDoCancelamento(' Renegociação   em 3 parcelas ')).toBe('Renegociação em 3 parcelas');
  });
});

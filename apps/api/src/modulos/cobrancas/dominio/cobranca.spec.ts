import {
  CobrancaInvalida,
  conferirAlunoCobravel,
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
    expect(lerNovaCobrancaAvulsa(entrada, HOJE)).toEqual({ ...entrada, descricao: 'Camiseta do CASD' });
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

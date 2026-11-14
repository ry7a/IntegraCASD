import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { AlunoDetalhe, BuscarAluno } from '../../cadastros/index.js';
import type { CobrancasRepositorio, DadosDaNovaCobranca } from '../infra/cobrancas.repositorio.js';
import { EmitirCobrancaAvulsa } from './emitir-cobranca-avulsa.js';
import { GarantirClienteAsaas } from './garantir-cliente-asaas.js';

// Dados fictícios (LGPD). O CPF só respeita os dígitos verificadores.
const HOJE = '2026-10-26';
const ALUNO_ID = '9b1df4c7-3820-4f1c-addb-5549c2ce2d21';
const aluno = {
  id: ALUNO_ID,
  nome: 'Ana Ficticia',
  cpf: '52998224725',
  email: 'ana@exemplo.com',
  ativo: true,
  cadastroIncompleto: false,
} as AlunoDetalhe;
const parametros = { valorMensalidadeCentavos: 8500, diaVencimento: 10, diaGeracao: 1, multaPercentual: 2, jurosMensalPercentual: 1 };
const entrada = { alunoId: ALUNO_ID, valorCentavos: 4500, vencimento: '2026-11-10', descricao: 'Camiseta do CASD' };

function montar(opcoes: { aluno?: AlunoDetalhe; semParametros?: boolean } = {}) {
  const asaas = new ClienteAsaasFalso();
  const gravadas: DadosDaNovaCobranca[] = [];
  const clientes = new Map<string, string>();
  const repositorio = {
    idClienteAsaasDoAluno: async (id: string) => clientes.get(id) ?? null,
    registrarClienteAsaas: async (id: string, idAsaas: string) => void clientes.set(id, idAsaas),
    registrar: async (dados: DadosDaNovaCobranca) => {
      gravadas.push(dados);
      return { ...dados, id: `cob-${gravadas.length}`, alunoNome: aluno.nome, situacao: 'ABERTA', pagaEm: null };
    },
  } as unknown as CobrancasRepositorio;
  const buscarAluno = { executar: async () => opcoes.aluno ?? aluno } as unknown as BuscarAluno;
  const buscarParametros = { executar: async () => (opcoes.semParametros ? null : parametros) } as unknown as BuscarParametrosVigentes;
  const caso = new EmitirCobrancaAvulsa(repositorio, asaas, buscarAluno, buscarParametros, new GarantirClienteAsaas(repositorio, asaas));
  return { caso, asaas, gravadas };
}

describe('EmitirCobrancaAvulsa [Cobranças.RF002]', () => {
  it('cria no Asaas com multa e juros vigentes e só então grava aqui, com o id do Asaas', async () => {
    const { caso, asaas, gravadas } = montar();
    await caso.executar(entrada, 'usuario-1', HOJE);
    expect(asaas.cobrancasCriadas).toEqual([
      expect.objectContaining({ valorEmCentavos: 4500, multaPercentual: 2, jurosMensalPercentual: 1 }),
    ]);
    expect(gravadas).toEqual([expect.objectContaining({ idAsaas: 'pay_falso_1', origem: 'AVULSA', referencia: null })]);
  });

  it('cria o cliente do aluno no Asaas só na primeira cobrança', async () => {
    const { caso, asaas } = montar();
    await caso.executar(entrada, 'usuario-1', HOJE);
    await caso.executar(entrada, 'usuario-1', HOJE);
    expect(asaas.clientesCriados).toHaveLength(1);
    expect(asaas.cobrancasCriadas).toHaveLength(2);
  });

  it('Asaas fora do ar: nada é gravado e o erro volta na hora (fluxo E1) [Confiabilidade.NF005]', async () => {
    const { caso, asaas, gravadas } = montar();
    asaas.indisponivel = true;
    await expect(caso.executar(entrada, 'usuario-1', HOJE)).rejects.toBeInstanceOf(BadGatewayException);
    expect(gravadas).toEqual([]);
  });

  it('cadastro incompleto não chega ao Asaas (fluxo A1)', async () => {
    const { caso, asaas } = montar({ aluno: { ...aluno, email: '', cadastroIncompleto: true } });
    await expect(caso.executar(entrada, 'usuario-1', HOJE)).rejects.toThrow(/falta o e-mail/);
    expect(asaas.clientesCriados).toEqual([]);
  });

  it('sem parâmetros de cobrança cadastrados, recusa com orientação', async () => {
    const { caso } = montar({ semParametros: true });
    await expect(caso.executar(entrada, 'usuario-1', HOJE)).rejects.toBeInstanceOf(BadRequestException);
  });

  // [Confiabilidade.NF005] Entrada recusada nunca chega ao Asaas: nem o cliente nem a cobrança são criados
  // lá, e nada é gravado aqui. Antes, 30/02 ia ao Asaas como 30/02 e era gravado aqui como 02/03; mês 13,
  // valor acima do limite e caractere nulo davam erro 500 depois de a cobrança já existir no Asaas.
  // A mensagem cita o campo a corrigir ([Usabilidade.NF002]).
  it.each([
    { caso: 'vencimento em 30 de fevereiro', troca: { vencimento: '2027-02-30' }, campo: /vencimento/ },
    { caso: 'vencimento em 31 de abril', troca: { vencimento: '2027-04-31' }, campo: /vencimento/ },
    { caso: 'vencimento no mês 13', troca: { vencimento: '2027-13-01' }, campo: /vencimento/ },
    { caso: 'vencimento no mês 00', troca: { vencimento: '2027-00-10' }, campo: /vencimento/ },
    { caso: 'valor acima do inteiro do banco (2^31 centavos)', troca: { valorCentavos: 2_147_483_648 }, campo: /valor/ },
    { caso: 'valor 1e21 centavos', troca: { valorCentavos: 1e21 }, campo: /valor/ },
    { caso: 'descrição com caractere nulo no meio', troca: { descricao: 'Camiseta\u0000 do CASD' }, campo: /descrição/ },
  ])('$caso: recusa antes de falar com o Asaas', async ({ troca, campo }) => {
    const { caso, asaas, gravadas } = montar();
    await expect(caso.executar({ ...entrada, ...troca }, 'usuario-1', HOJE)).rejects.toThrow(campo);
    expect(asaas.clientesCriados).toEqual([]);
    expect(asaas.cobrancasCriadas).toEqual([]);
    expect(gravadas).toEqual([]);
  });
});

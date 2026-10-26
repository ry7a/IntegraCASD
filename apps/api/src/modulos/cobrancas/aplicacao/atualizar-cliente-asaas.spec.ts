import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import { EventosInternos } from '../../../compartilhado/eventos/eventos-internos.js';
import { AgendadorDeRotinasFalso } from '../../../compartilhado/fila/agendador-de-rotinas.falso.js';
import type { BuscarAluno } from '../../cadastros/index.js';
import type { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { ReacaoAAlunoAlterado } from '../infra/reacao-a-aluno-alterado.js';
import { AtualizarClienteAsaas } from './atualizar-cliente-asaas.js';

// Dados fictícios (LGPD). O CPF só respeita os dígitos verificadores.
function montar(clienteDoAluno: string | null) {
  const asaas = new ClienteAsaasFalso();
  const cobrancas = { idClienteAsaasDoAluno: async () => clienteDoAluno } as unknown as CobrancasRepositorio;
  const buscarAluno = {
    executar: async () => ({ id: 'a1', nome: 'Ana Ficticia', cpf: '52998224725', email: 'nova@exemplo.com' }),
  } as unknown as BuscarAluno;
  return { asaas, caso: new AtualizarClienteAsaas(cobrancas, asaas, buscarAluno) };
}

describe('atualizar o cliente no Asaas quando o aluno muda', () => {
  it('manda ao Asaas o nome, o CPF e o e-mail atuais do aluno', async () => {
    const { asaas, caso } = montar('cus_1');
    expect(await caso.executar('a1')).toBe('atualizado');
    expect(asaas.clientesAtualizados).toEqual([
      { idAsaas: 'cus_1', dados: { nome: 'Ana Ficticia', cpf: '52998224725', email: 'nova@exemplo.com' } },
    ]);
  });

  it('aluno que nunca teve cobrança não tem cliente no Asaas: nada a fazer', async () => {
    const { asaas, caso } = montar(null);
    expect(await caso.executar('a1')).toBe('sem-cliente');
    expect(asaas.clientesAtualizados).toEqual([]);
  });

  it('Asaas fora do ar: o erro sobe para o pg-boss tentar de novo', async () => {
    const { asaas, caso } = montar('cus_1');
    asaas.indisponivel = true;
    await expect(caso.executar('a1')).rejects.toThrow(/fora do ar/);
  });

  it('o evento "aluno alterado" vira um pedido na fila, sem chamar o Asaas na hora', async () => {
    const eventos = new EventosInternos();
    const agendador = new AgendadorDeRotinasFalso();
    const { asaas, caso } = montar('cus_1');
    new ReacaoAAlunoAlterado(eventos, agendador, caso).onModuleInit();

    await eventos.publicar({ tipo: 'aluno-alterado', alunoId: 'a1' });

    expect(agendador.pedidasAgora).toEqual([{ rotina: 'atualizar-cliente-asaas', dados: { alunoId: 'a1' } }]);
    expect(asaas.clientesAtualizados).toEqual([]);
  });
});

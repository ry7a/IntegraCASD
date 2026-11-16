// CT-COB-03 (integração, transição de estados): obter o boleto de uma cobrança pela rota HTTP, com banco real.
// Só a cobrança "em aberto" (Aberta, ou Vencida, que é uma aberta com o vencimento já passado) oferece o
// boleto; nos demais estados a operação é tentada e precisa ser recusada (fluxo E1). Os estados são
// alcançados pelas rotas reais (sincronização, registro manual, cancelamento), como na Figura 3.1 do plano.
//
// O reenvio do boleto por e-mail saiu do MVP na v1.2 dos requisitos (issue #29 do GitHub): o caso cobre só
// a obtenção do boleto.
import type { Cobranca } from '../../../src/generated/prisma/client.js';
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  type UsuarioDeTeste,
  criarAluno,
  criarCobrancaAberta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
} from '../../apoio/cenario.js';
import { cancelarCobranca, pagarNoAsaasESincronizar, registrarPagamentoManual } from './apoio-de-cobrancas.js';

type EventoDoHistorico = { descricao: string; origem: 'ASAAS' | 'USUARIO'; ocorridoEm: string };

describe('[Cobranças.RF003] CT-COB-03 obter o boleto de uma cobrança', () => {
  let aplicacao: AplicacaoDeTeste;
  let atendente: UsuarioDeTeste;
  let nomeDoAtendente: string;
  let cookie: string;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma);
    await definirParametros(aplicacao.prisma, diretor.id);
    atendente = await criarUsuario(aplicacao.prisma, 'ADMINISTRATIVO');
    nomeDoAtendente = (await aplicacao.prisma.usuario.findUniqueOrThrow({ where: { id: atendente.id } })).nome;
    cookie = await entrar(aplicacao, atendente.email, atendente.senha);
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // Cobrança aberta que existe no Asaas, com o link do boleto que o Asaas devolve na emissão
  // (a fábrica não grava os links, então o teste completa).
  async function cobrancaComBoleto(vencimento = diaDeHojeMais(10)): Promise<Cobranca> {
    const aluno = await criarAluno(aplicacao.prisma);
    const cobranca = await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: aluno.id, vencimento });
    return aplicacao.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        urlBoleto: `https://asaas.falso/boleto/${cobranca.idAsaas}`,
        urlFatura: `https://asaas.falso/fatura/${cobranca.idAsaas}`,
      },
    });
  }

  function obterBoleto(cobrancaId: string) {
    return aplicacao.http().post(`/api/cobrancas/${cobrancaId}/boleto`).set('Cookie', cookie).send();
  }

  async function obtencoesNaTrilha(cobrancaId: string) {
    return aplicacao.prisma.registroAuditoria.findMany({
      where: { entidade: 'COBRANCA', registroId: cobrancaId, operacao: 'OBTENCAO_DE_BOLETO' },
    });
  }

  // E1: o boleto não sai, a resposta diz a situação atual e nada entra no histórico.
  async function conferirBoletoRecusado(cobrancaId: string, situacaoNaMensagem: string) {
    const resposta = await obterBoleto(cobrancaId);

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toBe(`Esta cobrança está ${situacaoNaMensagem}: o boleto não vale mais e não é disponibilizado.`);
    expect(resposta.body.url).toBeUndefined();
    expect(await obtencoesNaTrilha(cobrancaId)).toHaveLength(0);
  }

  it('FP: cobrança Aberta entrega o link do boleto e o histórico registra a obtenção, com autor, data e hora', async () => {
    const cobranca = await cobrancaComBoleto();

    const resposta = await obterBoleto(cobranca.id);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ url: cobranca.urlBoleto });

    // Caixa cinza: a trilha guarda quem obteve o boleto e quando.
    const trilha = await obtencoesNaTrilha(cobranca.id);
    expect(trilha).toHaveLength(1);
    expect(trilha[0].usuarioId).toBe(atendente.id);
    expect(trilha[0].ocorridoEm).toBeInstanceOf(Date);

    // E o histórico do detalhe da cobrança mostra a operação com o nome do autor.
    const detalhe = await aplicacao.http().get(`/api/cobrancas/${cobranca.id}`).set('Cookie', cookie);
    expect(detalhe.status).toBe(200);
    const eventos = detalhe.body.eventos as EventoDoHistorico[];
    expect(eventos).toContainEqual(
      expect.objectContaining({ origem: 'USUARIO', descricao: expect.stringMatching(/Boleto obtido/) }),
    );
    expect(eventos.find((evento) => evento.descricao.includes('Boleto obtido'))?.descricao).toContain(nomeDoAtendente);
  });

  it('FP: cobrança Vencida (aberta com o vencimento passado) também entrega o boleto', async () => {
    const cobranca = await cobrancaComBoleto(diaDeHojeMais(-5));
    const detalhe = await aplicacao.http().get(`/api/cobrancas/${cobranca.id}`).set('Cookie', cookie);
    expect(detalhe.body.situacao).toBe('VENCIDA');

    const resposta = await obterBoleto(cobranca.id);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ url: cobranca.urlBoleto });
    expect(await obtencoesNaTrilha(cobranca.id)).toHaveLength(1);
  });

  it('E1: cobrança Paga não oferece o boleto e informa a situação', async () => {
    const cobranca = await cobrancaComBoleto();
    await pagarNoAsaasESincronizar(aplicacao, aplicacao.asaas, cookie, cobranca);
    expect((await aplicacao.prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).situacao).toBe('PAGA');

    await conferirBoletoRecusado(cobranca.id, 'paga');
  });

  it('E1: cobrança Paga com registro manual não oferece o boleto e informa a situação', async () => {
    const cobranca = await cobrancaComBoleto();
    await registrarPagamentoManual(aplicacao, cookie, cobranca.id);

    await conferirBoletoRecusado(cobranca.id, 'paga com registro manual');
  });

  it('E1: cobrança Cancelada não oferece o boleto e informa a situação', async () => {
    const cobranca = await cobrancaComBoleto();
    await cancelarCobranca(aplicacao, cookie, cobranca.id);

    await conferirBoletoRecusado(cobranca.id, 'cancelada');
  });
});

// CT-NF-05 (integração, caixa branca). Geração recorrente para 1.000 alunos ativos com o Cliente Asaas HTTP DE
// VERDADE, apontado para um "Asaas" falso que roda neste processo e responde 429 de vez em quando:
// - [Desempenho.NF005]: no 429 o cliente espera o tempo informado, repete, e a rotina continua sem perder ninguém;
// - [Desempenho.NF004]: a geração termina em até 30 minutos e usa no máximo 2.500 requisições (10% da cota de 25.000).
//
// O ritmo entre os alunos é o de produção (300 ms), então este teste leva uns 6 minutos. Para pular enquanto
// trabalha em outra coisa: $env:PULAR_CT_NF_05='1'. Na execução que vale como evidência, não pule.
import { randomUUID } from 'node:crypto';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ClienteAsaasHttp } from '../../../src/compartilhado/asaas/cliente-asaas.http.js';
import { hojeEmSaoPaulo } from '../../../src/compartilhado/datas.js';
import { GerarCobrancasRecorrentes } from '../../../src/modulos/cobrancas/aplicacao/gerar-cobrancas-recorrentes.js';
import { type AplicacaoDeTeste, subirAplicacao } from '../../apoio/aplicacao.js';
import { criarUsuario, definirParametros, gerarCpf } from '../../apoio/cenario.js';

const QUANTIDADE_DE_ALUNOS = 1000;
const LIMITE_DE_REQUISICOES = 2500;
const LIMITE_DE_DURACAO_EM_MS = 30 * 60 * 1000;
const CHAVE_DE_TESTE = 'chave-do-asaas-falso-da-carga';

// Contagem do que o "Asaas" recebeu.
const recebido = { total: 0, respostas429: 0, clientes: 0, cobrancas: 0, semChave: 0 };

function responderJson(resposta: ServerResponse, status: number, corpo: object, cabecalhos: Record<string, string> = {}) {
  resposta.writeHead(status, { 'Content-Type': 'application/json', ...cabecalhos });
  resposta.end(JSON.stringify(corpo));
}

// Um Asaas mínimo: cria clientes e cobranças e, a cada 100 requisições, responde 429 pedindo 1 s de espera
// (cabeçalho RateLimit-Reset), como o Asaas faz quando a conta passa do limite de frequência.
function subirAsaasFalsoHttp(): Promise<Server> {
  const marca = randomUUID().slice(0, 8);
  const servidor = createServer((requisicao, resposta) => {
    requisicao.resume();
    requisicao.on('end', () => {
      recebido.total += 1;
      if (requisicao.headers.access_token !== CHAVE_DE_TESTE) recebido.semChave += 1;
      if (recebido.total % 100 === 0) {
        recebido.respostas429 += 1;
        responderJson(resposta, 429, { errors: [{ code: 'too_many_requests' }] }, { 'RateLimit-Reset': '1' });
        return;
      }
      if (requisicao.method === 'POST' && requisicao.url === '/customers') {
        recebido.clientes += 1;
        responderJson(resposta, 200, { id: `cus_carga_${recebido.clientes}_${marca}` });
        return;
      }
      if (requisicao.method === 'POST' && requisicao.url === '/payments') {
        recebido.cobrancas += 1;
        responderJson(resposta, 200, { id: `pay_carga_${recebido.cobrancas}_${marca}`, bankSlipUrl: null, invoiceUrl: null });
        return;
      }
      responderJson(resposta, 404, { errors: [{ code: 'not_found' }] });
    });
  });
  return new Promise((resolver) => servidor.listen(0, '127.0.0.1', () => resolver(servidor)));
}

describe.skipIf(process.env.PULAR_CT_NF_05 === '1')(
  '[Desempenho.NF004] [Desempenho.NF005] CT-NF-05 geração recorrente para 1.000 alunos com 429 do Asaas',
  () => {
    let servidorDoAsaas: Server;
    let aplicacao: AplicacaoDeTeste;
    const meusAlunos: string[] = [];

    beforeAll(async () => {
      servidorDoAsaas = await subirAsaasFalsoHttp();
      const { port } = servidorDoAsaas.address() as AddressInfo;
      // O cliente HTTP real, o mesmo da produção, só que falando com o servidor falso acima.
      aplicacao = await subirAplicacao({ clienteAsaas: new ClienteAsaasHttp({ urlBase: `http://127.0.0.1:${port}`, chaveApi: CHAVE_DE_TESTE }) });

      const diretor = await criarUsuario(aplicacao.prisma);
      await definirParametros(aplicacao.prisma, diretor.id);
      // A base do teste são exatamente 1.000 alunos ativos: os que outros arquivos deixaram ativos neste banco
      // de teste são inativados (inativar, e não apagar: o banco recusaria). Os outros arquivos já terminaram.
      await aplicacao.prisma.aluno.updateMany({ where: { ativo: true }, data: { ativo: false } });
      const cpfs = new Set<string>();
      while (cpfs.size < QUANTIDADE_DE_ALUNOS) cpfs.add(gerarCpf());
      const dados = [...cpfs].map((cpf, posicao) => ({
        id: randomUUID(),
        nome: `Aluno Ficticio Carga ${posicao + 1}`,
        cpf,
        email: `carga.${posicao + 1}.${cpf.slice(0, 4)}@exemplo.com`,
      }));
      await aplicacao.prisma.aluno.createMany({ data: dados });
      meusAlunos.push(...dados.map((aluno) => aluno.id));
    });

    afterAll(async () => {
      await aplicacao?.encerrar();
      await new Promise((resolver) => servidorDoAsaas?.close(resolver));
    });

    it(
      'gera uma mensalidade para cada um dos 1.000 alunos, repete os 429 sem perder ninguém, em até 30 min e até 2.500 requisições',
      async () => {
        const inicio = Date.now();
        const resultado = await aplicacao.app.get(GerarCobrancasRecorrentes).executar('MANUAL', hojeEmSaoPaulo(), null);
        const duracaoEmMs = Date.now() - inicio;

        // process.stdout em vez de console.log: a regra B11 do lint barra console (veja docs/governanca).
        process.stdout.write(
          [
            `CT-NF-05: geração recorrente para ${QUANTIDADE_DE_ALUNOS} alunos (Cliente Asaas HTTP real, Asaas falso com 429)`,
            `  criadas ${resultado?.totalCriadas} | falhas ${resultado?.totalFalhas} | interrompida ${resultado?.interrompida}`,
            `  requisições ao Asaas ${recebido.total} (limite ${LIMITE_DE_REQUISICOES}) | respostas 429 ${recebido.respostas429}`,
            `  duração ${(duracaoEmMs / 60_000).toFixed(1)} min (limite 30 min)\n`,
          ].join('\n'),
        );

        expect(resultado).toMatchObject({ totalCriadas: QUANTIDADE_DE_ALUNOS, totalFalhas: 0, interrompida: false });
        // [Desempenho.NF005]: houve 429 e mesmo assim todos os pedidos foram atendidos.
        expect(recebido.respostas429).toBeGreaterThan(0);
        expect(recebido.clientes).toBe(QUANTIDADE_DE_ALUNOS);
        expect(recebido.cobrancas).toBe(QUANTIDADE_DE_ALUNOS);
        expect(recebido.semChave).toBe(0);
        // [Desempenho.NF004]: dentro da cota e da janela.
        expect(recebido.total).toBeLessThanOrEqual(LIMITE_DE_REQUISICOES);
        expect(duracaoEmMs).toBeLessThan(LIMITE_DE_DURACAO_EM_MS);

        // No banco: uma mensalidade aberta por aluno, com o id do Asaas, e a execução registrada.
        const mensalidades = await aplicacao.prisma.cobranca.count({
          where: { alunoId: { in: meusAlunos }, origem: 'MENSALIDADE', situacao: 'ABERTA', idAsaas: { not: null } },
        });
        expect(mensalidades).toBe(QUANTIDADE_DE_ALUNOS);
        const execucao = await aplicacao.prisma.execucaoGeracao.findFirstOrThrow({ orderBy: { iniciadaEm: 'desc' } });
        expect(execucao).toMatchObject({ origem: 'MANUAL', totalCriadas: QUANTIDADE_DE_ALUNOS, totalFalhas: 0, interrompida: false });
        expect(execucao.finalizadaEm).not.toBeNull();
      },
      35 * 60 * 1000,
    );
  },
);

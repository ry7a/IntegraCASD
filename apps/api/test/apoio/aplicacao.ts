// Sobe a aplicação inteira (os mesmos módulos da API de verdade) ligada ao banco de integração.
// Só duas peças são trocadas por dublês, porque são serviços de fora: o Cliente Asaas e o envio de e-mail.
// O resto é o código de produção: controllers, guardas, casos de uso, repositórios Prisma e a fila do pg-boss.
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import {
  ClienteAsaas,
  type CobrancaAsaas,
  type NovaCobrancaAsaas,
  type NovoClienteAsaas,
} from '../../src/compartilhado/asaas/cliente-asaas.js';
import { ClienteAsaasFalso } from '../../src/compartilhado/asaas/cliente-asaas.falso.js';
import { NOME_COOKIE_SESSAO } from '../../src/compartilhado/autenticacao/sessao.js';
import { NotificadorDeAlertas } from '../../src/compartilhado/notificacao/notificador-de-alertas.js';
import { NotificadorDeAlertasFalso } from '../../src/compartilhado/notificacao/notificador-de-alertas.falso.js';
import { PrismaService } from '../../src/compartilhado/prisma/prisma.service.js';
import { configurarApp } from '../../src/openapi.js';

export interface AplicacaoDeTeste {
  app: INestApplication;
  // Prisma ligado ao mesmo banco: o teste usa para preparar o cenário e conferir o resultado (caixa cinza).
  prisma: PrismaService;
  // O Asaas falso que a aplicação está usando (null quando o teste entregou outro cliente).
  asaas: ClienteAsaasFalso;
  notificador: NotificadorDeAlertasFalso;
  // Requisições HTTP à aplicação, como faria o navegador: http().get('/api/alunos').
  http: () => ReturnType<typeof request>;
  encerrar: () => Promise<void>;
}

export interface OpcoesDaAplicacao {
  // Outro cliente do Asaas no lugar do falso padrão (ex.: o cliente HTTP real apontado para um servidor falso).
  clienteAsaas?: ClienteAsaas;
}

// O Asaas falso numera os ids a partir de 1 (cus_falso_1, pay_falso_1). Cada arquivo de teste sobe a sua
// aplicação com um falso novo, mas todos gravam no MESMO banco, onde esses ids são únicos: o segundo arquivo
// colidiria com o primeiro. Esta versão acrescenta uma marca da aplicação ao id (pay_falso_1_ab12cd34).
export class ClienteAsaasFalsoComIdsUnicos extends ClienteAsaasFalso {
  private readonly marca = randomUUID().slice(0, 8);

  override async criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    const criado = await super.criarCliente(dados);
    return { idAsaas: `${criado.idAsaas}_${this.marca}` };
  }

  override async criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    const criada = await super.criarCobranca(dados);
    const idUnico = `${criada.idAsaas}_${this.marca}`;
    // O falso guardou a cobrança com o id antigo: troca pelo novo, para buscar e sincronizar acharem.
    const noAsaas = this.noAsaas.get(criada.idAsaas);
    this.noAsaas.delete(criada.idAsaas);
    if (noAsaas) this.noAsaas.set(idUnico, { ...noAsaas, idAsaas: idUnico });
    return { ...criada, idAsaas: idUnico };
  }
}

export async function subirAplicacao(opcoes: OpcoesDaAplicacao = {}): Promise<AplicacaoDeTeste> {
  const asaas = new ClienteAsaasFalsoComIdsUnicos();
  const notificador = new NotificadorDeAlertasFalso();
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClienteAsaas)
    .useValue(opcoes.clienteAsaas ?? asaas)
    .overrideProvider(NotificadorDeAlertas)
    .useValue(notificador)
    .compile();

  // Só avisos e erros no terminal: os logs de subida do Nest poluiriam a saída do Vitest.
  const app = modulo.createNestApplication({ logger: ['error', 'warn'] });
  configurarApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    asaas,
    notificador,
    http: () => request(app.getHttpServer()),
    encerrar: () => app.close(),
  };
}

// Entra com e-mail e senha pela rota de login e devolve o cabeçalho Cookie para as próximas requisições.
export async function entrar(aplicacao: AplicacaoDeTeste, email: string, senha: string): Promise<string> {
  const resposta = await aplicacao.http().post('/api/auth/login').send({ email, senha });
  if (resposta.status !== 200) {
    throw new Error(`Login de teste falhou com ${resposta.status}: ${JSON.stringify(resposta.body)}`);
  }
  const cookies = ([] as string[]).concat(resposta.headers['set-cookie'] ?? []);
  const sessao = cookies.find((cookie) => cookie.startsWith(`${NOME_COOKIE_SESSAO}=`));
  if (!sessao) throw new Error('O login de teste não devolveu o cookie da sessão.');
  return sessao.split(';')[0];
}

// Espera uma condição ficar verdadeira (ex.: o worker processar um evento), conferindo a cada 200 ms.
export async function esperarAte(condicao: () => Promise<boolean>, limiteEmMs = 20_000): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteEmMs) {
    if (await condicao()) return;
    await new Promise((resolver) => setTimeout(resolver, 200));
  }
  throw new Error(`A condição não ficou verdadeira em ${limiteEmMs} ms.`);
}

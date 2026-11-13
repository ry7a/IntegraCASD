// CT-FZ-02 (sistema, fuzzing): formulários e filtros da API recebem entradas inválidas, extremas ou
// inesperadas, geradas por um LLM e guardadas em entradas/*.json (Plano de Testes, Seção 4.1).
// Para cada uma, o teste confere com o banco real: nunca 5xx; recusa (4xx) com mensagem que indica o campo
// e sem detalhe interno, e NADA gravado (aqui nem no Asaas falso); aceite com o registro gravado uma vez e,
// quando o texto tem caracteres de SQL ou HTML, gravado exatamente como veio.
// Entrada que derrubar o sistema fica no arquivo como caso fixo de regressão (veja o README.md).
import { type AplicacaoDeTeste, entrar, subirAplicacao } from '../../apoio/aplicacao.js';
import {
  criarAluno,
  criarCategoria,
  criarCobrancaAberta,
  criarConta,
  criarUsuario,
  definirParametros,
  diaDeHojeMais,
  gerarCpf,
} from '../../apoio/cenario.js';
import {
  DETALHE_INTERNO,
  type Esperado,
  type Trocas,
  expandir,
  expandirCorpoBruto,
  lerArquivoDeEntradas,
  lerEntradas,
  resumoDaResposta,
} from './entradas.js';

interface EntradaDeFormulario {
  classe: string;
  descricao: string;
  esperado: Esperado;
  // Campos trocados ou tirados do corpo base do arquivo. Ou, no lugar disso, um corpo inteiro (`corpo`)
  // ou um texto enviado como está (`corpoBruto`).
  alterar?: Record<string, unknown>;
  remover?: string[];
  corpo?: unknown;
  corpoBruto?: unknown;
  // Palavra que a mensagem de recusa precisa ter para o usuário saber qual campo corrigir.
  campoNaMensagem?: string;
  // No aceite: o campo do registro gravado e o valor que ele precisa ter (texto literal, sem efeito colateral).
  gravado?: { campo: string; valor: unknown };
}

interface EntradaDeConsulta {
  classe: string;
  descricao: string;
  esperado: Esperado;
  rota: string;
  consulta?: Record<string, unknown>;
  campoNaMensagem?: string;
}

type Tabela = 'aluno' | 'cobranca' | 'movimentacao';

const FORMULARIOS: Array<{ nome: string; arquivo: string; rota: string; tabela: Tabela }> = [
  { nome: 'cadastro de aluno', arquivo: 'aluno.json', rota: '/api/alunos', tabela: 'aluno' },
  { nome: 'cobrança avulsa', arquivo: 'cobranca-avulsa.json', rota: '/api/cobrancas', tabela: 'cobranca' },
  { nome: 'movimentação', arquivo: 'movimentacao.json', rota: '/api/movimentacoes', tabela: 'movimentacao' },
];

describe('[Cadastros.RF001] [Cobranças.RF002] [Movimentações.RF001] [Usabilidade.NF002] CT-FZ-02 fuzzing dos formulários e filtros', () => {
  let aplicacao: AplicacaoDeTeste;
  let cookie: string;
  let trocas: Trocas;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    const diretor = await criarUsuario(aplicacao.prisma, 'DIRETORIA');
    cookie = await entrar(aplicacao, diretor.email, diretor.senha);
    // Multa e juros vigentes: sem eles nenhuma cobrança avulsa é emitida.
    await definirParametros(aplicacao.prisma, diretor.id);
    const ativo = await criarAluno(aplicacao.prisma);
    const inativo = await criarAluno(aplicacao.prisma, { ativo: false });
    const semEmail = await criarAluno(aplicacao.prisma, { email: '' });
    const conta = await criarConta(aplicacao.prisma);
    const categoriaDeEntrada = await criarCategoria(aplicacao.prisma, 'ENTRADA');
    const categoriaDeSaida = await criarCategoria(aplicacao.prisma, 'SAIDA');
    // Uma cobrança aberta, para as consultas de cobranças terem o que listar (e o que não deixar vazar).
    await criarCobrancaAberta(aplicacao.prisma, aplicacao.asaas, { alunoId: ativo.id });

    const hoje = diaDeHojeMais(0);
    const ano = Number(hoje.slice(0, 4));
    trocas = {
      CPF: () => gerarCpf(),
      CPF_EXISTENTE: () => ativo.cpf,
      ALUNO_ID: () => ativo.id,
      ALUNO_INATIVO_ID: () => inativo.id,
      ALUNO_SEM_EMAIL_ID: () => semEmail.id,
      CONTA_ID: () => conta.id,
      CATEGORIA_ENTRADA_ID: () => categoriaDeEntrada.id,
      CATEGORIA_SAIDA_ID: () => categoriaDeSaida.id,
      HOJE: () => hoje,
      ONTEM: () => diaDeHojeMais(-1),
      AMANHA: () => diaDeHojeMais(1),
      DAQUI_10_DIAS: () => diaDeHojeMais(10),
      ANO_QUE_VEM: () => String(ano + 1),
      ANO_PASSADO: () => String(ano - 1),
    };
  });

  afterAll(async () => {
    await aplicacao?.encerrar();
  });

  // Fotografia de tudo o que um formulário poderia gravar, aqui e no Asaas falso.
  async function contarTudo(): Promise<Record<string, number>> {
    const prisma = aplicacao.prisma;
    return {
      alunos: await prisma.aluno.count(),
      turmas: await prisma.turma.count(),
      alojamentos: await prisma.alojamento.count(),
      cobrancas: await prisma.cobranca.count(),
      clientesAsaas: await prisma.clienteAsaas.count(),
      movimentacoes: await prisma.movimentacao.count(),
      trilha: await prisma.registroAuditoria.count(),
      cobrancasCriadasNoAsaas: aplicacao.asaas.cobrancasCriadas.length,
      clientesCriadosNoAsaas: aplicacao.asaas.clientesCriados.length,
    };
  }

  // Só o que mudou entre as duas fotografias (vazio = nada gravado).
  function diferenca(antes: Record<string, number>, depois: Record<string, number>): Record<string, number> {
    const mudou: Record<string, number> = {};
    for (const chave of Object.keys(antes)) {
      if (depois[chave] !== antes[chave]) mudou[chave] = depois[chave] - antes[chave];
    }
    return mudou;
  }

  // [Usabilidade.NF002] A recusa explica o que corrigir: mensagem em texto, que cita o campo e não expõe
  // detalhe interno (banco, Prisma, pilha de chamadas).
  function conferirMensagem(corpo: unknown, campo: string | undefined, comoFoi: string): void {
    const mensagem = (corpo as { message?: unknown } | null)?.message;
    expect(typeof mensagem, comoFoi).toBe('string');
    expect(mensagem as string, comoFoi).not.toMatch(DETALHE_INTERNO);
    if (campo !== undefined) expect((mensagem as string).toLowerCase(), comoFoi).toContain(campo.toLowerCase());
  }

  async function buscarGravado(tabela: Tabela, id: string): Promise<Record<string, unknown> | null> {
    if (tabela === 'aluno') return aplicacao.prisma.aluno.findUnique({ where: { id } });
    if (tabela === 'cobranca') return aplicacao.prisma.cobranca.findUnique({ where: { id } });
    return aplicacao.prisma.movimentacao.findUnique({ where: { id } });
  }

  const CONTAGEM_DA_TABELA: Record<Tabela, string> = { aluno: 'alunos', cobranca: 'cobrancas', movimentacao: 'movimentacoes' };

  for (const formulario of FORMULARIOS) {
    const arquivo = lerArquivoDeEntradas<EntradaDeFormulario>(formulario.arquivo);

    describe(`formulário: ${formulario.nome} (POST ${formulario.rota})`, () => {
      function enviar(entrada: EntradaDeFormulario) {
        const pedido = aplicacao.http().post(formulario.rota).set('Cookie', cookie);
        if (entrada.corpoBruto !== undefined) {
          return pedido.set('Content-Type', 'application/json').send(expandirCorpoBruto(entrada.corpoBruto, trocas));
        }
        let corpo: unknown = entrada.corpo;
        if (corpo === undefined) {
          // O corpo base com os campos da entrada por cima, menos os removidos.
          const montado: Record<string, unknown> = { ...arquivo.base, ...entrada.alterar };
          for (const campo of entrada.remover ?? []) delete montado[campo];
          corpo = montado;
        }
        return pedido.send(expandir(corpo, trocas) as object);
      }

      for (const entrada of arquivo.entradas) {
        it(`${entrada.classe}: ${entrada.descricao} (esperado: ${entrada.esperado})`, async () => {
          const antes = await contarTudo();
          const resposta = await enviar(entrada);
          const efeitos = diferenca(antes, await contarTudo());
          const comoFoi = `${resumoDaResposta(resposta)} | gravado: ${JSON.stringify(efeitos)}`;

          // Nunca 5xx: nenhuma entrada pode derrubar a API.
          expect(resposta.status, comoFoi).toBeLessThan(500);
          const aceito = resposta.status >= 200 && resposta.status < 300;
          if (entrada.esperado === 'aceito') expect(aceito, comoFoi).toBe(true);
          if (entrada.esperado === 'recusa') expect(aceito, comoFoi).toBe(false);

          if (aceito) {
            // Um registro novo na tabela do formulário, e o texto gravado exatamente como foi enviado.
            expect(efeitos[CONTAGEM_DA_TABELA[formulario.tabela]], comoFoi).toBe(1);
            if (entrada.gravado !== undefined) {
              const registro = await buscarGravado(formulario.tabela, (resposta.body as { id: string }).id);
              expect(registro?.[entrada.gravado.campo], comoFoi).toEqual(entrada.gravado.valor);
            }
          } else {
            // Recusa: nada gravado aqui nem no Asaas, e uma mensagem que diz o que corrigir.
            expect(efeitos, comoFoi).toEqual({});
            conferirMensagem(resposta.body, entrada.campoNaMensagem, comoFoi);
          }
        });
      }
    });
  }

  describe('consultas (GET com filtros)', () => {
    const entradas = lerEntradas<EntradaDeConsulta>('consultas.json');

    function consultar(entrada: EntradaDeConsulta) {
      // Monta a URL com URLSearchParams: ele codifica aspas, espaços e % do jeito que o navegador faria.
      const parametros = new URLSearchParams();
      for (const [nome, valor] of Object.entries(entrada.consulta ?? {})) {
        const valores = Array.isArray(valor) ? valor : [valor];
        for (const item of valores) parametros.append(nome, String(expandir(item, trocas)));
      }
      const url = parametros.size > 0 ? `${entrada.rota}?${parametros.toString()}` : entrada.rota;
      return aplicacao.http().get(url).set('Cookie', cookie);
    }

    for (const entrada of entradas) {
      it(`${entrada.classe}: ${entrada.descricao} (esperado: ${entrada.esperado})`, async () => {
        const antes = await contarTudo();
        const resposta = await consultar(entrada);
        const efeitos = diferenca(antes, await contarTudo());
        const comoFoi = `${resumoDaResposta(resposta)} | gravado: ${JSON.stringify(efeitos)}`;

        expect(resposta.status, comoFoi).toBeLessThan(500);
        // Consulta não grava nada, nem com SQL no filtro.
        expect(efeitos, comoFoi).toEqual({});

        const itens = (resposta.body as { itens?: unknown } | null)?.itens;
        const listou = resposta.status === 200 && Array.isArray(itens);
        const recusou = resposta.status >= 400 && resposta.status < 500;
        if (entrada.esperado === 'recusa') expect(recusou, comoFoi).toBe(true);
        if (entrada.esperado === 'lista') expect(listou, comoFoi).toBe(true);
        if (entrada.esperado === 'lista-vazia') {
          expect(listou, comoFoi).toBe(true);
          expect(itens, comoFoi).toEqual([]);
        }
        expect(listou || recusou, comoFoi).toBe(true);
        if (recusou) conferirMensagem(resposta.body, entrada.campoNaMensagem, comoFoi);
      });
    }
  });

  it('nenhuma entrada poluiu o protótipo dos objetos do servidor', () => {
    expect((Object.prototype as Record<string, unknown>).poluidoPeloFuzzing).toBeUndefined();
  });
});

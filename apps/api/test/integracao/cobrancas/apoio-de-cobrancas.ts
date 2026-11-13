// Apoio dos testes de integração e de sistema do módulo Cobranças (CT-COB-01 a CT-COB-08, menos o 05).
// Fica nesta pasta, e não em test/apoio, porque só estes arquivos usam.
import { ErroAsaas } from '../../../src/compartilhado/asaas/cliente-asaas.js';
import type { ClienteAsaasFalso } from '../../../src/compartilhado/asaas/cliente-asaas.falso.js';
import { type AplicacaoDeTeste, ClienteAsaasFalsoComIdsUnicos } from '../../apoio/aplicacao.js';
import { diaDeHojeMais, gerarCpf } from '../../apoio/cenario.js';

// O Asaas falso padrão, mais a recusa de um cancelamento ([Cobranças.RF004] fluxo E2: "se a plataforma
// recusar"). O falso padrão só sabe ficar fora do ar; recusar é outra resposta do Asaas, com outra mensagem.
export class AsaasQueRecusaCancelamentos extends ClienteAsaasFalsoComIdsUnicos {
  // Ids do Asaas cujo cancelamento a plataforma recusa.
  readonly cancelamentosRecusados = new Set<string>();

  override async cancelarCobranca(idAsaas: string): Promise<void> {
    if (this.cancelamentosRecusados.has(idAsaas)) {
      throw new ErroAsaas(
        'O Asaas recusou o cancelamento desta cobrança. Confira a cobrança no painel do Asaas e tente novamente.',
        'DADOS_RECUSADOS',
      );
    }
    await super.cancelarCobranca(idAsaas);
  }
}

// CPF com 11 dígitos, mas com o último dígito verificador errado: o que a carga inicial pode trazer da planilha.
export function cpfComDigitoErrado(): string {
  const valido = gerarCpf();
  const ultimoErrado = (Number(valido[10]) + 1) % 10;
  return `${valido.slice(0, 10)}${ultimoErrado}`;
}

// Justificativa típica de um registro manual (sem dado pessoal: a trilha não pode ser apagada).
export const JUSTIFICATIVA_DE_TESTE = 'Pix recebido na conta do CASD, conferido no extrato bancário (teste)';

// As transições abaixo preparam o estado de uma cobrança pelas rotas reais, como a área administrativa faria.
// Se a rota não responder o esperado, o erro aparece aqui, na preparação, e não numa conferência adiante.

// Aberta -> Paga: o Asaas passa a dizer que recebeu e a sincronização da cobrança
// ([Cobranças.RF007] fluxo A1) dá a baixa, criando a entrada.
export async function pagarNoAsaasESincronizar(
  aplicacao: AplicacaoDeTeste,
  asaas: ClienteAsaasFalso,
  cookie: string,
  cobranca: { id: string; idAsaas: string | null },
): Promise<void> {
  const noAsaas = cobranca.idAsaas === null ? undefined : asaas.noAsaas.get(cobranca.idAsaas);
  if (noAsaas === undefined) throw new Error('A cobrança não está no Asaas falso deste teste.');
  asaas.noAsaas.set(noAsaas.idAsaas, { ...noAsaas, situacao: 'RECEIVED', pagoEm: diaDeHojeMais(0), disponivelEm: diaDeHojeMais(0) });
  const resposta = await aplicacao.http().post(`/api/cobrancas/${cobranca.id}/sincronizar`).set('Cookie', cookie).send({});
  if (resposta.status !== 200) throw new Error(`A sincronização respondeu ${resposta.status}: ${JSON.stringify(resposta.body)}`);
}

// Aberta -> Paga com registro manual ([Cobranças.RF006]).
export async function registrarPagamentoManual(
  aplicacao: AplicacaoDeTeste,
  cookie: string,
  cobrancaId: string,
  valorCentavos = 8500,
): Promise<void> {
  const resposta = await aplicacao
    .http()
    .post(`/api/cobrancas/${cobrancaId}/pagamento-manual`)
    .set('Cookie', cookie)
    .send({ pagoEm: diaDeHojeMais(0), valorCentavos, formaPagamento: 'PIX', justificativa: JUSTIFICATIVA_DE_TESTE });
  if (resposta.status !== 204) throw new Error(`O registro manual respondeu ${resposta.status}: ${JSON.stringify(resposta.body)}`);
}

// Aberta -> Cancelada ([Cobranças.RF004]).
export async function cancelarCobranca(aplicacao: AplicacaoDeTeste, cookie: string, cobrancaId: string): Promise<void> {
  const resposta = await aplicacao
    .http()
    .post(`/api/cobrancas/${cobrancaId}/cancelar`)
    .set('Cookie', cookie)
    .send({ motivo: 'Renegociação acordada com o aluno (teste)' });
  if (resposta.status !== 204) throw new Error(`O cancelamento respondeu ${resposta.status}: ${JSON.stringify(resposta.body)}`);
}

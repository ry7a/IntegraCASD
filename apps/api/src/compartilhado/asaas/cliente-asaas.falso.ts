import {
  ClienteAsaas,
  CobrancaAsaas,
  ErroAsaas,
  NovaCobrancaAsaas,
  NovoClienteAsaas,
} from './cliente-asaas.js';

// Dublê de teste: faz o papel do Asaas sem rede. Guarda o que recebeu para o teste conferir.
// Testes automatizados nunca chamam o Asaas real.
export class ClienteAsaasFalso extends ClienteAsaas {
  readonly clientesCriados: NovoClienteAsaas[] = [];
  readonly cobrancasCriadas: NovaCobrancaAsaas[] = [];
  readonly cobrancasCanceladas: string[] = [];

  // Ligue para simular o Asaas fora do ar.
  indisponivel = false;
  // CPFs que o Asaas recusa (simula "dados recusados" para um aluno só).
  readonly cpfsRecusados = new Set<string>();

  // Ligue para simular a integração sem chave configurada.
  semConfiguracao = false;

  estaConfigurado(): boolean {
    return !this.semConfiguracao;
  }

  criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    this.verificarDisponibilidade();
    if (this.cpfsRecusados.has(dados.cpf)) {
      throw new ErroAsaas('O Asaas recusou os dados enviados. Confira CPF, e-mail e valor e tente novamente.', 'DADOS_RECUSADOS');
    }
    this.clientesCriados.push(dados);
    return Promise.resolve({ idAsaas: `cus_falso_${this.clientesCriados.length}` });
  }

  criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    this.verificarDisponibilidade();
    this.cobrancasCriadas.push(dados);
    const numero = this.cobrancasCriadas.length;
    return Promise.resolve({
      idAsaas: `pay_falso_${numero}`,
      urlBoleto: `https://asaas.falso/boleto/pay_falso_${numero}`,
      urlFatura: `https://asaas.falso/fatura/pay_falso_${numero}`,
    });
  }

  cancelarCobranca(idAsaas: string): Promise<void> {
    this.verificarDisponibilidade();
    this.cobrancasCanceladas.push(idAsaas);
    return Promise.resolve();
  }

  private verificarDisponibilidade() {
    if (this.indisponivel) {
      throw new ErroAsaas('O Asaas está fora do ar no momento. Tente novamente em alguns minutos.');
    }
  }
}

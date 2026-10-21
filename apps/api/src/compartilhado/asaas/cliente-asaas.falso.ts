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

  // Ligue para simular o Asaas fora do ar.
  indisponivel = false;

  criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    this.verificarDisponibilidade();
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
    });
  }

  private verificarDisponibilidade() {
    if (this.indisponivel) {
      throw new ErroAsaas('O Asaas está fora do ar no momento. Tente novamente em alguns minutos.');
    }
  }
}

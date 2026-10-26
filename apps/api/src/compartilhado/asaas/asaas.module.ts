import { Logger, Module } from '@nestjs/common';
import {
  ClienteAsaas,
  ErroAsaas,
  type CobrancaAsaas,
  type NovaCobrancaAsaas,
  type NovoClienteAsaas,
} from './cliente-asaas.js';
import { ClienteAsaasHttp, configuracaoAsaasDoAmbiente } from './cliente-asaas.http.js';

// Cliente Asaas "sob demanda": a chave e o ambiente (do .env) só são lidos na primeira chamada.
// Assim a API, o worker e o script que gera o OpenAPI sobem mesmo sem a chave configurada (no CI,
// por exemplo); só a operação que precisa do Asaas falha, com mensagem orientada à ação.
export class ClienteAsaasSobDemanda extends ClienteAsaas {
  private readonly logger = new Logger(ClienteAsaasSobDemanda.name);
  private real: ClienteAsaasHttp | null = null;

  private cliente(): ClienteAsaasHttp {
    if (this.real === null) {
      try {
        this.real = new ClienteAsaasHttp(configuracaoAsaasDoAmbiente());
      } catch (erro) {
        // O detalhe (qual variável falta) vai para o log; a chave nunca.
        this.logger.error(erro instanceof Error ? erro.message : 'Configuração do Asaas inválida.');
        throw new ErroAsaas('A integração com o Asaas não está configurada. Peça à diretoria para conferir a configuração.');
      }
    }
    return this.real;
  }

  criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    return this.cliente().criarCliente(dados);
  }

  criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    return this.cliente().criarCobranca(dados);
  }
}

// Quem pede `ClienteAsaas` recebe o cliente real (sob demanda). Nos testes, cada teste entrega
// o dublê (ClienteAsaasFalso) no lugar.
@Module({
  providers: [{ provide: ClienteAsaas, useClass: ClienteAsaasSobDemanda }],
  exports: [ClienteAsaas],
})
export class AsaasModule {}

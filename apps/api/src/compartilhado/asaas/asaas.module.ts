import { Injectable, Module } from '@nestjs/common';
import {
  ClienteAsaas,
  ErroAsaas,
  type AmbienteAsaas,
  type CobrancaAsaas,
  type CobrancaNoAsaas,
  type NovaCobrancaAsaas,
  type NovoClienteAsaas,
} from './cliente-asaas.js';
import { ClienteAsaasHttp } from './cliente-asaas.http.js';
import { ConfiguracaoAsaasRepositorio } from './configuracao-asaas.repositorio.js';
import { FonteDaConfiguracaoAsaas } from './fonte-da-configuracao.js';

// Cliente Asaas "sob demanda": a cada operação, usa a configuração vigente (a cadastrada na tela ou,
// sem ela, a do .env). Assim a API, o worker e o gerador do OpenAPI sobem mesmo sem chave (no CI, por
// exemplo), e uma chave substituída na tela passa a valer na operação seguinte, sem reiniciar nada.
@Injectable()
export class ClienteAsaasSobDemanda extends ClienteAsaas {
  // O cliente HTTP é reaproveitado enquanto a configuração não muda.
  private emCache: { urlBase: string; chaveApi: string; cliente: ClienteAsaasHttp } | null = null;
  // Só para testar uma chave candidata (sem configuração própria).
  private readonly testador = new ClienteAsaasHttp({ urlBase: '', chaveApi: '' });

  constructor(private readonly fonte: FonteDaConfiguracaoAsaas) {
    super();
  }

  private async cliente(): Promise<ClienteAsaasHttp> {
    const configuracao = await this.fonte.emUso();
    if (configuracao === null) {
      throw new ErroAsaas(
        'A integração com o Asaas não está configurada. Peça à diretoria para cadastrar a chave em Administração.',
        'NAO_CONFIGURADO',
      );
    }
    if (this.emCache?.urlBase !== configuracao.urlBase || this.emCache.chaveApi !== configuracao.chaveApi) {
      this.emCache = { urlBase: configuracao.urlBase, chaveApi: configuracao.chaveApi, cliente: new ClienteAsaasHttp(configuracao) };
    }
    return this.emCache.cliente;
  }

  async estaConfigurado(): Promise<boolean> {
    return (await this.fonte.emUso()) !== null;
  }

  testarCredenciais(ambiente: AmbienteAsaas, chaveApi: string): Promise<void> {
    return this.testador.testarCredenciais(ambiente, chaveApi);
  }

  async criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }> {
    return (await this.cliente()).criarCliente(dados);
  }

  async atualizarCliente(idAsaas: string, dados: NovoClienteAsaas): Promise<void> {
    return (await this.cliente()).atualizarCliente(idAsaas, dados);
  }

  async criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas> {
    return (await this.cliente()).criarCobranca(dados);
  }

  async cancelarCobranca(idAsaas: string): Promise<void> {
    return (await this.cliente()).cancelarCobranca(idAsaas);
  }

  async buscarCobranca(idAsaas: string): Promise<CobrancaNoAsaas | null> {
    return (await this.cliente()).buscarCobranca(idAsaas);
  }

  async listarCobrancas(periodo: { vencimentoDe: string; vencimentoAte: string }): Promise<CobrancaNoAsaas[]> {
    return (await this.cliente()).listarCobrancas(periodo);
  }
}

// Quem pede `ClienteAsaas` recebe o cliente real (sob demanda). Nos testes, cada teste entrega
// o dublê (ClienteAsaasFalso) no lugar. A configuração (repositório e fonte) é exportada para a
// Administração cadastrar e consultar a integração [Administração.RF004].
@Module({
  providers: [
    ConfiguracaoAsaasRepositorio,
    FonteDaConfiguracaoAsaas,
    { provide: ClienteAsaas, useClass: ClienteAsaasSobDemanda },
  ],
  exports: [ClienteAsaas, ConfiguracaoAsaasRepositorio, FonteDaConfiguracaoAsaas],
})
export class AsaasModule {}

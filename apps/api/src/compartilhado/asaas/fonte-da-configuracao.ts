import { Injectable, Logger } from '@nestjs/common';
import { chaveMestraDoAmbiente, decifrar } from '../seguranca/cifra.js';
import type { AmbienteAsaas } from './cliente-asaas.js';
import { configuracaoAsaasDoAmbiente, urlBaseDoAmbiente, type ConfiguracaoAsaas } from './cliente-asaas.http.js';
import { ConfiguracaoAsaasRepositorio } from './configuracao-asaas.repositorio.js';

export type ConfiguracaoEmUso = ConfiguracaoAsaas & { ambiente: AmbienteAsaas; origem: 'BANCO' | 'AMBIENTE' };

// De onde vem a chave do Asaas que o sistema usa:
// 1. a cadastrada pela diretoria na tela (banco, cifrada) [Administração.RF004];
// 2. sem ela, a do .env (ASAAS_AMBIENTE e ASAAS_API_KEY), que serve para o desenvolvimento local.
// Nulo quando não há nenhuma das duas.
@Injectable()
export class FonteDaConfiguracaoAsaas {
  private readonly logger = new Logger(FonteDaConfiguracaoAsaas.name);

  constructor(private readonly configuracoes: ConfiguracaoAsaasRepositorio) {}

  async emUso(): Promise<ConfiguracaoEmUso | null> {
    const guardada = await this.configuracoes.vigente();
    if (guardada !== null) {
      try {
        const chaveApi = decifrar(guardada.chaveCifrada, chaveMestraDoAmbiente());
        return { urlBase: urlBaseDoAmbiente(guardada.ambiente), chaveApi, ambiente: guardada.ambiente, origem: 'BANCO' };
      } catch (erro) {
        // Sem CHAVE_DE_CIFRAGEM, ou trocada: não dá para usar a chave guardada. O motivo vai para o log.
        this.logger.error(`A chave do Asaas guardada não pôde ser decifrada: ${erro instanceof Error ? erro.message : ''}`);
        return null;
      }
    }
    try {
      const doEnv = configuracaoAsaasDoAmbiente();
      const ambiente: AmbienteAsaas = doEnv.urlBase.includes('sandbox') ? 'SANDBOX' : 'PRODUCAO';
      return { ...doEnv, ambiente, origem: 'AMBIENTE' };
    } catch {
      return null;
    }
  }
}

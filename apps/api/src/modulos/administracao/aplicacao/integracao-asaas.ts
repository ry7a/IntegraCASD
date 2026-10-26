import { BadRequestException, Injectable } from '@nestjs/common';
import { ClienteAsaas, ErroAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { ConfiguracaoAsaasRepositorio } from '../../../compartilhado/asaas/configuracao-asaas.repositorio.js';
import { FonteDaConfiguracaoAsaas } from '../../../compartilhado/asaas/fonte-da-configuracao.js';
import { ChaveDeCifragemAusente, chaveMestraDoAmbiente, cifrar } from '../../../compartilhado/seguranca/cifra.js';
import {
  IntegracaoInvalida,
  PRAZO_PADRAO,
  lerAmbiente,
  lerChave,
  lerPrazoDoAlerta,
  type Ambiente,
} from '../dominio/integracao-asaas.js';

// Casos de uso da integração com o Asaas [Administração.RF004]. Pequenos e ligados à mesma configuração.

export type SituacaoDaIntegracao = {
  // Nulo quando não há chave em lugar nenhum.
  ambiente: Ambiente | null;
  conectada: boolean;
  // De onde vem a chave em uso: cadastrada na tela, do .env (desenvolvimento) ou nenhuma.
  origemDaChave: 'TELA' | 'ARQUIVO_ENV' | null;
  chaveCadastradaEm: Date | null;
  ultimoTesteEm: Date | null;
  alteradoPor: string | null;
  prazoAlertaHoras: number;
};

async function traduzir<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof IntegracaoInvalida) throw new BadRequestException(erro.message);
    if (erro instanceof ChaveDeCifragemAusente) {
      throw new BadRequestException('O servidor ainda não tem a CHAVE_DE_CIFRAGEM configurada. Peça a quem administra a instalação.');
    }
    throw erro;
  }
}

@Injectable()
export class ConsultarIntegracaoAsaas {
  constructor(
    private readonly configuracoes: ConfiguracaoAsaasRepositorio,
    private readonly fonte: FonteDaConfiguracaoAsaas,
  ) {}

  async executar(): Promise<SituacaoDaIntegracao> {
    const [guardada, emUso] = await Promise.all([this.configuracoes.vigente(), this.fonte.emUso()]);
    return {
      ambiente: emUso?.ambiente ?? guardada?.ambiente ?? null,
      conectada: emUso !== null,
      origemDaChave: emUso === null ? null : emUso.origem === 'BANCO' ? 'TELA' : 'ARQUIVO_ENV',
      // A chave é cadastrada no momento do teste; mudar só o prazo não muda essa data.
      chaveCadastradaEm: guardada?.testadaEm ?? null,
      ultimoTesteEm: guardada?.testadaEm ?? null,
      alteradoPor: guardada?.alteradoPor ?? null,
      prazoAlertaHoras: guardada?.prazoAlertaHoras ?? PRAZO_PADRAO,
    };
  }
}

// Passos 3 a 5 e fluxo E1: testa a chave nova antes de guardar. Se o teste falhar, a chave vigente
// continua valendo. A chave só é guardada cifrada, e a trilha registra a operação sem ela.
@Injectable()
export class SubstituirChaveAsaas {
  constructor(
    private readonly configuracoes: ConfiguracaoAsaasRepositorio,
    private readonly asaas: ClienteAsaas,
  ) {}

  executar(entrada: { ambiente?: unknown; chave?: unknown; prazoAlertaHoras?: unknown }, autorId: string): Promise<void> {
    return traduzir(async () => {
      const ambiente = lerAmbiente(entrada.ambiente);
      const chave = lerChave(entrada.chave);
      const vigente = await this.configuracoes.vigente();
      const prazoAlertaHoras =
        entrada.prazoAlertaHoras === undefined ? (vigente?.prazoAlertaHoras ?? PRAZO_PADRAO) : lerPrazoDoAlerta(entrada.prazoAlertaHoras);
      const chaveMestra = chaveMestraDoAmbiente();

      try {
        await this.asaas.testarCredenciais(ambiente, chave);
      } catch (erro) {
        if (erro instanceof ErroAsaas) {
          throw new IntegracaoInvalida(`A chave não foi salva: ${erro.message} A chave anterior continua valendo.`);
        }
        throw erro;
      }

      await this.configuracoes.gravar(
        { ambiente, chaveCifrada: cifrar(chave, chaveMestra), prazoAlertaHoras, testadaEm: new Date() },
        autorId,
        `Chave do Asaas substituída e testada (ambiente ${ambiente === 'SANDBOX' ? 'de testes' : 'de produção'}).`,
      );
    });
  }
}

// Fluxo A2: muda só o prazo do alerta, mantendo a chave cadastrada.
@Injectable()
export class AlterarPrazoDoAlerta {
  constructor(private readonly configuracoes: ConfiguracaoAsaasRepositorio) {}

  executar(entrada: { prazoAlertaHoras?: unknown }, autorId: string): Promise<void> {
    return traduzir(async () => {
      const prazoAlertaHoras = lerPrazoDoAlerta(entrada.prazoAlertaHoras);
      const vigente = await this.configuracoes.vigente();
      if (vigente === null) {
        throw new IntegracaoInvalida('Cadastre a chave do Asaas antes de escolher o prazo do alerta.');
      }
      await this.configuracoes.gravar(
        { ambiente: vigente.ambiente, chaveCifrada: vigente.chaveCifrada, prazoAlertaHoras, testadaEm: vigente.testadaEm },
        autorId,
        `Prazo do alerta de interrupção da conciliação alterado para ${prazoAlertaHoras} horas.`,
      );
    });
  }
}

import { Injectable } from '@nestjs/common';
import { lerParametros, type ParametrosDeCobranca } from '../dominio/parametros-de-cobranca.js';
import { ParametrosRepositorio } from '../infra/parametros.repositorio.js';
import { traduzirErrosDosParametros } from './erros-dos-parametros.js';

// Caso de uso [Administração.RF003]: grava novos parâmetros. Valem só para as cobranças geradas a
// partir de agora (fluxo A1); as já emitidas mantêm o valor e as condições de quando foram criadas.
@Injectable()
export class AlterarParametrosDeCobranca {
  constructor(private readonly parametros: ParametrosRepositorio) {}

  executar(entrada: Partial<Record<keyof ParametrosDeCobranca, unknown>>, autorId: string): Promise<void> {
    return traduzirErrosDosParametros(async () => {
      await this.parametros.gravar(lerParametros(entrada), autorId);
    });
  }
}

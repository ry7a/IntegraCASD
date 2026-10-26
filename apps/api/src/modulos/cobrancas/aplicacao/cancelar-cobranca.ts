import { Injectable, NotFoundException } from '@nestjs/common';
import { ClienteAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { conferirCancelamento, lerMotivoDoCancelamento } from '../dominio/cobranca.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

// Caso de uso [Cobranças.RF004]: cancela uma cobrança aberta no Asaas e aqui.
// Ordem: primeiro o Asaas. Se ele recusar ou não responder (fluxo E2), nada muda aqui: cancelar só
// localmente deixaria um boleto válido circulando, que o aluno poderia pagar.
@Injectable()
export class CancelarCobranca {
  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly asaas: ClienteAsaas,
  ) {}

  executar(id: string, entrada: { motivo?: unknown }, autorId: string): Promise<void> {
    return traduzirErrosDaCobranca(async () => {
      const cobranca = await this.cobrancas.buscarPorId(id);
      if (cobranca === null) throw new NotFoundException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.');
      conferirCancelamento(cobranca.situacao);
      const motivo = lerMotivoDoCancelamento(entrada.motivo);

      await this.asaas.cancelarCobranca(cobranca.idAsaas);
      await this.cobrancas.cancelar(cobranca.id, motivo, autorId);
    });
  }
}

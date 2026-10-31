import { Injectable, NotFoundException } from '@nestjs/common';
import { CobrancaInvalida, conferirBoletoDisponivel, conferirCobrancaNoAsaas } from '../dominio/cobranca.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

// Caso de uso [Cobranças.RF003]: entrega o link do boleto de uma cobrança aberta e registra no
// histórico quem o obteve (fluxo A1: a entrega por outro meio passa a ser de quem baixou).
@Injectable()
export class ObterBoleto {
  constructor(private readonly cobrancas: CobrancasRepositorio) {}

  executar(cobrancaId: string, autorId: string): Promise<{ url: string }> {
    return traduzirErrosDaCobranca(async () => {
      const cobranca = await this.cobrancas.buscarPorId(cobrancaId);
      if (cobranca === null) throw new NotFoundException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.');
      conferirBoletoDisponivel(cobranca.situacao);
      conferirCobrancaNoAsaas(cobranca.origem);
      const url = cobranca.urlBoleto ?? cobranca.urlFatura;
      if (url === null) {
        throw new CobrancaInvalida('O Asaas não informou o boleto desta cobrança. Sincronize a cobrança e tente de novo.');
      }
      await this.cobrancas.registrarObtencaoDoBoleto(cobranca.id, autorId);
      return { url };
    });
  }
}

import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ErroAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { CobrancaInvalida } from '../dominio/cobranca.js';

// Executa `acao` e traduz os erros para respostas HTTP: regra da cobrança violada vira 400; falha do
// Asaas vira 502, com a mensagem já traduzida pelo Cliente Asaas ([Usabilidade.NF002]).
export async function traduzirErrosDaCobranca<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof CobrancaInvalida) throw new BadRequestException(erro.message);
    if (erro instanceof ErroAsaas) throw new BadGatewayException(erro.message);
    throw erro;
  }
}

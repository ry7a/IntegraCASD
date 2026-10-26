import { BadRequestException } from '@nestjs/common';
import { ParametroInvalido } from '../dominio/parametros-de-cobranca.js';

// Executa `acao` e traduz parâmetro inválido do domínio para 400. Outros erros sobem como vieram.
export async function traduzirErrosDosParametros<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof ParametroInvalido) throw new BadRequestException(erro.message);
    throw erro;
  }
}

import { BadRequestException, ConflictException } from '@nestjs/common';
import { NomeDeCategoriaDuplicado, RegraDaCategoriaViolada } from '../dominio/categoria.js';

// Executa `acao` e traduz os erros do domínio para respostas HTTP:
// regra violada vira 400, nome duplicado vira 409. Outros erros sobem como vieram.
export async function traduzirErrosDaCategoria<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof RegraDaCategoriaViolada) throw new BadRequestException(erro.message);
    if (erro instanceof NomeDeCategoriaDuplicado) throw new ConflictException(erro.message);
    throw erro;
  }
}

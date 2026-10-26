import { BadRequestException, ConflictException } from '@nestjs/common';
import { CadastroDuplicado, DadoInvalido } from '../dominio/comum.js';

// Executa `acao` e traduz os erros do domínio para respostas HTTP: dado inválido vira 400;
// CPF, matrícula ou vaga já usados viram 409. Outros erros sobem como vieram.
export async function traduzirErrosDoCadastro<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof DadoInvalido) throw new BadRequestException(erro.message);
    if (erro instanceof CadastroDuplicado) throw new ConflictException(erro.message);
    throw erro;
  }
}

import { Injectable } from '@nestjs/common';
import { CadastroDuplicado, lerDadosParaInclusao, type EntradaDoAluno } from '../dominio/aluno.js';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';
import { paraDetalhe, type AlunoDetalhe } from './aluno-detalhe.js';
import { traduzirErrosDoCadastro } from './erros-do-cadastro.js';

// Caso de uso [Cadastros.RF001]: inclui um aluno, sempre ativo.
@Injectable()
export class CriarAluno {
  constructor(private readonly alunos: AlunosRepositorio) {}

  executar(entrada: EntradaDoAluno, autorId: string): Promise<AlunoDetalhe> {
    return traduzirErrosDoCadastro(async () => {
      const dados = lerDadosParaInclusao(entrada);

      // Fluxo E1: CPF de outro cadastro ativo não cria um novo; quem atende abre o existente.
      const existente = await this.alunos.buscarAtivoPorCpf(dados.cpf);
      if (existente !== null) {
        throw new CadastroDuplicado(
          `Já existe um cadastro ativo com este CPF (${existente.nome}). Abra esse cadastro para atualizá-lo.`,
        );
      }
      if (dados.matricula !== null && (await this.alunos.matriculaEmUso(dados.matricula))) {
        throw new CadastroDuplicado('Esta matrícula já pertence a outro aluno. Confira o número.');
      }
      if (dados.alojamento !== null && (await this.alunos.vagaOcupada(dados.alojamento))) {
        throw new CadastroDuplicado('Esta vaga já está ocupada por outro aluno ativo. Confira bloco, apartamento e vaga.');
      }
      return paraDetalhe(await this.alunos.criar(dados, autorId));
    });
  }
}

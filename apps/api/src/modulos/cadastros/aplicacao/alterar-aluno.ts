import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import {
  CadastroDuplicado,
  DadoDoAlunoInvalido,
  lerDadosParaAlteracao,
  type EntradaDoAluno,
} from '../dominio/aluno.js';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';
import { paraDetalhe, type AlunoDetalhe } from './aluno-detalhe.js';
import { traduzirErrosDoAluno } from './erros-do-aluno.js';

export type EntradaAlterarAluno = EntradaDoAluno & { ativo?: unknown };

// Caso de uso [Cadastros.RF001]: altera, inativa (fluxo A1) ou reativa um aluno.
// O cadastro nunca é excluído: inativo deixa de receber a mensalidade automática.
@Injectable()
export class AlterarAluno {
  constructor(private readonly alunos: AlunosRepositorio) {}

  executar(id: string, entrada: EntradaAlterarAluno, autorId: string): Promise<AlunoDetalhe> {
    return traduzirErrosDoAluno(async () => {
      const atual = await this.alunos.buscarPorId(id);
      if (atual === null) throw new NotFoundException('Aluno não encontrado. Volte à lista e escolha outro cadastro.');

      const { ativo: ativoInformado, ...cadastrais } = entrada;
      const dados = lerDadosParaAlteracao(cadastrais);
      if (ativoInformado !== undefined && typeof ativoInformado !== 'boolean') {
        throw new DadoDoAlunoInvalido('Informe se o aluno fica ativo ou inativo.');
      }
      const ativo = ativoInformado;
      if (Object.keys(dados).length === 0 && ativo === undefined) {
        throw new BadRequestException('Informe o que mudar no cadastro.');
      }

      // As unicidades valem entre alunos ativos: confere quando o aluno vai ficar ativo e o campo
      // muda, ou quando um inativo é reativado (outro pode ter pego o CPF ou a vaga nesse meio-tempo).
      const ficaAtivo = ativo ?? atual.ativo;
      const reativa = ativo === true && !atual.ativo;

      const cpfFinal = dados.cpf ?? atual.cpf;
      const cpfMuda = dados.cpf !== undefined && dados.cpf !== atual.cpf;
      if (ficaAtivo && (reativa || cpfMuda)) {
        const outro = await this.alunos.buscarAtivoPorCpf(cpfFinal, id);
        if (outro !== null) {
          throw new CadastroDuplicado(
            `Já existe um cadastro ativo com este CPF (${outro.nome}). Abra esse cadastro para atualizá-lo.`,
          );
        }
      }

      const novaMatricula = dados.matricula;
      if (typeof novaMatricula === 'number' && novaMatricula !== atual.matricula) {
        if (await this.alunos.matriculaEmUso(novaMatricula, id)) {
          throw new CadastroDuplicado('Esta matrícula já pertence a outro aluno. Confira o número.');
        }
      }

      const vagaFinal = dados.alojamento === undefined ? atual.alojamento : dados.alojamento;
      if (ficaAtivo && vagaFinal !== null && (reativa || dados.alojamento !== undefined)) {
        if (await this.alunos.vagaOcupada(vagaFinal, id)) {
          throw new CadastroDuplicado('Esta vaga já está ocupada por outro aluno ativo. Confira bloco, apartamento e vaga.');
        }
      }

      let operacao: OperacaoAuditada = 'ALTERACAO';
      if (ativo === false && atual.ativo) operacao = 'INATIVACAO';
      if (reativa) operacao = 'REATIVACAO';

      const alterado = await this.alunos.alterar(id, { ...dados, ...(ativo === undefined ? {} : { ativo }) }, operacao, autorId);
      return paraDetalhe(alterado);
    });
  }
}

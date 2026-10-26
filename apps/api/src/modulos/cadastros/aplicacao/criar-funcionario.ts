import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { CadastroDuplicado } from '../dominio/comum.js';
import { estaAtivo, lerDadosParaInclusao, type EntradaDoFuncionario } from '../dominio/funcionario.js';
import { FuncionariosRepositorio } from '../infra/funcionarios.repositorio.js';
import { traduzirErrosDoCadastro } from './erros-do-cadastro.js';
import { comSituacao, mensagemDeCpfDuplicado, type FuncionarioComSituacao } from './funcionario-com-situacao.js';

// Caso de uso [Cadastros.RF002]: inclui um funcionário.
@Injectable()
export class CriarFuncionario {
  constructor(private readonly funcionarios: FuncionariosRepositorio) {}

  executar(entrada: EntradaDoFuncionario, autorId: string, hoje = hojeEmSaoPaulo()): Promise<FuncionarioComSituacao> {
    return traduzirErrosDoCadastro(async () => {
      const dados = lerDadosParaInclusao(entrada);
      const ativo = estaAtivo(dados.dataDesligamento, hoje);
      // Fluxo E1 (igual ao do aluno): CPF de outro funcionário ativo não cria um novo cadastro.
      if (ativo) {
        const outro = await this.funcionarios.outroAtivoComCpf(dados.cpf, hoje);
        if (outro !== null) throw new CadastroDuplicado(mensagemDeCpfDuplicado(outro.nome));
      }
      return comSituacao(await this.funcionarios.criar(dados, ativo, hoje, autorId), hoje);
    });
  }
}

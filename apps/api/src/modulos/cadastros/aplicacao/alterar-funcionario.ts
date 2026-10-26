import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { CadastroDuplicado } from '../dominio/comum.js';
import { estaAtivo, lerDadosParaAlteracao, type EntradaDoFuncionario } from '../dominio/funcionario.js';
import { FuncionariosRepositorio } from '../infra/funcionarios.repositorio.js';
import { traduzirErrosDoCadastro } from './erros-do-cadastro.js';
import { comSituacao, mensagemDeCpfDuplicado, type FuncionarioComSituacao } from './funcionario-com-situacao.js';

// Caso de uso [Cadastros.RF002]: altera um funcionário. Informar o desligamento inativa a partir da
// data (fluxo A1); limpar o desligamento readmite. O cadastro nunca é excluído.
@Injectable()
export class AlterarFuncionario {
  constructor(private readonly funcionarios: FuncionariosRepositorio) {}

  executar(id: string, entrada: EntradaDoFuncionario, autorId: string, hoje = hojeEmSaoPaulo()): Promise<FuncionarioComSituacao> {
    return traduzirErrosDoCadastro(async () => {
      const atual = await this.funcionarios.buscarPorId(id);
      if (atual === null) throw new NotFoundException('Funcionário não encontrado. Atualize a lista e tente de novo.');

      const dados = lerDadosParaAlteracao(entrada, atual);
      if (Object.keys(dados).length === 0) throw new BadRequestException('Informe o que mudar no cadastro.');

      const estavaAtivo = estaAtivo(atual.dataDesligamento, hoje);
      const desligamentoFinal = dados.dataDesligamento === undefined ? atual.dataDesligamento : dados.dataDesligamento;
      const ficaAtivo = estaAtivo(desligamentoFinal, hoje);

      // Readmissão ou troca de CPF de quem fica ativo: o CPF não pode estar com outro funcionário ativo.
      const cpfFinal = dados.cpf ?? atual.cpf;
      if (ficaAtivo && (!estavaAtivo || cpfFinal !== atual.cpf)) {
        const outro = await this.funcionarios.outroAtivoComCpf(cpfFinal, hoje, id);
        if (outro !== null) throw new CadastroDuplicado(mensagemDeCpfDuplicado(outro.nome));
      }

      let operacao: OperacaoAuditada = 'ALTERACAO';
      if (estavaAtivo && !ficaAtivo) operacao = 'INATIVACAO';
      if (!estavaAtivo && ficaAtivo) operacao = 'REATIVACAO';

      const alterado = await this.funcionarios.alterar(id, dados, ficaAtivo, operacao, hoje, autorId);
      return comSituacao(alterado, hoje);
    });
  }
}

import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { FuncionariosRepositorio } from '../infra/funcionarios.repositorio.js';
import {
  comSituacao,
  type FiltroDeSituacaoDoFuncionario,
  type FuncionarioComSituacao,
} from './funcionario-com-situacao.js';

// Caso de uso [Cadastros.RF002]: lista os funcionários pela situação de hoje. Sem filtro, só os ativos
// (é o que o vínculo de pagamento em Movimentações usa). `hoje` entra por parâmetro para os testes.
@Injectable()
export class ListarFuncionarios {
  constructor(private readonly funcionarios: FuncionariosRepositorio) {}

  async executar(situacao: FiltroDeSituacaoDoFuncionario = 'ativos', hoje = hojeEmSaoPaulo()): Promise<FuncionarioComSituacao[]> {
    const todos = (await this.funcionarios.listar()).map((funcionario) => comSituacao(funcionario, hoje));
    if (situacao === 'todos') return todos;
    return todos.filter((funcionario) => funcionario.ativo === (situacao === 'ativos'));
  }
}

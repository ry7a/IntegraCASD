import { Injectable } from '@nestjs/common';
import { ClienteAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { BuscarAluno } from '../../cadastros/index.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';

// Caso de uso (worker): deixa o cliente do Asaas com o nome, o CPF e o e-mail atuais do aluno, depois
// de uma alteração no cadastro. Lê o aluno de novo (e não os dados do evento), então rodar duas vezes
// dá o mesmo resultado. Aluno que nunca recebeu cobrança não tem cliente no Asaas: nada a fazer.
// Se o Asaas falhar, o erro sobe e o pg-boss tenta de novo.
@Injectable()
export class AtualizarClienteAsaas {
  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly asaas: ClienteAsaas,
    private readonly buscarAluno: BuscarAluno,
  ) {}

  async executar(alunoId: string): Promise<'atualizado' | 'sem-cliente'> {
    const idAsaas = await this.cobrancas.idClienteAsaasDoAluno(alunoId);
    if (idAsaas === null) return 'sem-cliente';
    const aluno = await this.buscarAluno.executar(alunoId);
    await this.asaas.atualizarCliente(idAsaas, { nome: aluno.nome, cpf: aluno.cpf, email: aluno.email });
    return 'atualizado';
  }
}

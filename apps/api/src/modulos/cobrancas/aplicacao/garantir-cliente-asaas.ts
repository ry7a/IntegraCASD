import { Injectable } from '@nestjs/common';
import { ClienteAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';

export type AlunoParaOAsaas = { id: string; nome: string; cpf: string; email: string };

// O Asaas cobra "clientes": cada aluno vira um cliente lá na primeira cobrança. Este serviço devolve
// o id do cliente do aluno, criando no Asaas e guardando o vínculo se ainda não existir.
@Injectable()
export class GarantirClienteAsaas {
  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly asaas: ClienteAsaas,
  ) {}

  async executar(aluno: AlunoParaOAsaas): Promise<string> {
    const existente = await this.cobrancas.idClienteAsaasDoAluno(aluno.id);
    if (existente !== null) return existente;

    const criado = await this.asaas.criarCliente({ nome: aluno.nome, cpf: aluno.cpf, email: aluno.email });
    try {
      await this.cobrancas.registrarClienteAsaas(aluno.id, criado.idAsaas);
      return criado.idAsaas;
    } catch (erro) {
      // Duas emissões ao mesmo tempo para o mesmo aluno: a outra gravou primeiro; usa o vínculo dela.
      const gravadoPorOutra = await this.cobrancas.idClienteAsaasDoAluno(aluno.id);
      if (gravadoPorOutra !== null) return gravadoPorOutra;
      throw erro;
    }
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventosInternos } from '../../../compartilhado/eventos/eventos-internos.js';
import { AgendadorDeRotinas, ROTINA_ATUALIZAR_CLIENTE_ASAAS } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { AtualizarClienteAsaas } from '../aplicacao/atualizar-cliente-asaas.js';

// Quando o Cadastros avisa "aluno alterado", Cobranças pede ao worker que atualize o cliente no Asaas.
// Pela fila (e não na hora): o cadastro já foi salvo, e se o Asaas estiver fora do ar o pg-boss tenta
// de novo, sem travar a tela de quem alterou o aluno.
@Injectable()
export class ReacaoAAlunoAlterado implements OnModuleInit {
  constructor(
    private readonly eventos: EventosInternos,
    private readonly agendador: AgendadorDeRotinas,
    private readonly atualizarClienteAsaas: AtualizarClienteAsaas,
  ) {}

  onModuleInit(): void {
    this.eventos.ouvir('aluno-alterado', async ({ alunoId }) => {
      await this.agendador.executarAgora(ROTINA_ATUALIZAR_CLIENTE_ASAAS, { alunoId });
    });
  }

  // Só o worker chama (main-worker.ts): liga a rotina ao caso de uso.
  async iniciar(): Promise<void> {
    await this.agendador.consumir(ROTINA_ATUALIZAR_CLIENTE_ASAAS, async (dados) => {
      if (typeof dados.alunoId === 'string') await this.atualizarClienteAsaas.executar(dados.alunoId);
    });
  }
}

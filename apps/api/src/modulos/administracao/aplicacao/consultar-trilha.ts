import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { FiltroDaTrilhaInvalido, lerFiltrosDaTrilha } from '../dominio/trilha.js';
import { TrilhaRepositorio, type RegistroDaTrilha } from '../infra/trilha.repositorio.js';

export type { RegistroDaTrilha };

// Caso de uso [Administração.RF005]: operações que alteraram dados, da mais recente para a mais
// antiga. Não altera nada; não há operação de alterar ou excluir a trilha (fluxo E1).
@Injectable()
export class ConsultarTrilha {
  constructor(private readonly trilha: TrilhaRepositorio) {}

  async executar(consulta: Record<string, unknown>, hoje = hojeEmSaoPaulo()): Promise<{ itens: RegistroDaTrilha[]; total: number }> {
    try {
      return await this.trilha.listar(lerFiltrosDaTrilha(consulta, hoje));
    } catch (erro) {
      if (erro instanceof FiltroDaTrilhaInvalido) throw new BadRequestException(erro.message);
      throw erro;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { geracaoAPartirDeDoAmbiente } from '../../../compartilhado/geracao-a-partir-de.js';
import { ListarAlunosCobraveis } from '../../cadastros/index.js';
import { conferir, type Conferencia } from '../dominio/parametros-de-cobranca.js';
import { ParametrosRepositorio, type ParametrosVigentes } from '../infra/parametros.repositorio.js';

export type ConsultaDosParametros = {
  // Nulo enquanto a diretoria não cadastrar os parâmetros pela primeira vez.
  vigentes: ParametrosVigentes | null;
  conferencia: Conferencia | null;
};

// Caso de uso [Administração.RF003]: parâmetros vigentes, autor e data da última alteração, e a
// conferência da próxima geração. As últimas execuções entram com a geração recorrente (Cobranças.RF001).
@Injectable()
export class ConsultarParametrosDeCobranca {
  constructor(
    private readonly parametros: ParametrosRepositorio,
    private readonly listarAlunosCobraveis: ListarAlunosCobraveis,
  ) {}

  // `aPartirDe` é a trava GERACAO_A_PARTIR_DE do .env, lida a cada consulta.
  async executar(hoje = hojeEmSaoPaulo(), aPartirDe = geracaoAPartirDeDoAmbiente()): Promise<ConsultaDosParametros> {
    const vigentes = await this.parametros.buscarVigentes();
    if (vigentes === null) return { vigentes: null, conferencia: null };
    const alunos = await this.listarAlunosCobraveis.executar();
    return { vigentes, conferencia: conferir(vigentes, hoje, alunos.length, aPartirDe) };
  }
}

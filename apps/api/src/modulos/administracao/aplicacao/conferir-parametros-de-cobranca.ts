import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { geracaoAPartirDeDoAmbiente } from '../../../compartilhado/geracao-a-partir-de.js';
import { ListarAlunosCobraveis } from '../../cadastros/index.js';
import { conferir, lerParametros, type Conferencia, type ParametrosDeCobranca } from '../dominio/parametros-de-cobranca.js';
import { traduzirErrosDosParametros } from './erros-dos-parametros.js';

// Caso de uso [Administração.RF003], passo 4: mostra o efeito dos valores digitados antes de
// salvar (próxima geração, vencimento, alunos cobrados e total). Não grava nada.
@Injectable()
export class ConferirParametrosDeCobranca {
  constructor(private readonly listarAlunosCobraveis: ListarAlunosCobraveis) {}

  // `aPartirDe` é a trava GERACAO_A_PARTIR_DE do .env, lida a cada consulta.
  executar(
    entrada: Partial<Record<keyof ParametrosDeCobranca, unknown>>,
    hoje = hojeEmSaoPaulo(),
    aPartirDe = geracaoAPartirDeDoAmbiente(),
  ): Promise<Conferencia> {
    return traduzirErrosDosParametros(async () => {
      const parametros = lerParametros(entrada);
      const alunos = await this.listarAlunosCobraveis.executar();
      return conferir(parametros, hoje, alunos.length, aPartirDe);
    });
  }
}

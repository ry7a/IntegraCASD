import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { AgendadorDeRotinas, ROTINA_GERACAO_RECORRENTE } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { CobrancaInvalida } from '../dominio/cobranca.js';
import { referenciaDoCiclo } from '../dominio/geracao-recorrente.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

// Caso de uso [Cobranças.RF001] fluxo A2: depois de corrigir os cadastros, a área administrativa pede
// a geração de novo, só para os pendentes (quem já tem a mensalidade do mês é pulado). As condições são
// conferidas aqui, para a resposta ser imediata; a geração em si roda no worker.
@Injectable()
export class PedirGeracaoAgora {
  constructor(
    private readonly parametros: BuscarParametrosVigentes,
    private readonly agendador: AgendadorDeRotinas,
  ) {}

  executar(hoje = hojeEmSaoPaulo()): Promise<{ referencia: string }> {
    return traduzirErrosDaCobranca(async () => {
      const parametros = await this.parametros.executar();
      if (parametros === null) {
        throw new CobrancaInvalida('Os parâmetros de cobrança ainda não foram cadastrados. Peça à diretoria para cadastrá-los.');
      }
      const referencia = referenciaDoCiclo(hoje, parametros.diaGeracao);
      if (referencia === null) {
        throw new CobrancaInvalida(`A geração deste mês começa no dia ${parametros.diaGeracao}. Tente a partir dessa data.`);
      }
      await this.agendador.executarAgora(ROTINA_GERACAO_RECORRENTE, { origem: 'MANUAL' });
      return { referencia };
    });
  }
}

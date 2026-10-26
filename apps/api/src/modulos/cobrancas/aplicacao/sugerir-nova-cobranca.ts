import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { vencimentoSugerido } from '../dominio/cobranca.js';

export type SugestaoDeNovaCobranca = {
  // Falso enquanto a diretoria não cadastrar os parâmetros: a emissão fica indisponível.
  parametrosCadastrados: boolean;
  vencimentoSugerido: string | null;
  multaPercentual: number | null;
  jurosMensalPercentual: number | null;
};

// Caso de uso [Cobranças.RF002], passo 2: vencimento sugerido pelos parâmetros vigentes e as
// condições de atraso que serão enviadas ao Asaas, para o formulário mostrar.
@Injectable()
export class SugerirNovaCobranca {
  constructor(private readonly parametros: BuscarParametrosVigentes) {}

  async executar(hoje = hojeEmSaoPaulo()): Promise<SugestaoDeNovaCobranca> {
    const vigentes = await this.parametros.executar();
    if (vigentes === null) {
      return { parametrosCadastrados: false, vencimentoSugerido: null, multaPercentual: null, jurosMensalPercentual: null };
    }
    return {
      parametrosCadastrados: true,
      vencimentoSugerido: vencimentoSugerido(hoje, vigentes.diaVencimento),
      multaPercentual: vigentes.multaPercentual,
      jurosMensalPercentual: vigentes.jurosMensalPercentual,
    };
  }
}

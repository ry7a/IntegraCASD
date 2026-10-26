import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { CobrancaInvalida, conferirPagamentoManual, lerPagamentoManual, type PagamentoManual } from '../dominio/cobranca.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

// Caso de uso [Cobranças.RF006]: registra o pagamento de uma cobrança que não passou pela conciliação
// (Pix direto na conta do CASD, por exemplo). A cobrança fica "Paga com registro manual", distinta de
// "Paga", e a entrada vai para a conta e a categoria escolhidas nos parâmetros de cobrança.
@Injectable()
export class RegistrarPagamentoManual {
  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly parametros: BuscarParametrosVigentes,
  ) {}

  executar(
    id: string,
    entrada: Partial<Record<keyof PagamentoManual, unknown>>,
    autorId: string,
    hoje = hojeEmSaoPaulo(),
  ): Promise<void> {
    return traduzirErrosDaCobranca(async () => {
      const cobranca = await this.cobrancas.buscarPorId(id);
      if (cobranca === null) throw new NotFoundException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.');
      conferirPagamentoManual(cobranca.situacao);
      const pagamento = lerPagamentoManual(entrada, hoje);

      const vigentes = await this.parametros.executar();
      const categoriaId = cobranca.origem === 'MENSALIDADE' ? vigentes?.categoriaMensalidadeId : vigentes?.categoriaAvulsaId;
      if (!vigentes?.contaRecebimentoId || !categoriaId) {
        throw new CobrancaInvalida(
          'Falta escolher a conta de recebimento e as categorias em Administração > Parâmetros. Peça à diretoria e tente de novo.',
        );
      }
      await this.cobrancas.registrarPagamentoManual(cobranca, pagamento, { contaId: vigentes.contaRecebimentoId, categoriaId }, autorId);
    });
  }
}

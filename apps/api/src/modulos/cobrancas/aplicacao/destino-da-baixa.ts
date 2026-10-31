import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { OrigemDaCobranca } from '../dominio/cobranca.js';
import type { DestinoDaBaixa } from '../infra/conciliacao.repositorio.js';

// Conta e categoria onde entra o pagamento de uma cobrança, conforme a origem dela, escolhidas nos
// parâmetros de cobrança. Nulo enquanto a diretoria não escolher: quem chama decide o que fazer
// (a conciliação espera; o registro manual avisa o usuário).
export async function buscarDestinoDaBaixa(
  parametros: BuscarParametrosVigentes,
  origem: OrigemDaCobranca,
): Promise<DestinoDaBaixa | null> {
  const vigentes = await parametros.executar();
  // A herdada (ADR-0005) é mensalidade de antes da implantação: entra na mesma categoria.
  const categoriaId = origem === 'AVULSA' ? vigentes?.categoriaAvulsaId : vigentes?.categoriaMensalidadeId;
  if (!vigentes?.contaRecebimentoId || !categoriaId) return null;
  return { contaId: vigentes.contaRecebimentoId, categoriaId };
}

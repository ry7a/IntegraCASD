import type { BuscarParametrosVigentes } from '../../administracao/index.js';
import type { DestinoDaBaixa } from '../infra/conciliacao.repositorio.js';

// Conta e categoria onde entra o pagamento de uma cobrança, conforme a origem dela, escolhidas nos
// parâmetros de cobrança. Nulo enquanto a diretoria não escolher: quem chama decide o que fazer
// (a conciliação espera; o registro manual avisa o usuário).
export async function buscarDestinoDaBaixa(
  parametros: BuscarParametrosVigentes,
  origem: 'MENSALIDADE' | 'AVULSA',
): Promise<DestinoDaBaixa | null> {
  const vigentes = await parametros.executar();
  const categoriaId = origem === 'MENSALIDADE' ? vigentes?.categoriaMensalidadeId : vigentes?.categoriaAvulsaId;
  if (!vigentes?.contaRecebimentoId || !categoriaId) return null;
  return { contaId: vigentes.contaRecebimentoId, categoriaId };
}

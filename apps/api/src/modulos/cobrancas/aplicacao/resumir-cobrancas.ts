import { Injectable } from '@nestjs/common';
import { ClienteAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import type { SituacaoExibida } from '../dominio/cobranca.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { PendenciasRepositorio } from '../infra/pendencias.repositorio.js';
import { SincronizacaoRepositorio, type ExecucaoDaSincronizacao } from '../infra/sincronizacao.repositorio.js';

export type ResumoDasCobrancas = {
  // Mês dos totais das situações finais (pagas, canceladas, estornadas), "AAAA-MM".
  mes: string;
  situacoes: Array<{ situacao: SituacaoExibida; quantidade: number; valorCentavos: number }>;
  conciliacao: {
    ativa: boolean;
    ultimaNotificacaoEm: Date | null;
    ultimaSincronizacao: ExecucaoDaSincronizacao | null;
    // Itens abertos na fila de pendências de conciliação.
    pendenciasAbertas: number;
  };
};

// Caso de uso [Cobranças.RF008], passo 2: estado da conciliação e totais por situação.
@Injectable()
export class ResumirCobrancas {
  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly asaas: ClienteAsaas,
    private readonly sincronizacoes: SincronizacaoRepositorio,
    private readonly pendencias: PendenciasRepositorio,
  ) {}

  async executar(hoje = hojeEmSaoPaulo()): Promise<ResumoDasCobrancas> {
    const mes = hoje.slice(0, 7);
    const [situacoes, ultimaNotificacaoEm, ativa, ultimaSincronizacao, pendenciasAbertas] = await Promise.all([
      this.cobrancas.resumir(hoje, `${mes}-01`),
      this.cobrancas.ultimaNotificacaoEm(),
      this.asaas.estaConfigurado(),
      this.sincronizacoes.ultimaGeral(),
      this.pendencias.contarAbertas(),
    ]);
    return { mes, situacoes, conciliacao: { ativa, ultimaNotificacaoEm, ultimaSincronizacao, pendenciasAbertas } };
  }
}

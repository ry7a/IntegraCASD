import { Injectable } from '@nestjs/common';
import { MovimentacoesRepositorio } from '../infra/movimentacoes.repositorio.js';

// Caso de uso exportado (Cadastros usa nas abas Contratos e Projetos): quanto já foi movimentado em
// cada contrato e projeto. Estornos ficam de fora: o par estornada + espelho se anula (MER, "Total
// pago num contrato ou projeto").
@Injectable()
export class TotaisPorVinculo {
  constructor(private readonly movimentacoes: MovimentacoesRepositorio) {}

  // [Cadastros.RF004] Saídas pagas em cada contrato no ano ("AAAA"), por id do contrato.
  pagoPorContrato(ano: string): Promise<Map<string, number>> {
    return this.movimentacoes.saidasPorContrato(ano);
  }

  // [Cadastros.RF005] Saídas e entradas de cada projeto, desde sempre, por id do projeto.
  movimentadoPorProjeto(): Promise<Map<string, { saidasCentavos: number; entradasCentavos: number }>> {
    return this.movimentacoes.movimentadoPorProjeto();
  }
}

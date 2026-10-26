import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, hojeEmSaoPaulo, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { AcaoDaConciliacao } from '../dominio/conciliacao.js';
import type { SituacaoGuardada } from '../dominio/cobranca.js';

export type CobrancaParaConciliar = {
  id: string;
  idAsaas: string;
  origem: 'MENSALIDADE' | 'AVULSA';
  descricao: string;
  situacao: SituacaoGuardada;
  valorCentavos: number;
  disponivelEm: string | null;
  movimentacaoId: string | null;
};

// Onde entra o dinheiro da baixa: conta e categoria escolhidas nos parâmetros de cobrança.
export type DestinoDaBaixa = { contaId: string; categoriaId: string };

// Outra conciliação mudou a cobrança entre a leitura e a gravação (dois avisos ao mesmo tempo).
// A transação é desfeita e a fila tenta de novo; na nova tentativa a decisão já vê a situação nova.
export class ConciliacaoConcorrente extends Error {
  constructor() {
    super('A cobrança mudou durante a conciliação; o evento será processado de novo.');
  }
}

// Só para o texto da trilha. Conta com inteiros: o valor nunca vira fração (regra B5).
function formatarReais(centavos: number): string {
  return `R$ ${Math.trunc(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

// Acesso ao banco da conciliação [Cobranças.RF005]. Cada evento é aplicado numa transação só:
// marcar o evento como processado, mudar a cobrança, criar a movimentação e gravar a trilha
// acontecem juntos ou não acontecem [Confiabilidade.NF004].
@Injectable()
export class ConciliacaoRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async buscarCobranca(idAsaas: string): Promise<CobrancaParaConciliar | null> {
    const registro = await this.prisma.cobranca.findUnique({
      where: { idAsaas },
      select: {
        id: true,
        idAsaas: true,
        origem: true,
        descricao: true,
        situacao: true,
        valorCentavos: true,
        disponivelEm: true,
        movimentacaoId: true,
      },
    });
    if (registro === null) return null;
    return { ...registro, disponivelEm: registro.disponivelEm === null ? null : paraDia(registro.disponivelEm) };
  }

  // Devolve 'ja-processado' se outro processamento marcou o evento primeiro: aí nada é alterado.
  async aplicar(
    evento: { id: string; idAsaas: string },
    cobranca: CobrancaParaConciliar | null,
    acao: AcaoDaConciliacao,
    destino: DestinoDaBaixa | null,
  ): Promise<'aplicado' | 'ja-processado'> {
    return this.prisma.$transaction(async (tx) => {
      // Idempotência [Confiabilidade.NF003]: só um processamento consegue marcar o evento.
      const marcado = await tx.eventoWebhook.updateMany({
        where: { id: evento.id, processadoEm: null },
        data: { processadoEm: new Date(), pendencia: acao.tipo === 'PENDENCIA' ? acao.motivo : null },
      });
      if (marcado.count === 0) return 'ja-processado';
      if (cobranca === null || acao.tipo === 'NADA' || acao.tipo === 'PENDENCIA') return 'aplicado';

      const rotulo = `"${cobranca.descricao}" (${cobranca.idAsaas})`;

      if (acao.tipo === 'BAIXAR') {
        if (destino === null) throw new Error('Baixa sem conta e categoria de destino.');
        const entrada = await tx.movimentacao.create({
          data: {
            contaId: destino.contaId,
            categoriaId: destino.categoriaId,
            tipo: 'ENTRADA',
            valorCentavos: acao.valorPagoCentavos,
            data: deDia(acao.pagoEm),
            formaPagamento: 'ASAAS',
            origem: 'CONCILIACAO_AUTOMATICA',
            descricao: `Cobrança ${rotulo} paga`,
          },
        });
        const baixada = await tx.cobranca.updateMany({
          where: { id: cobranca.id, situacao: 'ABERTA' },
          data: {
            situacao: 'PAGA',
            pagaEm: deDia(acao.pagoEm),
            disponivelEm: acao.disponivelEm === null ? null : deDia(acao.disponivelEm),
            movimentacaoId: entrada.id,
          },
        });
        if (baixada.count === 0) throw new ConciliacaoConcorrente();
        await registrarNaTrilha(tx, {
          usuarioId: null,
          operacao: 'ALTERACAO',
          entidade: 'COBRANCA',
          registroId: cobranca.id,
          detalhe: `Paga pelo Asaas em ${acao.pagoEm} (${formatarReais(acao.valorPagoCentavos)}), aviso ${evento.idAsaas}.`,
        });
        await registrarNaTrilha(tx, {
          usuarioId: null,
          operacao: 'INCLUSAO',
          entidade: 'MOVIMENTACAO',
          registroId: entrada.id,
          detalhe: `Entrada de ${formatarReais(acao.valorPagoCentavos)} pela conciliação da cobrança ${rotulo}.`,
        });
        return 'aplicado';
      }

      if (acao.tipo === 'MARCAR_DISPONIVEL') {
        await tx.cobranca.updateMany({
          where: { id: cobranca.id, situacao: 'PAGA', disponivelEm: null },
          data: { disponivelEm: deDia(acao.disponivelEm) },
        });
        await registrarNaTrilha(tx, {
          usuarioId: null,
          operacao: 'ALTERACAO',
          entidade: 'COBRANCA',
          registroId: cobranca.id,
          detalhe: `Valor disponível na conta do Asaas em ${acao.disponivelEm}, aviso ${evento.idAsaas}.`,
        });
        return 'aplicado';
      }

      if (acao.tipo === 'ESTORNAR') {
        if (cobranca.movimentacaoId === null) throw new Error(`Cobrança paga sem movimentação: ${cobranca.id}.`);
        const original = await tx.movimentacao.findUniqueOrThrow({ where: { id: cobranca.movimentacaoId } });
        const estornada = await tx.cobranca.updateMany({
          where: { id: cobranca.id, situacao: 'PAGA' },
          data: { situacao: 'ESTORNADA' },
        });
        if (estornada.count === 0) throw new ConciliacaoConcorrente();
        // A entrada nunca é apagada nem alterada: é anulada por uma movimentação espelho.
        const espelho = await tx.movimentacao.create({
          data: {
            contaId: original.contaId,
            categoriaId: original.categoriaId,
            tipo: 'SAIDA',
            valorCentavos: original.valorCentavos,
            data: deDia(hojeEmSaoPaulo()),
            formaPagamento: 'ASAAS',
            origem: 'ESTORNO',
            estornoDeId: original.id,
            motivoEstorno: `Pagamento estornado no Asaas (aviso ${evento.idAsaas}).`,
            descricao: `Estorno da cobrança ${rotulo}`,
          },
        });
        await registrarNaTrilha(tx, {
          usuarioId: null,
          operacao: 'ESTORNO',
          entidade: 'COBRANCA',
          registroId: cobranca.id,
          detalhe: `Pagamento estornado no Asaas, aviso ${evento.idAsaas}.`,
        });
        await registrarNaTrilha(tx, {
          usuarioId: null,
          operacao: 'ESTORNO',
          entidade: 'MOVIMENTACAO',
          registroId: espelho.id,
          detalhe: `Estorno de ${formatarReais(original.valorCentavos)} da entrada da cobrança ${rotulo}.`,
        });
        return 'aplicado';
      }

      // CANCELAR: a cobrança foi removida no painel do Asaas.
      const cancelada = await tx.cobranca.updateMany({
        where: { id: cobranca.id, situacao: 'ABERTA' },
        data: { situacao: 'CANCELADA', canceladaEm: new Date(), motivoCancelamento: 'Removida no painel do Asaas.' },
      });
      if (cancelada.count === 0) throw new ConciliacaoConcorrente();
      await registrarNaTrilha(tx, {
        usuarioId: null,
        operacao: 'CANCELAMENTO',
        entidade: 'COBRANCA',
        registroId: cobranca.id,
        detalhe: `Cobrança removida no painel do Asaas, aviso ${evento.idAsaas}.`,
      });
      return 'aplicado';
    });
  }
}

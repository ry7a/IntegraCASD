import { ApiProperty } from '@nestjs/swagger';

// DTOs das movimentações [Movimentações.RF001 a RF003]. Dinheiro em centavos; dias em "AAAA-MM-DD".

const TIPOS = ['ENTRADA', 'SAIDA'] as const;
const FORMAS = ['ASAAS', 'PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'] as const;
const ORIGENS = ['MANUAL', 'CONCILIACAO_AUTOMATICA', 'REGISTRO_MANUAL_DE_COBRANCA', 'ESTORNO'] as const;

export class VinculoDto {
  @ApiProperty({ enum: ['COBRANCA', 'CONTRATO', 'PROJETO', 'FUNCIONARIO'], enumName: 'TipoDeVinculo' })
  tipo!: 'COBRANCA' | 'CONTRATO' | 'PROJETO' | 'FUNCIONARIO';
  @ApiProperty({ type: String, nullable: true, description: 'Aluno da cobrança, contrato, projeto ou funcionário' })
  nome!: string | null;
}

export class MovimentacaoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) data!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty({ enum: TIPOS, enumName: 'TipoMovimentacao' }) tipo!: (typeof TIPOS)[number];
  @ApiProperty({ description: 'Sempre positivo, em centavos; o sinal vem do tipo' }) valorCentavos!: number;
  @ApiProperty() categoriaNome!: string;
  @ApiProperty({ enum: FORMAS, enumName: 'FormaPagamento' }) forma!: (typeof FORMAS)[number];
  @ApiProperty({ enum: ORIGENS, enumName: 'OrigemMovimentacao' }) origem!: (typeof ORIGENS)[number];
  @ApiProperty() contaNome!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Nulo = rotina automática' }) registradaPor!: string | null;
  @ApiProperty({ type: VinculoDto, nullable: true }) vinculo!: VinculoDto | null;
  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Preenchido na movimentação estornada' })
  estornadaEm!: string | null;
  @ApiProperty({ type: String, nullable: true }) motivoEstorno!: string | null;
  @ApiProperty({ description: 'Só lançamento manual, ainda não estornado' }) podeEstornar!: boolean;
  @ApiProperty({ type: String, nullable: true }) motivoSemEstorno!: string | null;
}

export class TotaisDto {
  @ApiProperty() entradasCentavos!: number;
  @ApiProperty() quantidadeEntradas!: number;
  @ApiProperty() saidasCentavos!: number;
  @ApiProperty() quantidadeSaidas!: number;
  @ApiProperty({ description: 'Entradas menos saídas. Estornos e transferências entre contas não entram' })
  saldoCentavos!: number;
}

export class ListaDeMovimentacoesDto {
  @ApiProperty({ type: [MovimentacaoDto], description: 'Das mais recentes para as mais antigas' }) itens!: MovimentacaoDto[];
  @ApiProperty() total!: number;
  @ApiProperty({ type: TotaisDto, description: 'Do mesmo recorte da lista' }) totais!: TotaisDto;
}

export class ContaDaOpcaoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ enum: ['CORRENTE', 'APLICACAO'], enumName: 'TipoConta' }) tipo!: 'CORRENTE' | 'APLICACAO';
}

export class CategoriaDaOpcaoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ enum: ['ENTRADA', 'SAIDA', 'AMBOS'], enumName: 'TipoCategoria' }) tipo!: 'ENTRADA' | 'SAIDA' | 'AMBOS';
}

export class ContratoParaVincularDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Valor previsto por periodicidade' }) valorCentavos!: number;
  @ApiProperty({ enum: ['MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA'], enumName: 'PeriodicidadeContrato' })
  periodicidade!: 'MENSAL' | 'ANUAL' | 'POR_DEMANDA' | 'UNICA';
  @ApiProperty({ description: 'Saídas já pagas neste contrato no ano' }) pagoNoAnoCentavos!: number;
}

export class ProjetoParaVincularDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Executado: aceita lançamento, mas a tela sinaliza' }) encerrado!: boolean;
}

export class OpcaoDeVinculoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
}

export class OpcoesDaMovimentacaoDto {
  @ApiProperty({ type: [ContaDaOpcaoDto] }) contas!: ContaDaOpcaoDto[];
  @ApiProperty({ type: [CategoriaDaOpcaoDto], description: 'Ativas' }) categorias!: CategoriaDaOpcaoDto[];
  @ApiProperty({ type: [ContratoParaVincularDto], description: 'Ativos' }) contratos!: ContratoParaVincularDto[];
  @ApiProperty({ type: [ProjetoParaVincularDto], description: 'Não cancelados' }) projetos!: ProjetoParaVincularDto[];
  @ApiProperty({ type: [OpcaoDeVinculoDto], description: 'Ativos' }) funcionarios!: OpcaoDeVinculoDto[];
}

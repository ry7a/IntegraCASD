import { BadRequestException, Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ListarCobrancasDoAluno, TotaisEmAbertoPorAluno } from '../aplicacao/cobrancas-do-aluno.js';

export class CobrancaDoAlunoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty({ enum: ['MENSALIDADE', 'AVULSA'], enumName: 'OrigemCobranca' }) origem!: 'MENSALIDADE' | 'AVULSA';
  @ApiProperty() valorCentavos!: number;
  @ApiProperty({ format: 'date' }) vencimento!: string;
  @ApiProperty({ enum: ['ABERTA', 'VENCIDA', 'PAGA', 'PAGA_COM_REGISTRO_MANUAL', 'CANCELADA', 'ESTORNADA'], enumName: 'SituacaoCobranca' })
  situacao!: 'ABERTA' | 'VENCIDA' | 'PAGA' | 'PAGA_COM_REGISTRO_MANUAL' | 'CANCELADA' | 'ESTORNADA';
  @ApiProperty({ type: Number, nullable: true }) diasDeAtraso!: number | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) pagaEm!: string | null;
}

export class CobrancasDoAlunoDto {
  @ApiProperty({ type: [CobrancaDoAlunoDto], description: 'Das mais recentes para as mais antigas' }) itens!: CobrancaDoAlunoDto[];
  @ApiProperty({ description: 'Abertas, vencidas ou não' }) totalEmAbertoCentavos!: number;
  @ApiProperty() quantidadeVencidas!: number;
  @ApiProperty() totalVencidoCentavos!: number;
}

export class TotaisDoAlunoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() totalEmAbertoCentavos!: number;
  @ApiProperty() quantidadeVencidas!: number;
  @ApiProperty() totalVencidoCentavos!: number;
}

export class ListaDeTotaisPorAlunoDto {
  @ApiProperty({ type: [TotaisDoAlunoDto], description: 'Só alunos com alguma cobrança aberta' }) itens!: TotaisDoAlunoDto[];
}

const ID_DO_ALUNO = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Aluno não encontrado. Volte à lista e escolha outro aluno.'),
});

// As cobranças vistas a partir do aluno [Cadastros.RF001]. Ficam em Cobranças (e não em Cadastros)
// porque o Cadastros não depende do módulo de Cobranças.
@ApiTags('cobrancas')
@ApiCookieAuth('cookie')
@Controller()
export class CobrancasDoAlunoController {
  constructor(
    private readonly listarDoAluno: ListarCobrancasDoAluno,
    private readonly totaisPorAluno: TotaisEmAbertoPorAluno,
  ) {}

  @Get('alunos/:alunoId/cobrancas')
  @ApiOperation({ operationId: 'listarCobrancasDoAluno', summary: 'Cobranças de um aluno, com o total em aberto e o vencido' })
  @ApiOkResponse({ type: CobrancasDoAlunoDto })
  async doAluno(@Param('alunoId', ID_DO_ALUNO) alunoId: string): Promise<CobrancasDoAlunoDto> {
    const { itens, ...totais } = await this.listarDoAluno.executar(alunoId);
    return {
      itens: itens.map((item) => ({
        id: item.id,
        descricao: item.descricao,
        origem: item.origem,
        valorCentavos: item.valorCentavos,
        vencimento: item.vencimento,
        situacao: item.situacao,
        diasDeAtraso: item.diasDeAtraso,
        pagaEm: item.pagaEm,
      })),
      ...totais,
    };
  }

  // Dois segmentos de propósito: "cobrancas/:id" (um segmento) é o detalhe da cobrança.
  @Get('cobrancas/totais/por-aluno')
  @ApiOperation({ operationId: 'listarTotaisEmAbertoPorAluno', summary: 'Total em aberto e vencido de cada aluno com cobrança aberta' })
  @ApiOkResponse({ type: ListaDeTotaisPorAlunoDto })
  async porAluno(): Promise<ListaDeTotaisPorAlunoDto> {
    return { itens: await this.totaisPorAluno.executar() };
  }
}

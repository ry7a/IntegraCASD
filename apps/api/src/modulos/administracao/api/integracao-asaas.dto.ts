import { ApiProperty } from '@nestjs/swagger';

// DTOs da integração com o Asaas [Administração.RF004]. A chave de acesso só entra (no corpo da
// substituição) e nunca sai em resposta nenhuma [Segurança.NF003].

const AMBIENTES = ['SANDBOX', 'PRODUCAO'];
const PRAZOS = [12, 24, 48];

export class IntegracaoAsaasDto {
  @ApiProperty({ enum: AMBIENTES, enumName: 'AmbienteAsaas', nullable: true, description: 'Nulo quando não há chave' })
  ambiente!: 'SANDBOX' | 'PRODUCAO' | null;
  @ApiProperty({ description: 'Há uma chave utilizável pelo sistema' }) conectada!: boolean;
  @ApiProperty({
    enum: ['TELA', 'ARQUIVO_ENV'],
    enumName: 'OrigemDaChaveAsaas',
    nullable: true,
    description: 'TELA: cadastrada pela diretoria; ARQUIVO_ENV: lida do .env (desenvolvimento)',
  })
  origemDaChave!: 'TELA' | 'ARQUIVO_ENV' | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) chaveCadastradaEm!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) ultimoTesteEm!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Nome de quem fez a última alteração' })
  alteradoPor!: string | null;
  @ApiProperty({ enum: PRAZOS, enumName: 'PrazoDoAlertaHoras', description: 'Alerta a diretoria após este tempo sem notificações' })
  prazoAlertaHoras!: number;
}

export class SubstituirChaveAsaasDto {
  @ApiProperty({ enum: AMBIENTES, enumName: 'AmbienteAsaas' }) ambiente!: 'SANDBOX' | 'PRODUCAO';
  @ApiProperty({ description: 'Chave da API, como aparece no painel do Asaas. Nunca é devolvida.' }) chave!: string;
  @ApiProperty({ enum: PRAZOS, enumName: 'PrazoDoAlertaHoras', required: false, description: 'Se omitido, mantém o prazo atual' })
  prazoAlertaHoras?: number;
}

export class PrazoDoAlertaDto {
  @ApiProperty({ enum: PRAZOS, enumName: 'PrazoDoAlertaHoras' }) prazoAlertaHoras!: number;
}

export class AmbienteDaIntegracaoDto {
  @ApiProperty({ enum: AMBIENTES, enumName: 'AmbienteAsaas', nullable: true, description: 'Nulo quando não há chave' })
  ambiente!: 'SANDBOX' | 'PRODUCAO' | null;
}

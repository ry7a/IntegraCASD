import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PERFIS_USUARIO, type PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';

export class UsuarioDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: PERFIS_USUARIO }) perfil!: PerfilUsuario;
  @ApiProperty() ativo!: boolean;
  @ApiProperty({ nullable: true, type: String }) ultimoAcessoEm!: Date | null;
}

export class ListaDeUsuariosDto {
  @ApiProperty({ type: [UsuarioDto] }) itens!: UsuarioDto[];
}

export class CriarUsuarioDto {
  @ApiProperty() nome!: string;
  @ApiProperty({ example: 'usuario@casd.ita.br' }) email!: string;
  @ApiProperty({ enum: PERFIS_USUARIO }) perfil!: PerfilUsuario;
  @ApiPropertyOptional({ default: true }) ativo?: boolean;
  @ApiProperty({ minLength: 12, writeOnly: true }) senhaInicial!: string;
}

export class AlterarUsuarioDto {
  @ApiPropertyOptional() nome?: string;
  @ApiPropertyOptional({ example: 'usuario@casd.ita.br' }) email?: string;
  @ApiPropertyOptional({ enum: PERFIS_USUARIO }) perfil?: PerfilUsuario;
  @ApiPropertyOptional() ativo?: boolean;
  @ApiPropertyOptional({ minLength: 12, writeOnly: true }) novaSenha?: string;
}

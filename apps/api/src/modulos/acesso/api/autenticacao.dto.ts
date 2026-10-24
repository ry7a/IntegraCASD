import { ApiProperty } from '@nestjs/swagger';
import { PERFIS_USUARIO, type PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';

export class LoginDto {
  @ApiProperty({ example: 'diretoria@casd.ita.br' })
  email!: string;

  @ApiProperty({ minLength: 12, writeOnly: true })
  senha!: string;
}

export class UsuarioDaSessaoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: PERFIS_USUARIO })
  perfil!: PerfilUsuario;
}

import { Module } from '@nestjs/common';
import { UsuariosController } from './api/usuarios.controller.js';
import { UsuariosService } from './aplicacao/usuarios.service.js';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class AdministracaoModule {}

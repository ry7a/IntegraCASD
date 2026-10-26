import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutenticacaoGuard } from './autenticacao.guard.js';
import { PerfilGuard } from './perfil.guard.js';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PerfilGuard },
  ],
})
export class AutenticacaoModule {}

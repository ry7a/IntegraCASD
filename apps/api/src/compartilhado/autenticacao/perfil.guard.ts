import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PerfilUsuario } from './perfil.js';
import { CHAVE_PERFIS } from './perfis.decorator.js';
import type { RequisicaoAutenticada } from './usuario-autenticado.js';

@Injectable()
export class PerfilGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<PerfilUsuario[]>(CHAVE_PERFIS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!permitidos?.length) return true;

    const identidade = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuarioAutenticado;
    if (!identidade || !permitidos.includes(identidade.perfil)) {
      throw new ForbiddenException('Seu perfil nao permite realizar esta operacao.');
    }
    return true;
  }
}

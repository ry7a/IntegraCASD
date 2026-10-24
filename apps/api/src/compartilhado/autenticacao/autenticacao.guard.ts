import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHAVE_ROTA_PUBLICA } from './publico.decorator.js';
import { lerTokenDoCookie, resumirToken } from './sessao.js';
import type { RequisicaoAutenticada } from './usuario-autenticado.js';

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(CHAVE_ROTA_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publica) return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = lerTokenDoCookie(requisicao.headers.cookie);
    if (!token) throw new UnauthorizedException('Entre novamente para continuar.');

    const sessao = await this.prisma.sessao.findUnique({
      where: { tokenHash: resumirToken(token) },
      include: { usuario: true },
    });
    if (!sessao || sessao.revogadaEm || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) {
      throw new UnauthorizedException('Sua sessao expirou. Entre novamente para continuar.');
    }

    requisicao.usuarioAutenticado = {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      perfil: sessao.perfil,
      sessaoId: sessao.id,
    };
    return true;
  }
}

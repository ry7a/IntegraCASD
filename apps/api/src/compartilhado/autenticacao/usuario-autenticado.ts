import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PerfilUsuario } from './perfil.js';

export type IdentidadeDoUsuario = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  sessaoId: string;
};

export type RequisicaoAutenticada = Request & { usuarioAutenticado?: IdentidadeDoUsuario };

export const UsuarioAutenticado = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): IdentidadeDoUsuario => {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (!requisicao.usuarioAutenticado) throw new Error('A rota nao passou pelo guard de autenticacao.');
    return requisicao.usuarioAutenticado;
  },
);

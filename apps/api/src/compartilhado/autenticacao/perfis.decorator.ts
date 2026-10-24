import { SetMetadata } from '@nestjs/common';
import type { PerfilUsuario } from './perfil.js';

export const CHAVE_PERFIS = 'perfisPermitidos';
export const Perfis = (...perfis: PerfilUsuario[]) => SetMetadata(CHAVE_PERFIS, perfis);

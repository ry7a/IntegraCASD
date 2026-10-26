import type { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';

export type EntradaCriarUsuario = {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo?: boolean;
  senhaInicial: string;
};

export type EntradaAlterarUsuario = {
  nome?: string;
  email?: string;
  perfil?: PerfilUsuario;
  ativo?: boolean;
  novaSenha?: string;
};

export type UsuarioResumo = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  ultimoAcessoEm: Date | null;
};

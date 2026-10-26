export const PerfilUsuario = {
  ADMINISTRATIVO: 'ADMINISTRATIVO',
  DIRETORIA: 'DIRETORIA',
} as const;

export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];
export const PERFIS_USUARIO = Object.values(PerfilUsuario);

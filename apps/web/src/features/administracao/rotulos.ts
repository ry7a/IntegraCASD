import type { TipoCategoria } from '@integracasd/api-client'

// Os valores da API vêm em MAIÚSCULAS sem acento; o texto da tela fica aqui.
export const ROTULO_DO_TIPO_DA_CATEGORIA: Record<TipoCategoria, string> = {
  ENTRADA: 'Entradas',
  SAIDA: 'Saídas',
  AMBOS: 'Entradas e saídas',
}

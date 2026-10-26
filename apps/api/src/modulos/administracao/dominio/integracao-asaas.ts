// Regras da configuração da integração com o Asaas [Administração.RF004]. Só TypeScript puro.

export type Ambiente = 'SANDBOX' | 'PRODUCAO';

export class IntegracaoInvalida extends Error {}

// Fluxo A2: após quantas horas sem notificações a diretoria é alertada. O máximo é 48
// [Confiabilidade.NF002]: o Asaas guarda os eventos não entregues por 14 dias.
export const PRAZOS_DO_ALERTA = [12, 24, 48] as const;
export const PRAZO_PADRAO = 24;

export function lerAmbiente(valor: unknown): Ambiente {
  if (valor !== 'SANDBOX' && valor !== 'PRODUCAO') {
    throw new IntegracaoInvalida('Escolha o ambiente: testes (sandbox) ou produção.');
  }
  return valor;
}

export function lerChave(valor: unknown): string {
  const chave = typeof valor === 'string' ? valor.trim() : '';
  if (chave.length < 20 || /\s/.test(chave)) {
    throw new IntegracaoInvalida('Cole a chave de acesso completa, como aparece no painel do Asaas (Integrações > Chave da API).');
  }
  return chave;
}

export function lerPrazoDoAlerta(valor: unknown): number {
  const prazo = PRAZOS_DO_ALERTA.find((permitido) => permitido === valor);
  if (prazo === undefined) throw new IntegracaoInvalida('O prazo do alerta deve ser de 12, 24 ou 48 horas.');
  return prazo;
}

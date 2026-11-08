import { Logger } from '@nestjs/common';
import { chaveMestraDoAmbiente } from './seguranca/cifra.js';

// Confere, na subida da API e do worker, as variáveis sem as quais o sistema não funciona direito.
// Em produção, configuração inválida impede a subida: melhor a Railway mostrar a implantação como falha
// do que o sistema no ar recusando webhooks ou sem conseguir ler a chave do Asaas. Fora de produção só
// avisa no log, para não travar quem ainda não preencheu o .env inteiro.
// As mensagens dizem o que falta, nunca o valor da variável (são segredos).

export type Processo = 'api' | 'worker';

// Prefixo dos valores de exemplo do .env.example ("coloque-um-token-aleatorio").
const PREFIXO_DE_EXEMPLO = 'coloque-';

// Função pura: devolve a lista de problemas (vazia se está tudo certo).
export function problemasDaConfiguracao(env: NodeJS.ProcessEnv, processo: Processo): string[] {
  const problemas: string[] = [];

  if ((env.DATABASE_URL ?? '').trim() === '') {
    problemas.push('DATABASE_URL não está preenchida.');
  }

  // Mesma regra de quem usa a chave (cifra.ts): 32 bytes em base64.
  try {
    chaveMestraDoAmbiente(env);
  } catch {
    problemas.push('CHAVE_DE_CIFRAGEM precisa ter 32 bytes em base64 (veja o passo 2.7 do playbook de implantação).');
  }

  // Só a API recebe o webhook do Asaas.
  if (processo === 'api') {
    const token = (env.ASAAS_WEBHOOK_TOKEN ?? '').trim();
    if (token === '') {
      problemas.push('ASAAS_WEBHOOK_TOKEN não está preenchido.');
    } else if (token.startsWith(PREFIXO_DE_EXEMPLO)) {
      problemas.push('ASAAS_WEBHOOK_TOKEN ainda tem o valor de exemplo do .env.example.');
    }
  }

  return problemas;
}

// Chamada no main.ts e no main-worker.ts, antes de montar a aplicação (não no gerar-openapi.ts).
export function validarConfiguracaoNaSubida(processo: Processo, env: NodeJS.ProcessEnv = process.env): void {
  const problemas = problemasDaConfiguracao(env, processo);
  if (problemas.length === 0) return;

  if (env.NODE_ENV === 'production') {
    throw new Error(`Configuração inválida (${processo}); corrija as variáveis de ambiente:\n- ${problemas.join('\n- ')}`);
  }
  const logger = new Logger('Configuracao');
  for (const problema of problemas) {
    logger.warn(`${problema} Em produção, isto impediria a subida.`);
  }
}

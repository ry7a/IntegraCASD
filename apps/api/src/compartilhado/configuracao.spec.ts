import { describe, expect, it } from 'vitest';
import { problemasDaConfiguracao, validarConfiguracaoNaSubida } from './configuracao.js';

// Valores fictícios, só para o teste.
const CHAVE_VALIDA = Buffer.alloc(32, 7).toString('base64');
const TOKEN_VALIDO = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

function ambiente(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://ficticio:ficticio@localhost:5434/ficticio',
    CHAVE_DE_CIFRAGEM: CHAVE_VALIDA,
    ASAAS_WEBHOOK_TOKEN: TOKEN_VALIDO,
    ...extra,
  };
}

describe('problemasDaConfiguracao', () => {
  it('configuração completa não tem problema, na API e no worker', () => {
    expect(problemasDaConfiguracao(ambiente(), 'api')).toEqual([]);
    expect(problemasDaConfiguracao(ambiente(), 'worker')).toEqual([]);
  });

  it('DATABASE_URL vazia ou ausente', () => {
    expect(problemasDaConfiguracao(ambiente({ DATABASE_URL: '  ' }), 'worker')).toEqual(['DATABASE_URL não está preenchida.']);
    expect(problemasDaConfiguracao(ambiente({ DATABASE_URL: undefined }), 'api')).toHaveLength(1);
  });

  it('CHAVE_DE_CIFRAGEM que não decodifica para 32 bytes', () => {
    for (const chave of [undefined, '', 'gere-32-bytes-em-base64', Buffer.alloc(16).toString('base64')]) {
      const problemas = problemasDaConfiguracao(ambiente({ CHAVE_DE_CIFRAGEM: chave }), 'worker');
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain('CHAVE_DE_CIFRAGEM');
    }
  });

  it('a API exige ASAAS_WEBHOOK_TOKEN preenchido e diferente do exemplo', () => {
    expect(problemasDaConfiguracao(ambiente({ ASAAS_WEBHOOK_TOKEN: '' }), 'api')).toEqual([
      'ASAAS_WEBHOOK_TOKEN não está preenchido.',
    ]);
    expect(problemasDaConfiguracao(ambiente({ ASAAS_WEBHOOK_TOKEN: 'coloque-um-token-aleatorio' }), 'api')).toEqual([
      'ASAAS_WEBHOOK_TOKEN ainda tem o valor de exemplo do .env.example.',
    ]);
  });

  // A guarda do webhook compara o valor cru: espaço ou quebra de linha nas pontas faria todo webhook dar 401.
  it('a API acusa espaço ou quebra de linha nas pontas do ASAAS_WEBHOOK_TOKEN, sem mostrar o valor', () => {
    for (const token of [`${TOKEN_VALIDO}
`, `${TOKEN_VALIDO}
`, ` ${TOKEN_VALIDO}`, `${TOKEN_VALIDO}	`]) {
      const problemas = problemasDaConfiguracao(ambiente({ ASAAS_WEBHOOK_TOKEN: token }), 'api');
      expect(problemas).toEqual([
        'ASAAS_WEBHOOK_TOKEN tem espaço ou quebra de linha no começo ou no fim; apague-os (o Asaas manda o token sem eles).',
      ]);
      expect(problemas.join(' ')).not.toContain(TOKEN_VALIDO);
    }
  });

  it('o worker não precisa do token do webhook', () => {
    expect(problemasDaConfiguracao(ambiente({ ASAAS_WEBHOOK_TOKEN: undefined }), 'worker')).toEqual([]);
  });

  it('nenhuma mensagem repete o valor das variáveis', () => {
    const env = ambiente({ DATABASE_URL: '', CHAVE_DE_CIFRAGEM: 'valor-secreto-curto', ASAAS_WEBHOOK_TOKEN: 'coloque-segredo-xyz' });
    const texto = problemasDaConfiguracao(env, 'api').join(' ');
    expect(texto).not.toContain('valor-secreto-curto');
    expect(texto).not.toContain('segredo-xyz');
  });
});

describe('validarConfiguracaoNaSubida', () => {
  it('em produção, configuração inválida impede a subida', () => {
    const env = ambiente({ NODE_ENV: 'production', ASAAS_WEBHOOK_TOKEN: '' });
    expect(() => validarConfiguracaoNaSubida('api', env)).toThrow(/Configuração inválida \(api\)[\s\S]*ASAAS_WEBHOOK_TOKEN/);
  });

  it('em produção, configuração válida sobe', () => {
    expect(() => validarConfiguracaoNaSubida('api', ambiente({ NODE_ENV: 'production' }))).not.toThrow();
  });

  it('fora de produção, só avisa', () => {
    expect(() => validarConfiguracaoNaSubida('api', ambiente({ CHAVE_DE_CIFRAGEM: '' }))).not.toThrow();
  });
});

// B13: a trilha de auditoria só é gravada pelo ponto central e nunca é alterada [Segurança.NF006].
// O ponto central é src/compartilhado/auditoria/trilha.ts (registrarNaTrilha), chamado dentro da
// transação da alteração (ADR-0004). Ler a trilha (findMany, count) continua permitido.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, RAIZ_API, caminhoRelativo, lerCodigo, listarArquivos } from './arquivos.js';

const PONTO_CENTRAL = 'apps/api/src/compartilhado/auditoria/trilha.ts';
const ESCRITA_NA_TRILHA = /registroAuditoria\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
const MUDANCA_NA_TRILHA = /registroAuditoria\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/;

describe('B13: trilha de auditoria central e só de inclusão', () => {
  it('só o ponto central grava na trilha', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => ESCRITA_NA_TRILHA.test(lerCodigo(arquivo)))
      .map(caminhoRelativo)
      .filter((alvo) => alvo !== PONTO_CENTRAL);
    expect(violacoes).toEqual([]);
  });

  it('nem o ponto central altera ou apaga registros da trilha', () => {
    expect(MUDANCA_NA_TRILHA.test(lerCodigo(path.join(RAIZ_API, 'src', 'compartilhado', 'auditoria', 'trilha.ts')))).toBe(
      false,
    );
  });

  it('existe uma migração com o gatilho que recusa UPDATE, DELETE e TRUNCATE na trilha', () => {
    const migracoes = listarArquivos(path.join(RAIZ_API, 'prisma', 'migrations'), '.sql').map((arquivo) =>
      readFileSync(arquivo, 'utf8'),
    );
    const temGatilho = migracoes.some(
      (sql) =>
        /BEFORE UPDATE OR DELETE ON "registros_auditoria"/.test(sql) &&
        /BEFORE TRUNCATE ON "registros_auditoria"/.test(sql),
    );
    expect(temGatilho).toBe(true);
  });
});

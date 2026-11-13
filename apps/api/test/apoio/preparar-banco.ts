// "globalSetup" do Vitest para os testes de integração e de sistema: roda UMA vez, antes de todos os
// arquivos. Apaga o banco de teste, cria de novo e aplica as migrações, para toda execução começar do zero
// (critério de saída do nível de integração no Plano de Testes: "o banco de teste é recriado a cada execução").
//
// Apagar e recriar o banco inteiro, em vez de limpar tabela por tabela, tem um motivo: a trilha de auditoria
// recusa DELETE e TRUNCATE (ADR-0004), então ela não pode ser limpa de outro jeito.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { conferirQueEhBancoDeTeste, urlDoBancoDeIntegracao, urlDoBancoDeManutencao } from './banco-de-integracao.js';

const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default async function prepararBanco(): Promise<void> {
  const url = urlDoBancoDeIntegracao();
  // Antes de qualquer DROP: só aceita banco local com "integracao" no nome.
  const nome = conferirQueEhBancoDeTeste(url);

  const manutencao = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlDoBancoDeManutencao(url) }) });
  try {
    // O nome já foi conferido (só [a-z0-9_]); por isso pode entrar direto no SQL.
    await manutencao.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
    await manutencao.$executeRawUnsafe(`CREATE DATABASE "${nome}"`);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`Não consegui recriar o banco "${nome}". O PostgreSQL está no ar (docker compose up -d)? ${motivo}`);
  } finally {
    await manutencao.$disconnect();
  }

  // A variável do ambiente vale mais que o .env que o prisma.config.ts carrega: as migrações vão para o banco de teste.
  try {
    execSync('pnpm exec prisma migrate deploy', { cwd: RAIZ_API, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  } catch (erro) {
    const saida = (erro as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`As migrações falharam no banco "${nome}".\n${saida}`);
  }
  process.stdout.write(`Banco de integração "${nome}" recriado e com as migrações aplicadas.\n`);
}

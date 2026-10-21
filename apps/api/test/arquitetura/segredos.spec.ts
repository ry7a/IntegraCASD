// B11: segredos nunca entram no repositório.
// A regra "no-console" (que impede vazar segredo em log) está em apps/api/.oxlintrc.json.
// Aqui: varre todos os arquivos versionados (git ls-files) do repositório inteiro.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_REPO } from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// Prefixo das chaves do Asaas. Montado em duas partes de propósito: se o texto
// completo estivesse escrito aqui, este próprio arquivo seria apontado pelo teste.
const PREFIXO_CHAVE_ASAAS = '$aact' + '_';

function arquivosVersionados(): string[] {
  const saida = execFileSync('git', ['ls-files'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  return saida.split('\n').filter((linha) => linha !== '');
}

// Só .env.example é permitido; qualquer outro .env, .env.local etc. não pode ser versionado.
function ehArquivoEnvProibido(arquivo: string): boolean {
  const nome = path.posix.basename(arquivo);
  return (nome === '.env' || nome.startsWith('.env.')) && nome !== '.env.example';
}

describe('B11: segredos fora do repositório', () => {
  it('nenhum arquivo .env está versionado (só o .env.example)', () => {
    const violacoes = arquivosVersionados().filter(ehArquivoEnvProibido);
    const { pendentes, obsoletas } = aplicarExcecoes('B11', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });

  it('nenhum arquivo versionado contém o prefixo de chave do Asaas', () => {
    const violacoes: string[] = [];
    for (const arquivo of arquivosVersionados()) {
      let conteudo: Buffer;
      try {
        conteudo = readFileSync(path.join(RAIZ_REPO, arquivo));
      } catch {
        continue; // arquivo apagado na árvore de trabalho e ainda não commitado
      }
      if (conteudo.includes(PREFIXO_CHAVE_ASAAS)) violacoes.push(arquivo);
    }
    expect(violacoes).toEqual([]);
  });
});

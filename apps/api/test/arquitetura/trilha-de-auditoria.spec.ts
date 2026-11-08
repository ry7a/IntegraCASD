// B13: a trilha de auditoria só é gravada pelo ponto central e nunca é alterada [Segurança.NF006].
// O ponto central é src/compartilhado/auditoria/trilha.ts (registrarNaTrilha), chamado dentro da
// transação da alteração (ADR-0004). Ler a trilha (findMany, count) continua permitido.
//
// B14: o detalhe da trilha não leva dados pessoais (LGPD, Padrões.NF001). Como a trilha não pode ser
// alterada nem apagada, um nome gravado ali impediria anonimizar o aluno inativo depois.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, RAIZ_API, caminhoRelativo, lerCodigo, listarArquivos } from './arquivos.js';

const PONTO_CENTRAL = 'apps/api/src/compartilhado/auditoria/trilha.ts';
const ESCRITA_NA_TRILHA = /registroAuditoria\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
const MUDANCA_NA_TRILHA = /registroAuditoria\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/;

// B14: campos de pessoa (aluno, funcionário, usuário, contraparte de contrato) que não podem aparecer
// no código de uma chamada a registrarNaTrilha, como em `${aluno.nome}` ou `${dados.email}`.
const CAMPOS_PESSOAIS = /\b(nome|email|cpf|telefone|celular|apelido|matricula|contraparte)\b/g;
// Nome de categoria e de projeto não é dado pessoal ("Categoria "Zeladoria" incluída").
const ENTIDADES_COM_NOME_LIVRE = ['CATEGORIA', 'PROJETO'];

// Texto de cada chamada `registrarNaTrilha(...)`, do parêntese de abertura ao de fechamento.
// Conta os parênteses em vez de procurar o "});" para não depender da formatação.
function chamadasDaTrilha(codigo: string): string[] {
  const chamadas: string[] = [];
  for (const achado of codigo.matchAll(/registrarNaTrilha\(/g)) {
    const inicio = achado.index + achado[0].length;
    let profundidade = 1;
    let fim = inicio;
    while (fim < codigo.length && profundidade > 0) {
      if (codigo[fim] === '(') profundidade++;
      if (codigo[fim] === ')') profundidade--;
      fim++;
    }
    chamadas.push(codigo.slice(inicio, fim - 1));
  }
  return chamadas;
}

// Tira o texto fixo das strings e deixa só o código: de um template, sobram as expressões ${...};
// strings entre aspas simples somem. Assim 'Aluno alterado: email' não conta, mas ${dados.email} sim.
function soOCodigo(chamada: string): string {
  return chamada
    .replace(/`(?:[^`\\]|\\.)*`/g, (template) => [...template.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(' '))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

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

describe('B14: detalhe da trilha sem dados pessoais', () => {
  const chamadas = listarArquivos(PASTA_SRC, '.ts')
    .filter((arquivo) => !arquivo.endsWith('.spec.ts') && caminhoRelativo(arquivo) !== PONTO_CENTRAL)
    .flatMap((arquivo) => chamadasDaTrilha(lerCodigo(arquivo)).map((texto) => ({ arquivo: caminhoRelativo(arquivo), texto })));

  it('encontra as chamadas a registrarNaTrilha (a varredura não está cega)', () => {
    expect(chamadas.length).toBeGreaterThan(20);
  });

  it('nenhuma chamada monta o detalhe com nome, e-mail, CPF, telefone ou outro campo de pessoa', () => {
    const violacoes: string[] = [];
    for (const { arquivo, texto } of chamadas) {
      const entidade = texto.match(/entidade:\s*'([A-Z_]+)'/)?.[1] ?? '';
      const campos = [...soOCodigo(texto).matchAll(CAMPOS_PESSOAIS)]
        .map((m) => m[1])
        .filter((campo) => !(campo === 'nome' && ENTIDADES_COM_NOME_LIVRE.includes(entidade)));
      if (campos.length > 0) violacoes.push(`${arquivo} (${entidade}): ${campos.join(', ')}`);
    }
    expect(violacoes).toEqual([]);
  });

  it('a regra pega o jeito errado (confere a própria varredura)', () => {
    const errado = "registrarNaTrilha(tx, { entidade: 'ALUNO', detalhe: `Aluno \"${criado.nome}\" incluído.` })";
    const certo = "registrarNaTrilha(tx, { entidade: 'ALUNO', detalhe: `Aluno alterado: ${campos}.` })";
    const achar = (codigo: string) => [...soOCodigo(chamadasDaTrilha(codigo)[0]).matchAll(CAMPOS_PESSOAIS)].map((m) => m[1]);
    expect(achar(errado)).toEqual(['nome']);
    expect(achar(certo)).toEqual([]);
  });
});

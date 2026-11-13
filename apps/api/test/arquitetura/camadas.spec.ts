// B2: camadas dentro de cada módulo.   B3: Prisma só onde pode.
// Sentido permitido das dependências: api -> aplicacao -> dominio, e infra -> dominio.
//   dominio/    não conhece framework, banco nem as outras camadas
//   api/        não chama infra/ direto: o controller chama um caso de uso
//   aplicacao/  não conhece api/ (controllers e DTOs)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PASTA_MODULOS,
  caminhoRelativo,
  extrairImports,
  lerCodigo,
  listarArquivos,
  listarModulos,
  resolverImportRelativo,
} from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// Para cada camada, as camadas que ela NÃO pode importar.
const PROIBIDO_POR_CAMADA: Record<string, string[]> = {
  dominio: ['infra', 'api', 'aplicacao'],
  api: ['infra'],
  aplicacao: ['api'],
};

// O domínio também não pode importar framework nem banco.
function ehPacoteProibidoNoDominio(texto: string): boolean {
  return texto.startsWith('@nestjs/') || texto.startsWith('@prisma/') || texto.includes('generated/prisma');
}

describe('B2: camadas dentro do módulo [Padrões.NF003] CT-NF-07', () => {
  for (const modulo of listarModulos()) {
    const pastaDoModulo = path.join(PASTA_MODULOS, modulo);

    for (const [camada, proibidas] of Object.entries(PROIBIDO_POR_CAMADA)) {
      it(`${modulo}/${camada} não importa ${proibidas.join(', ')}`, () => {
        const violacoes: string[] = [];
        for (const arquivo of listarArquivos(path.join(pastaDoModulo, camada), '.ts')) {
          for (const texto of extrairImports(readFileSync(arquivo, 'utf8'))) {
            const destino = resolverImportRelativo(arquivo, texto);
            const camadaDoDestino =
              destino === null ? null : path.relative(pastaDoModulo, destino).split(path.sep)[0];
            const importaCamadaProibida = camadaDoDestino !== null && proibidas.includes(camadaDoDestino);
            const importaPacoteProibido = camada === 'dominio' && ehPacoteProibidoNoDominio(texto);
            if (importaCamadaProibida || importaPacoteProibido) {
              violacoes.push(`${caminhoRelativo(arquivo)} importa '${texto}'`);
            }
          }
        }
        const { pendentes, obsoletas } = aplicarExcecoes('B2', violacoes);
        expect(pendentes).toEqual([]);
        expect(obsoletas).toEqual([]);
      });
    }
  }
});

describe('B3: Prisma só na camada infra', () => {
  // O controller e o domínio nunca tocam no banco: quem acessa é o repositório (infra/).
  const PROIBIDO = /PrismaService|@prisma\/|generated\/prisma|\$transaction/;

  it('api/ e dominio/ de qualquer módulo não usam Prisma nem $transaction', () => {
    const violacoes: string[] = [];
    for (const modulo of listarModulos()) {
      for (const camada of ['api', 'dominio']) {
        for (const arquivo of listarArquivos(path.join(PASTA_MODULOS, modulo, camada), '.ts')) {
          if (PROIBIDO.test(lerCodigo(arquivo))) violacoes.push(caminhoRelativo(arquivo));
        }
      }
    }
    const { pendentes, obsoletas } = aplicarExcecoes('B3', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas).toEqual([]);
  });
});

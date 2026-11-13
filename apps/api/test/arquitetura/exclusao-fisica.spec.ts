// B6: nada é excluído fisicamente. Cadastros são inativados; movimentações, estornadas.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASTA_SRC, RAIZ_API, caminhoRelativo, lerCodigo, listarArquivos } from './arquivos.js';
import { aplicarExcecoes } from './excecoes.js';

// As duas verificações da B6 dividem a lista de exceções. Cada uma só cobra como "obsoleta"
// a exceção do próprio tipo de arquivo (.ts para o código, .sql para as migrações).
const doTipo = (extensao: string) => (alvo: string) => alvo.endsWith(extensao);

describe('B6: nada é excluído fisicamente CT-NF-07', () => {
  it('o código não chama .delete( nem .deleteMany(', () => {
    const violacoes = listarArquivos(PASTA_SRC, '.ts')
      .filter((arquivo) => /\.delete(Many)?\s*\(/.test(lerCodigo(arquivo)))
      .map(caminhoRelativo);
    const { pendentes, obsoletas } = aplicarExcecoes('B6', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas.filter(doTipo('.ts'))).toEqual([]);
  });

  it('as migrações não têm DELETE FROM nem DROP TABLE', () => {
    // Comentários do SQL ("-- ...") não contam.
    const semComentarios = (sql: string) => sql.replace(/--.*$/gm, '');
    const violacoes = listarArquivos(path.join(RAIZ_API, 'prisma', 'migrations'), '.sql')
      .filter((arquivo) => /DELETE\s+FROM|DROP\s+TABLE/i.test(semComentarios(readFileSync(arquivo, 'utf8'))))
      .map(caminhoRelativo);
    const { pendentes, obsoletas } = aplicarExcecoes('B6', violacoes);
    expect(pendentes).toEqual([]);
    expect(obsoletas.filter(doTipo('.sql'))).toEqual([]);
  });
});

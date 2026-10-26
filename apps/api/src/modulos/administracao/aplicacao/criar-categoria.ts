import { Injectable } from '@nestjs/common';
import { NomeDeCategoriaDuplicado, lerTipo, normalizarNome } from '../dominio/categoria.js';
import { CategoriasRepositorio } from '../infra/categorias.repositorio.js';
import type { CategoriaComUso } from '../infra/categorias.repositorio.js';
import { traduzirErrosDaCategoria } from './erros-da-categoria.js';

// Os campos chegam como `unknown` porque vêm do corpo da requisição: só confiamos neles
// depois que o domínio valida.
export type EntradaCriarCategoria = { nome?: unknown; tipo?: unknown };

// Caso de uso [Administração.RF002]: inclui uma categoria, sempre ativa.
@Injectable()
export class CriarCategoria {
  constructor(private readonly categorias: CategoriasRepositorio) {}

  executar(entrada: EntradaCriarCategoria, autorId: string): Promise<CategoriaComUso> {
    return traduzirErrosDaCategoria(async () => {
      const nome = normalizarNome(entrada.nome);
      const tipo = lerTipo(entrada.tipo);

      // Fluxo E1: nome igual ao de outra categoria ativa é recusado.
      if (await this.categorias.existeAtivaComNome(nome)) {
        throw new NomeDeCategoriaDuplicado(nome);
      }
      return this.categorias.criar({ nome, tipo }, autorId);
    });
  }
}

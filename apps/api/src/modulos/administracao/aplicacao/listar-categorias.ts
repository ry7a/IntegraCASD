import { Injectable } from '@nestjs/common';
import { CategoriasRepositorio } from '../infra/categorias.repositorio.js';
import type { CategoriaComUso } from '../infra/categorias.repositorio.js';

// O tipo da saída faz parte do caso de uso: o controller importa daqui, sem conhecer a infra (B2).
export type { CategoriaComUso };

// Caso de uso [Administração.RF002]: lista as categorias, ativas primeiro, com o número de
// movimentações que usa cada uma.
@Injectable()
export class ListarCategorias {
  constructor(private readonly categorias: CategoriasRepositorio) {}

  executar(): Promise<CategoriaComUso[]> {
    return this.categorias.listar();
  }
}

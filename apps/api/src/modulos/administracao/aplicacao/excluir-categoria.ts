import { Injectable, NotFoundException } from '@nestjs/common';
import { conferirExclusao } from '../dominio/categoria.js';
import { CategoriasRepositorio } from '../infra/categorias.repositorio.js';
import { traduzirErrosDaCategoria } from './erros-da-categoria.js';

// Caso de uso: exclui uma categoria que nunca foi usada (ex.: criada por engano). Exceção
// combinada com a equipe à regra "nada é excluído"; categoria em uso só pode ser inativada.
@Injectable()
export class ExcluirCategoria {
  constructor(private readonly categorias: CategoriasRepositorio) {}

  executar(id: string, autorId: string): Promise<void> {
    return traduzirErrosDaCategoria(async () => {
      const categoria = await this.categorias.buscarPorId(id);
      if (categoria === null) {
        throw new NotFoundException('Categoria não encontrada. Atualize a lista e tente de novo.');
      }
      conferirExclusao(categoria.quantidadeMovimentacoes);
      await this.categorias.excluir(categoria, autorId);
    });
  }
}

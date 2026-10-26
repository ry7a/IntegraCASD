import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NomeDeCategoriaDuplicado,
  conferirTrocaDeTipo,
  lerSituacao,
  lerTipo,
  normalizarNome,
} from '../dominio/categoria.js';
import type { TipoDeCategoria } from '../dominio/categoria.js';
import { CategoriasRepositorio } from '../infra/categorias.repositorio.js';
import type { CategoriaComUso, OperacaoNaCategoria } from '../infra/categorias.repositorio.js';
import { traduzirErrosDaCategoria } from './erros-da-categoria.js';

// Todos os campos são opcionais: só muda o que vier no corpo.
export type EntradaAlterarCategoria = { nome?: unknown; tipo?: unknown; ativo?: unknown };

// Caso de uso [Administração.RF002]: altera, inativa ou reativa uma categoria.
// Inativar não exclui: as movimentações antigas mantêm a categoria (fluxo A1).
@Injectable()
export class AlterarCategoria {
  constructor(private readonly categorias: CategoriasRepositorio) {}

  executar(id: string, entrada: EntradaAlterarCategoria, autorId: string): Promise<CategoriaComUso> {
    return traduzirErrosDaCategoria(async () => {
      const atual = await this.categorias.buscarPorId(id);
      if (atual === null) {
        throw new NotFoundException('Categoria não encontrada. Atualize a lista e tente de novo.');
      }

      const dados: { nome?: string; tipo?: TipoDeCategoria; ativo?: boolean } = {};
      if (entrada.nome !== undefined) dados.nome = normalizarNome(entrada.nome);
      if (entrada.tipo !== undefined) dados.tipo = lerTipo(entrada.tipo);
      if (entrada.ativo !== undefined) dados.ativo = lerSituacao(entrada.ativo);
      if (Object.keys(dados).length === 0) {
        throw new BadRequestException('Informe o que mudar: nome, tipo ou situação.');
      }

      if (dados.tipo !== undefined && dados.tipo !== atual.tipo) {
        conferirTrocaDeTipo(dados.tipo, await this.categorias.contarUsoPorTipo(id));
      }

      // Nome único entre as ativas: confere quando a categoria vai ficar ativa e o nome muda,
      // ou quando uma categoria inativa é reativada (outra pode ter pego o nome nesse meio-tempo).
      const ficaAtiva = dados.ativo ?? atual.ativo;
      const nomeFinal = dados.nome ?? atual.nome;
      const nomeMuda = dados.nome !== undefined && dados.nome !== atual.nome;
      const reativa = dados.ativo === true && !atual.ativo;
      if (ficaAtiva && (nomeMuda || reativa) && (await this.categorias.existeAtivaComNome(nomeFinal, id))) {
        throw new NomeDeCategoriaDuplicado(nomeFinal);
      }

      return this.categorias.alterar(id, dados, operacaoDa(atual.ativo, dados.ativo), autorId);
    });
  }
}

function operacaoDa(estavaAtiva: boolean, novaSituacao: boolean | undefined): OperacaoNaCategoria {
  if (estavaAtiva && novaSituacao === false) return 'INATIVACAO';
  if (!estavaAtiva && novaSituacao === true) return 'REATIVACAO';
  return 'ALTERACAO';
}

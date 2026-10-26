import { Module } from '@nestjs/common';
import { IndicadoresController } from './api/indicadores.controller.js';
import { ConsultarGastosPorCategoria } from './aplicacao/consultar-gastos-por-categoria.js';
import { ConsultarInadimplencia } from './aplicacao/consultar-inadimplencia.js';
import { ConsultarEvolucao, ConsultarResumoDoPainel } from './aplicacao/consultar-painel.js';
import { IndicadoresRepositorio } from './infra/indicadores.repositorio.js';

// Módulo Indicadores: consultas que apoiam a decisão [Indicadores.RF001 a RF003]. Só leitura.
@Module({
  controllers: [IndicadoresController],
  providers: [
    IndicadoresRepositorio,
    ConsultarResumoDoPainel,
    ConsultarEvolucao,
    ConsultarInadimplencia,
    ConsultarGastosPorCategoria,
  ],
})
export class IndicadoresModule {}

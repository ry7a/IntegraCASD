import { Module } from '@nestjs/common';
import { IndicadoresController } from './api/indicadores.controller.js';
import { ConsultarInadimplencia } from './aplicacao/consultar-inadimplencia.js';
import { IndicadoresRepositorio } from './infra/indicadores.repositorio.js';

// Módulo Indicadores: consultas que apoiam a decisão [Indicadores.RF001 a RF003]. Só leitura.
@Module({
  controllers: [IndicadoresController],
  providers: [IndicadoresRepositorio, ConsultarInadimplencia],
})
export class IndicadoresModule {}

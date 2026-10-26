// Ponto de entrada público do módulo Indicadores (ADR-0003, regra B1).
// Outros módulos e o app.module só importam daqui, nunca de arquivos internos.
export { IndicadoresModule } from './indicadores.module.js';

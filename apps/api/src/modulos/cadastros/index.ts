// Ponto de entrada público do módulo Cadastros (ADR-0003, regra B1).
// Outros módulos e o app.module só importam daqui, nunca de arquivos internos.
// Quando outro módulo precisar de algo do Cadastros (ex.: um caso de uso), exporte aqui.
export { CadastrosModule } from './cadastros.module.js';

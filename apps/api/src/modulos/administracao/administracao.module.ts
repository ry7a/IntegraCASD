import { Module } from '@nestjs/common';
import { AsaasModule } from '../../compartilhado/asaas/asaas.module.js';
import { CadastrosModule } from '../cadastros/index.js';
import { CategoriasController } from './api/categorias.controller.js';
import { AmbienteDaIntegracaoController, IntegracaoAsaasController } from './api/integracao-asaas.controller.js';
import { ParametrosController } from './api/parametros.controller.js';
import { UsuariosController } from './api/usuarios.controller.js';
import { AlterarCategoria } from './aplicacao/alterar-categoria.js';
import { AlterarParametrosDeCobranca } from './aplicacao/alterar-parametros-de-cobranca.js';
import { BuscarParametrosVigentes } from './aplicacao/buscar-parametros-vigentes.js';
import { ConferirParametrosDeCobranca } from './aplicacao/conferir-parametros-de-cobranca.js';
import { ConsultarParametrosDeCobranca } from './aplicacao/consultar-parametros-de-cobranca.js';
import { CriarCategoria } from './aplicacao/criar-categoria.js';
import { ExcluirCategoria } from './aplicacao/excluir-categoria.js';
import { AlterarPrazoDoAlerta, ConsultarIntegracaoAsaas, SubstituirChaveAsaas } from './aplicacao/integracao-asaas.js';
import { ListarCategorias } from './aplicacao/listar-categorias.js';
import { UsuariosService } from './aplicacao/usuarios.service.js';
import { CategoriasRepositorio } from './infra/categorias.repositorio.js';
import { ParametrosRepositorio } from './infra/parametros.repositorio.js';

// O que outros módulos usam entra em `exports` (e no index.ts, que é por onde eles importam).
@Module({
  imports: [CadastrosModule, AsaasModule],
  controllers: [
    UsuariosController,
    CategoriasController,
    ParametrosController,
    IntegracaoAsaasController,
    AmbienteDaIntegracaoController,
  ],
  providers: [
    UsuariosService,
    ListarCategorias,
    CriarCategoria,
    AlterarCategoria,
    ExcluirCategoria,
    CategoriasRepositorio,
    ConsultarParametrosDeCobranca,
    ConferirParametrosDeCobranca,
    AlterarParametrosDeCobranca,
    BuscarParametrosVigentes,
    ParametrosRepositorio,
    ConsultarIntegracaoAsaas,
    SubstituirChaveAsaas,
    AlterarPrazoDoAlerta,
  ],
  exports: [BuscarParametrosVigentes],
})
export class AdministracaoModule {}

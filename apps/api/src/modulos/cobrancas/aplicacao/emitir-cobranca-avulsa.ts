import { Injectable, Logger } from '@nestjs/common';
import { ClienteAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { BuscarAluno } from '../../cadastros/index.js';
import { CobrancaInvalida, conferirAlunoCobravel, lerNovaCobrancaAvulsa, type NovaCobrancaAvulsa } from '../dominio/cobranca.js';
import { CobrancasRepositorio, type CobrancaRegistrada } from '../infra/cobrancas.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';
import { GarantirClienteAsaas } from './garantir-cliente-asaas.js';

// Caso de uso [Cobranças.RF002]: emite uma cobrança avulsa para um aluno.
// Ordem que garante [Confiabilidade.NF005]: primeiro o Asaas cria a cobrança; só depois ela é gravada
// aqui. Se o Asaas falhar (fluxo E1), nada é gravado e o erro volta na hora; não há fila.
@Injectable()
export class EmitirCobrancaAvulsa {
  private readonly logger = new Logger(EmitirCobrancaAvulsa.name);

  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly asaas: ClienteAsaas,
    private readonly buscarAluno: BuscarAluno,
    private readonly parametros: BuscarParametrosVigentes,
    private readonly garantirClienteAsaas: GarantirClienteAsaas,
  ) {}

  executar(
    entrada: Partial<Record<keyof NovaCobrancaAvulsa, unknown>>,
    autorId: string,
    hoje = hojeEmSaoPaulo(),
  ): Promise<CobrancaRegistrada> {
    return traduzirErrosDaCobranca(async () => {
      const dados = lerNovaCobrancaAvulsa(entrada, hoje);
      const parametros = await this.parametros.executar();
      if (parametros === null) {
        throw new CobrancaInvalida(
          'Os parâmetros de cobrança (multa e juros) ainda não foram cadastrados. Peça à diretoria para cadastrá-los em Administração.',
        );
      }
      const aluno = await this.buscarAluno.executar(dados.alunoId);
      conferirAlunoCobravel(aluno);
      if (dados.renegociacaoDeId !== null) {
        // Renegociação [Cobranças.RF004] fluxo A1: só de cobrança cancelada, do mesmo aluno, uma vez.
        const original = await this.cobrancas.buscarPorId(dados.renegociacaoDeId);
        if (original === null || original.alunoId !== aluno.id || original.situacao !== 'CANCELADA') {
          throw new CobrancaInvalida('Só uma cobrança cancelada do mesmo aluno pode ser renegociada.');
        }
        if (original.renegociadaPorId !== null) {
          throw new CobrancaInvalida('Esta cobrança já foi renegociada. Abra a cobrança nova pelo detalhe da antiga.');
        }
      }

      const clienteIdAsaas = await this.garantirClienteAsaas.executar(aluno);
      const criada = await this.asaas.criarCobranca({
        clienteIdAsaas,
        valorEmCentavos: dados.valorCentavos,
        vencimento: dados.vencimento,
        descricao: dados.descricao,
        multaPercentual: parametros.multaPercentual,
        jurosMensalPercentual: parametros.jurosMensalPercentual,
      });

      try {
        return await this.cobrancas.registrar(
          {
            idAsaas: criada.idAsaas,
            alunoId: aluno.id,
            origem: 'AVULSA',
            referencia: null,
            descricao: dados.descricao,
            valorCentavos: dados.valorCentavos,
            vencimento: dados.vencimento,
            multaPercentual: parametros.multaPercentual,
            jurosMensalPercentual: parametros.jurosMensalPercentual,
            urlBoleto: criada.urlBoleto,
            urlFatura: criada.urlFatura,
            renegociacaoDeId: dados.renegociacaoDeId,
          },
          autorId,
        );
      } catch (erro) {
        // Raro: o Asaas criou e o banco falhou. A sincronização com o Asaas (Cobranças.RF007) traz a
        // cobrança de volta; o id fica no log para conferência.
        this.logger.error(`Cobrança ${criada.idAsaas} criada no Asaas, mas não gravada aqui.`);
        throw erro;
      }
    });
  }
}

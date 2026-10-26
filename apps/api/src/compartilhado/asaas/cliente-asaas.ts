// Contrato do Cliente Asaas: tudo o que o sistema precisa pedir ao Asaas.
// Só a implementação deste contrato fala com o Asaas; o resto do código depende dele.
//
// É uma classe abstrata (e não uma interface) porque o NestJS injeta dependências pelo
// nome da classe em tempo de execução, e interfaces do TypeScript somem depois da compilação.
// Uma classe abstrata serve como tipo e como "etiqueta" de injeção ao mesmo tempo.

export interface NovoClienteAsaas {
  nome: string;
  cpf: string; // só dígitos, sem pontuação
  email: string;
}

export interface NovaCobrancaAsaas {
  clienteIdAsaas: string;
  // Em centavos, como em todo o sistema. A conversão para reais (que o Asaas espera)
  // é responsabilidade da implementação real, nunca de quem chama.
  valorEmCentavos: number;
  vencimento: string; // AAAA-MM-DD
  descricao: string;
  // Percentuais inteiros (2 = 2%), dos parâmetros vigentes. O Asaas calcula multa e juros no pagamento.
  multaPercentual: number;
  jurosMensalPercentual: number;
  // Identificação nossa, guardada no Asaas (externalReference). Permite à sincronização achar uma
  // cobrança criada lá e não gravada aqui, em vez de criar outra (Cobranças.RF001, fluxo E2).
  referenciaExterna?: string;
}

export interface CobrancaAsaas {
  idAsaas: string;
  urlBoleto: string | null;
  // Página da fatura no Asaas, com boleto e Pix, que o aluno também recebe por e-mail.
  urlFatura: string | null;
}

// Por que o Asaas falhou. Rotinas em lote usam isto para decidir: dados recusados afetam só aquele
// aluno (segue para o próximo); os demais motivos afetam todos (interrompe e tenta mais tarde).
export type MotivoDoErroAsaas =
  | 'DADOS_RECUSADOS'
  | 'INDISPONIVEL'
  | 'CHAVE_RECUSADA'
  | 'LIMITE_DE_REQUISICOES'
  | 'NAO_CONFIGURADO';

// Erro lançado quando o Asaas falha. A mensagem já vem traduzida e orientada à ação
// ([Usabilidade.NF002]); a resposta crua do Asaas nunca deve chegar ao usuário.
export class ErroAsaas extends Error {
  constructor(
    mensagem: string,
    readonly motivo: MotivoDoErroAsaas = 'INDISPONIVEL',
  ) {
    super(mensagem);
    this.name = 'ErroAsaas';
  }
}

export abstract class ClienteAsaas {
  // Se a chave e o ambiente estão configurados. Não chama o Asaas.
  abstract estaConfigurado(): boolean;
  abstract criarCliente(dados: NovoClienteAsaas): Promise<{ idAsaas: string }>;
  // Atualiza nome, CPF e e-mail do cliente (quando o cadastro do aluno muda).
  abstract atualizarCliente(idAsaas: string, dados: NovoClienteAsaas): Promise<void>;
  abstract criarCobranca(dados: NovaCobrancaAsaas): Promise<CobrancaAsaas>;
  // Cancela (no Asaas, "exclui") uma cobrança não paga: o boleto deixa de valer.
  abstract cancelarCobranca(idAsaas: string): Promise<void>;
}

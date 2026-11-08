// Trava do início da geração recorrente, lida do .env a cada uso (como EMAIL_ALERTAS_PARA):
//   GERACAO_A_PARTIR_DE  (opcional) primeiro mês, "AAAA-MM", que o sistema pode cobrar, ex.: 2027-02
// Serve para a implantação: a planilha do CASD ainda cobra até a referência 2027-01, e a primeira
// mensalidade do sistema é a de fevereiro/2027. Quem decide o que fica liberado é o domínio da cobrança
// (`referenciaLiberada`); aqui só se lê a variável. O formato é conferido na subida (configuracao.ts).
// Devolve null quando a variável está vazia ou ausente: aí não há trava.
export function geracaoAPartirDeDoAmbiente(env: NodeJS.ProcessEnv = process.env): string | null {
  const valor = (env.GERACAO_A_PARTIR_DE ?? '').trim();
  return valor === '' ? null : valor;
}

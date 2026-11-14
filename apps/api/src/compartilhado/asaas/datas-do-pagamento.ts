// Datas de um pagamento como o Asaas manda (paymentDate, clientPaymentDate, confirmedDate, creditDate).
// Só TypeScript puro. Os dois caminhos que recebem um pagamento do Asaas leem as datas por aqui:
//   - o webhook, no domínio da conciliação (cobrancas/dominio/conciliacao.ts);
//   - a consulta do cliente HTTP (cliente-asaas.http.ts), que alimenta a sincronização.
// Assim, para o mesmo dado, webhook e sincronização chegam à mesma decisão (spec #57, história 22).

// O "AAAA-MM-DD" do começo do texto, ainda sem conferir o calendário: quem confere é a conciliação, que
// manda a data inexistente para conferência. Sem esse formato ("ontem", número), conta como não informada.
export function dataDoAsaas(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : null;
}

// Data do pagamento: a primeira, na ordem do Asaas, que tem forma de data. Cada campo é conferido antes de
// passar ao próximo: um paymentDate malformado não esconde um clientPaymentDate válido.
export function dataDoPagamentoNoAsaas(pagamento: { paymentDate?: unknown; clientPaymentDate?: unknown; confirmedDate?: unknown }): string | null {
  return dataDoAsaas(pagamento.paymentDate) ?? dataDoAsaas(pagamento.clientPaymentDate) ?? dataDoAsaas(pagamento.confirmedDate);
}

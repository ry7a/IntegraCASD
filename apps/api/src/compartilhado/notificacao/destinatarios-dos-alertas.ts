// Destinatários fixos dos alertas, lidos do .env a cada envio (como o notificador faz com EMAIL_API_KEY):
//   EMAIL_ALERTAS_PARA  (opcional) lista separada por vírgula, ex.: tesouraria@exemplo.com, eu@exemplo.com
// Preenchida, os alertas vão SÓ para ela, em vez de para os usuários ativos da diretoria. Serve enquanto o
// remetente é o de teste do Resend: ele só entrega para o e-mail dono da conta e recusa o pedido inteiro
// (HTTP 403) se houver qualquer outro destinatário; com a lista da diretoria, o alerta nunca chegaria.
// Devolve null quando a variável está vazia ou ausente: aí vale a lista da diretoria.
export function destinatariosFixosDosAlertas(env: NodeJS.ProcessEnv = process.env): string[] | null {
  const lista = (env.EMAIL_ALERTAS_PARA ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email !== '');
  return lista.length === 0 ? null : lista;
}

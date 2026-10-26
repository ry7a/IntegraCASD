// Regras do alerta de interrupção da conciliação [Confiabilidade.NF002]. Só TypeScript puro.
//
// Por que existe: o Asaas guarda por 14 dias os eventos que não conseguiu entregar. Se o webhook para
// de funcionar e ninguém percebe, passado esse prazo os eventos são descartados e os pagamentos deixam
// de ser conciliáveis. O alerta avisa a diretoria cedo (12, 24 ou 48 horas de silêncio, configurável).

const MS_POR_HORA = 3_600_000;

// Enquanto o silêncio continua, a diretoria recebe um lembrete a cada 24 horas (o prazo total é de 14 dias).
export const HORAS_ENTRE_LEMBRETES = 24;

// O silêncio conta a partir da última notificação recebida, ou da data em que a chave foi cadastrada, o que
// for mais recente: quem acabou de refazer a integração tem um prazo para o Asaas voltar a enviar eventos.
// Sem nenhuma das duas datas (desenvolvimento com a chave no .env e nenhum evento), não há o que medir.
export function inicioDoSilencio(ultimaNotificacaoEm: Date | null, chaveCadastradaEm: Date | null): Date | null {
  const datas = [ultimaNotificacaoEm, chaveCadastradaEm].filter((data): data is Date => data !== null);
  if (datas.length === 0) return null;
  return new Date(Math.max(...datas.map((data) => data.getTime())));
}

// Horas inteiras de silêncio (para o texto do alerta).
export function horasDeSilencio(inicio: Date, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_HORA));
}

// "Por período superior ao configurado": exatamente no prazo ainda não é alerta.
export function estaParado(inicio: Date, prazoHoras: number, agora: Date): boolean {
  return agora.getTime() - inicio.getTime() > prazoHoras * MS_POR_HORA;
}

// O alerta aberto é um por interrupção: abre quando o silêncio passa do prazo e fecha quando as
// notificações voltam. `ultimoEnvioEm` nulo = ainda não conseguimos avisar ninguém.
export type AlertaAberto = { ultimoEnvioEm: Date | null };

export type Decisao =
  | 'NADA'
  // Silêncio passou do prazo e não há alerta aberto: abre e avisa.
  | 'ABRIR_E_ENVIAR'
  // Há alerta aberto, mas o e-mail ainda não saiu (provedor fora do ar ou sem configuração): tenta de novo.
  | 'ENVIAR'
  // Há alerta aberto e o último aviso foi há mais de 24 horas: lembra.
  | 'LEMBRAR'
  // As notificações voltaram: encerra o alerta.
  | 'FECHAR';

export function decidir(entrada: { parado: boolean; alertaAberto: AlertaAberto | null; agora: Date }): Decisao {
  const { parado, alertaAberto, agora } = entrada;
  if (!parado) return alertaAberto === null ? 'NADA' : 'FECHAR';
  if (alertaAberto === null) return 'ABRIR_E_ENVIAR';
  if (alertaAberto.ultimoEnvioEm === null) return 'ENVIAR';
  const horasDesdeOAviso = (agora.getTime() - alertaAberto.ultimoEnvioEm.getTime()) / MS_POR_HORA;
  return horasDesdeOAviso >= HORAS_ENTRE_LEMBRETES ? 'LEMBRAR' : 'NADA';
}

// Data e hora no fuso de São Paulo, como a diretoria lê (o servidor pode estar em UTC): "25/10/2026 às 09:30".
// Data e hora são formatadas em separado para o texto não depender de como cada versão do Node junta as duas.
function emSaoPaulo(data: Date): string {
  const dia = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(data);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(data);
  return `${dia} às ${hora}`;
}

export type DadosDoAlerta = {
  horasSemNotificacao: number;
  prazoHoras: number;
  // Nulo = o Asaas nunca enviou nada desde que a integração foi configurada.
  ultimaNotificacaoEm: Date | null;
  lembrete: boolean;
};

// O texto diz o que houve, o risco e o que fazer ([Usabilidade.NF002]). Sem segredos nem dados de alunos.
export function montarAlerta(dados: DadosDoAlerta): { assunto: string; texto: string } {
  const quando =
    dados.ultimaNotificacaoEm === null
      ? 'O Asaas ainda não enviou nenhuma notificação desde que a integração foi configurada.'
      : `A última notificação do Asaas chegou em ${emSaoPaulo(dados.ultimaNotificacaoEm)}.`;
  const prefixo = dados.lembrete ? 'Lembrete: ' : '';
  return {
    assunto: `[IntegraCASD] ${prefixo}o Asaas está sem enviar notificações há ${dados.horasSemNotificacao} horas`,
    texto: [
      `O IntegraCASD não recebe notificações do Asaas há ${dados.horasSemNotificacao} horas, acima do prazo de ${dados.prazoHoras} horas configurado em Administração > Integração com o Asaas.`,
      quando,
      '',
      'Por que isso importa: sem as notificações, os pagamentos dos alunos não são conciliados automaticamente. O Asaas guarda os eventos não entregues por 14 dias; depois disso eles são descartados e os pagamentos correspondentes deixam de ser conciliáveis.',
      '',
      'O que fazer:',
      '1. No painel do Asaas, em Integrações > Webhooks, confira se o webhook do IntegraCASD está ativo. O Asaas o interrompe depois de 15 falhas seguidas de entrega.',
      '2. Confira se o endereço do webhook está correto e se o sistema está no ar.',
      '3. Depois de corrigir, em Cobranças use "Sincronizar" para trazer os pagamentos do período em que as notificações ficaram paradas.',
      '',
      'Se não houve nenhum pagamento nesse período, o silêncio pode ser normal: nesse caso, ignore este aviso ou aumente o prazo do alerta em Administração.',
      dados.lembrete ? '' : 'Enquanto o silêncio continuar, você receberá um lembrete a cada 24 horas.',
    ]
      .filter((linha, indice, linhas) => !(linha === '' && linhas[indice - 1] === ''))
      .join('\n')
      .trim(),
  };
}

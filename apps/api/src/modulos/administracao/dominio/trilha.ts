// Filtros da consulta da trilha de auditoria [Administração.RF005]. Só TypeScript puro.
import {
  ENTIDADES_AUDITADAS,
  OPERACOES_AUDITADAS,
  type EntidadeAuditada,
  type OperacaoAuditada,
} from '../../../compartilhado/auditoria/trilha.js';
import { MAIOR_ANO, MENOR_ANO, lerDia, lerTexto } from '../../../compartilhado/leitura-de-entrada.js';

export class FiltroDaTrilhaInvalido extends Error {}

// Valor do filtro de usuário que pede só as operações das rotinas automáticas (sem usuário).
export const ROTINA_AUTOMATICA = 'ROTINA_AUTOMATICA';

export type FiltrosDaTrilha = {
  // Dias "AAAA-MM-DD", inclusive, no fuso de São Paulo.
  de: string;
  ate: string;
  // Id do usuário; ROTINA_AUTOMATICA = sem usuário; nulo = todos.
  usuario: string | null;
  operacao: OperacaoAuditada | null;
  entidade: EntidadeAuditada | null;
  // Fluxo A1: um registro específico (uma cobrança, uma movimentação...).
  registroId: string | null;
  pagina: number;
  tamanhoPagina: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Uma ponta do período, lida pela regra comum (compartilhado/leitura-de-entrada.ts): sem ela, um mês 13
// chegava ao banco e virava erro 500. `nome` entra na mensagem: "data inicial", "data final".
function dia(valor: unknown, nome: string): string {
  const lido = lerDia(valor);
  if (lido.valido) return lido.valor;
  if (lido.motivo === 'inexistente') throw new FiltroDaTrilhaInvalido(`A ${nome} não existe no calendário. Confira o dia e o mês.`);
  if (lido.motivo === 'fora-do-limite') {
    throw new FiltroDaTrilhaInvalido(`Confira o ano da ${nome}: ele precisa estar entre ${MENOR_ANO} e ${MAIOR_ANO}.`);
  }
  throw new FiltroDaTrilhaInvalido('Informe as datas no formato AAAA-MM-DD.');
}

function deUmaLista<T extends string>(valor: unknown, lista: readonly T[], mensagem: string): T | null {
  if (valor === undefined || valor === '') return null;
  const encontrado = lista.find((item) => item === valor);
  if (encontrado === undefined) throw new FiltroDaTrilhaInvalido(mensagem);
  return encontrado;
}

function inteiroEntre(valor: unknown, padrao: number, minimo: number, maximo: number, mensagem: string): number {
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) throw new FiltroDaTrilhaInvalido(mensagem);
  return numero;
}

// Fluxo A1: um registro específico, pela regra comum de texto. O PostgreSQL recusa o caractere nulo até
// numa consulta: sem a leitura, o filtro dava erro 500. Vazio é "todos os registros".
function lerRegistroId(valor: unknown): string | null {
  if (valor === undefined || valor === '') return null;
  const lido = lerTexto(valor, 64);
  if (!lido.valido && lido.motivo === 'caractere-nulo') {
    throw new FiltroDaTrilhaInvalido('Há um caractere invisível (nulo) no registro, comum ao colar de outro programa. Apague e digite de novo.');
  }
  if (!lido.valido) throw new FiltroDaTrilhaInvalido('Registro inválido.');
  return lido.valor === '' ? null : lido.valor;
}

// Os valores chegam da URL, como texto. Sem período, o mês corrente (passo 2). `hoje` entra por
// parâmetro para o teste.
export function lerFiltrosDaTrilha(consulta: Record<string, unknown>, hoje: string): FiltrosDaTrilha {
  const de = dia(consulta.de === undefined || consulta.de === '' ? `${hoje.slice(0, 7)}-01` : consulta.de, 'data inicial');
  const ate = dia(consulta.ate === undefined || consulta.ate === '' ? hoje : consulta.ate, 'data final');
  if (de > ate) throw new FiltroDaTrilhaInvalido('A data inicial precisa ser antes da final.');
  const usuario = consulta.usuario === undefined || consulta.usuario === '' ? null : consulta.usuario;
  if (usuario !== null && usuario !== ROTINA_AUTOMATICA && (typeof usuario !== 'string' || !UUID.test(usuario))) {
    throw new FiltroDaTrilhaInvalido('Escolha o usuário na lista.');
  }
  return {
    de,
    ate,
    usuario: usuario as string | null,
    operacao: deUmaLista(consulta.operacao, OPERACOES_AUDITADAS, 'Escolha a operação na lista.'),
    entidade: deUmaLista(consulta.entidade, ENTIDADES_AUDITADAS, 'Escolha o tipo de registro na lista.'),
    registroId: lerRegistroId(consulta.registroId),
    pagina: inteiroEntre(consulta.pagina, 1, 1, 10_000, 'Página inválida.'),
    tamanhoPagina: inteiroEntre(consulta.tamanhoPagina, 50, 1, 200, 'Use de 1 a 200 registros por página.'),
  };
}

// Início do dia "de" e início do dia seguinte a "ate", no fuso de São Paulo (UTC−3, sem horário de verão
// desde 2019): o intervalo [início, fim) cobre os dois dias inteiros.
export function intervaloEmSaoPaulo(de: string, ate: string): { inicio: Date; fim: Date } {
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86_400_000);
  return { inicio, fim };
}

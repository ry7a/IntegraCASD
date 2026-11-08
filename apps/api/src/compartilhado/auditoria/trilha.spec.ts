import type { Prisma } from '../../generated/prisma/client.js';
import { MASCARA_DE_CPF, MASCARA_DE_EMAIL, mascararDadosPessoais, registrarNaTrilha } from './trilha.js';

describe('registrarNaTrilha [Segurança.NF006]', () => {
  it('grava usuário, operação, entidade, registro afetado e detalhe na transação recebida', async () => {
    const gravados: unknown[] = [];
    const tx = {
      registroAuditoria: { create: async (argumentos: unknown) => void gravados.push(argumentos) },
    } as unknown as Prisma.TransactionClient;

    await registrarNaTrilha(tx, {
      usuarioId: 'usuario-1',
      operacao: 'INATIVACAO',
      entidade: 'CATEGORIA',
      registroId: 'cat-1',
      detalhe: 'Categoria "Zeladoria" inativada.',
    });

    expect(gravados).toEqual([
      {
        data: {
          usuarioId: 'usuario-1',
          operacao: 'INATIVACAO',
          entidade: 'CATEGORIA',
          registroId: 'cat-1',
          detalhe: 'Categoria "Zeladoria" inativada.',
        },
      },
    ]);
  });

  it('rotina automática é registrada com usuário nulo', async () => {
    const gravados: Array<{ data: { usuarioId: string | null } }> = [];
    const tx = {
      registroAuditoria: { create: async (argumentos: { data: { usuarioId: string | null } }) => void gravados.push(argumentos) },
    } as unknown as Prisma.TransactionClient;

    await registrarNaTrilha(tx, {
      usuarioId: null,
      operacao: 'INCLUSAO',
      entidade: 'COBRANCA',
      registroId: 'cob-1',
      detalhe: 'Mensalidade gerada pela rotina recorrente.',
    });

    expect(gravados[0]?.data.usuarioId).toBeNull();
  });
});

// Dados fictícios: e-mails de exemplo.org e CPFs inventados.
describe('mascararDadosPessoais (regra B14 em tempo de execução)', () => {
  it('mascara e-mail digitado em texto livre', () => {
    expect(mascararDadosPessoais('Motivo: pedido de fulano.tal+casd@exemplo.org.br por telefone')).toBe(
      `Motivo: pedido de ${MASCARA_DE_EMAIL} por telefone`,
    );
  });

  it('mascara CPF com e sem a máscara', () => {
    expect(mascararDadosPessoais('Justificativa: pago em espécie, CPF 123.456.789-09.')).toBe(
      `Justificativa: pago em espécie, CPF ${MASCARA_DE_CPF}.`,
    );
    expect(mascararDadosPessoais('Depósito de 12345678909 identificado')).toBe(`Depósito de ${MASCARA_DE_CPF} identificado`);
    expect(mascararDadosPessoais('CPF:123456789-09')).toBe(`CPF:${MASCARA_DE_CPF}`);
  });

  it('não mexe em ids, uuids, valores em centavos, datas nem números de outro tamanho', () => {
    const textos = [
      'Aluno alterado: email, celular, cpf.',
      'Registro 3f2b8c1e-12ab-4cde-9f01-123456789012 alterado.',
      'Cobrança "Mensalidade" (pay_12345678901) encontrada no Asaas.',
      'Cobrança cus_000005219613 sincronizada.',
      'Entrada de 1500000 centavos em 2026-11-08: Repasse.',
      'Entrada de R$ 1.234.567,89 pela conciliação.',
      'Contrato 24C002 encerrado em 2026-11-08T12:00:00.000Z.',
      'Evento 1762603200000 recebido.',
      'Número 123456789012 com 12 dígitos e 1234567890 com 10.',
      'Usuário @diretoria avisado.',
    ];
    for (const texto of textos) {
      expect(mascararDadosPessoais(texto)).toBe(texto);
    }
  });

  it('registrarNaTrilha grava o detalhe já mascarado', async () => {
    const gravados: Array<{ data: { detalhe: string } }> = [];
    const tx = {
      registroAuditoria: { create: async (argumentos: { data: { detalhe: string } }) => void gravados.push(argumentos) },
    } as unknown as Prisma.TransactionClient;

    await registrarNaTrilha(tx, {
      usuarioId: 'usuario-1',
      operacao: 'ESTORNO',
      entidade: 'MOVIMENTACAO',
      registroId: 'mov-1',
      detalhe: 'Movimentação "Repasse" estornada. Motivo: era de aluna@exemplo.org (CPF 98765432100).',
    });

    expect(gravados[0]?.data.detalhe).toBe(
      `Movimentação "Repasse" estornada. Motivo: era de ${MASCARA_DE_EMAIL} (CPF ${MASCARA_DE_CPF}).`,
    );
  });
});

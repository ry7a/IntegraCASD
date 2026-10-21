import { ListarAlunosAtivos } from './listar-alunos-ativos.js';
import type { AlunosRepositorio } from '../infra/alunos.repositorio.js';

// Dados fictícios (LGPD: nada de aluno real em teste).
const registroBase = {
  cpf: '12345678901',
  email: 'aluna@exemplo.com',
  matricula: null,
  posto: null,
  curso: null,
  celular: null,
  alojamento: null,
  apto: null,
  vaga: null,
  ativo: true,
  dataCriacao: new Date('2026-01-01'),
  dataAlteracao: new Date('2026-01-01'),
};

const turmaT28 = {
  id: 't1',
  nome: 'T28',
  dataCriacao: new Date('2026-01-01'),
  dataAlteracao: new Date('2026-01-01'),
};

// Dublê do repositório: devolve registros fixos, sem tocar no banco.
function criarRepositorioFalso(registros: unknown[]) {
  return { listarAtivos: async () => registros } as unknown as AlunosRepositorio;
}

describe('ListarAlunosAtivos', () => {
  it('devolve o nome da turma em vez do registro inteiro', async () => {
    const repositorio = criarRepositorioFalso([
      {
        ...registroBase,
        id: 'a1',
        nome: 'Ana Teste',
        situacao: 'MATRICULADO',
        turmaId: 't1',
        turma: turmaT28,
      },
    ]);

    const alunos = await new ListarAlunosAtivos(repositorio).executar();

    expect(alunos).toEqual([
      {
        id: 'a1',
        nome: 'Ana Teste',
        cpf: '12345678901',
        email: 'aluna@exemplo.com',
        turma: 'T28',
        situacao: 'MATRICULADO',
      },
    ]);
  });

  it('aceita aluno sem turma e sem situação', async () => {
    const repositorio = criarRepositorioFalso([
      {
        ...registroBase,
        id: 'a2',
        nome: 'Bruno Teste',
        situacao: null,
        turmaId: null,
        turma: null,
      },
    ]);

    const [aluno] = await new ListarAlunosAtivos(repositorio).executar();

    expect(aluno.turma).toBeNull();
    expect(aluno.situacao).toBeNull();
  });
});

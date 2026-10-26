import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AlunoRegistrado, AlunosRepositorio } from '../infra/alunos.repositorio.js';
import { EventosInternos } from '../../../compartilhado/eventos/eventos-internos.js';
import { AlterarAluno } from './alterar-aluno.js';
import { CriarAluno } from './criar-aluno.js';
import { ListarAlunos } from './listar-alunos.js';

// Dados fictícios (LGPD: nada de aluno real em teste). CPFs só respeitam os dígitos verificadores.
const AUTOR = 'usuario-1';
const CPF_ANA = '52998224725';
const CPF_OUTRO = '39053344705';

const ana: AlunoRegistrado = {
  id: 'a1',
  nome: 'Ana Ficticia',
  cpf: CPF_ANA,
  email: 'ana@exemplo.com',
  celular: null,
  apelido: null,
  matricula: 2041,
  turma: 'T28',
  curso: 'COMP',
  posto: 'CIVIL',
  alojamento: { bloco: 'A', apto: '101', vaga: '1' },
  ativo: true,
};

type Opcoes = {
  existente?: AlunoRegistrado | null;
  cpfAtivoDe?: { id: string; nome: string } | null;
  matriculaEmUso?: boolean;
  vagaOcupada?: boolean;
  lista?: AlunoRegistrado[];
};

function criarRepositorioFalso(opcoes: Opcoes) {
  const chamadas = { criar: [] as unknown[], alterar: [] as Array<{ dados: object; operacao: string }>, listar: [] as string[] };
  const repositorio = {
    listar: async (situacao: string) => {
      chamadas.listar.push(situacao);
      return opcoes.lista ?? [];
    },
    buscarPorId: async () => opcoes.existente ?? null,
    buscarAtivoPorCpf: async () => opcoes.cpfAtivoDe ?? null,
    matriculaEmUso: async () => opcoes.matriculaEmUso ?? false,
    vagaOcupada: async () => opcoes.vagaOcupada ?? false,
    criar: async (dados: object) => {
      chamadas.criar.push(dados);
      return { ...ana, ...dados };
    },
    alterar: async (_id: string, dados: object, operacao: string) => {
      chamadas.alterar.push({ dados, operacao });
      return { ...(opcoes.existente ?? ana), ...dados };
    },
  } as unknown as AlunosRepositorio;
  return { repositorio, chamadas };
}

const entradaValida = { nome: 'Ana Ficticia', cpf: '529.982.247-25', email: 'ANA@exemplo.com' };

describe('ListarAlunos [Cadastros.RF001]', () => {
  it('sem filtro lista só os ativos e marca cadastro incompleto (fluxo A4)', async () => {
    const semEmail = { ...ana, id: 'a2', email: '' };
    const { repositorio, chamadas } = criarRepositorioFalso({ lista: [ana, semEmail] });
    const alunos = await new ListarAlunos(repositorio).executar();
    expect(chamadas.listar).toEqual(['ativos']);
    expect(alunos.map((aluno) => aluno.cadastroIncompleto)).toEqual([false, true]);
  });
});

describe('CriarAluno [Cadastros.RF001]', () => {
  it('grava os dados normalizados', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({});
    await new CriarAluno(repositorio).executar(entradaValida, AUTOR);
    expect(chamadas.criar[0]).toMatchObject({ cpf: CPF_ANA, email: 'ana@exemplo.com' });
  });

  it('CPF de outro cadastro ativo não cria um novo e indica qual é (fluxo E1)', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ cpfAtivoDe: { id: 'a9', nome: 'Ana Ficticia' } });
    await expect(new CriarAluno(repositorio).executar(entradaValida, AUTOR)).rejects.toThrow(/Ana Ficticia/);
    await expect(new CriarAluno(repositorio).executar(entradaValida, AUTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(chamadas.criar).toEqual([]);
  });

  it('recusa vaga ocupada e matrícula repetida com 409', async () => {
    const vaga = { alojamento: { bloco: 'A', apto: '101', vaga: '1' } };
    const ocupada = criarRepositorioFalso({ vagaOcupada: true });
    await expect(new CriarAluno(ocupada.repositorio).executar({ ...entradaValida, ...vaga }, AUTOR)).rejects.toThrow(/vaga/);
    const repetida = criarRepositorioFalso({ matriculaEmUso: true });
    await expect(
      new CriarAluno(repetida.repositorio).executar({ ...entradaValida, matricula: 2041 }, AUTOR),
    ).rejects.toThrow(/matrícula/);
  });

  it('CPF inválido responde 400 com o que fazer', async () => {
    const { repositorio } = criarRepositorioFalso({});
    await expect(
      new CriarAluno(repositorio).executar({ ...entradaValida, cpf: '529.982.247-26' }, AUTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AlterarAluno [Cadastros.RF001]', () => {
  it('inativar não exclui e fica registrado como INATIVACAO (fluxo A1)', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: ana });
    const resultado = await new AlterarAluno(repositorio, new EventosInternos()).executar('a1', { ativo: false }, AUTOR);
    expect(chamadas.alterar).toEqual([{ dados: { ativo: false }, operacao: 'INATIVACAO' }]);
    expect(resultado.ativo).toBe(false);
  });

  it('reativar confere se o CPF foi recadastrado por outro aluno ativo', async () => {
    const inativa = { ...ana, ativo: false };
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: inativa, cpfAtivoDe: { id: 'a9', nome: 'Outra' } });
    await expect(new AlterarAluno(repositorio, new EventosInternos()).executar('a1', { ativo: true }, AUTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(chamadas.alterar).toEqual([]);
  });

  it('trocar o CPF para o de outro aluno ativo é recusado', async () => {
    const { repositorio } = criarRepositorioFalso({ existente: ana, cpfAtivoDe: { id: 'a9', nome: 'Outra' } });
    await expect(new AlterarAluno(repositorio, new EventosInternos()).executar('a1', { cpf: CPF_OUTRO }, AUTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('manter a própria vaga não acusa vaga ocupada', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso({ existente: ana, vagaOcupada: true });
    await new AlterarAluno(repositorio, new EventosInternos()).executar('a1', { apelido: 'Aninha' }, AUTOR);
    expect(chamadas.alterar).toHaveLength(1);
  });

  it('aluno inexistente responde 404; corpo vazio responde 400', async () => {
    const vazio = criarRepositorioFalso({ existente: null });
    await expect(new AlterarAluno(vazio.repositorio, new EventosInternos()).executar('x', { ativo: false }, AUTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const { repositorio } = criarRepositorioFalso({ existente: ana });
    await expect(new AlterarAluno(repositorio, new EventosInternos()).executar('a1', {}, AUTOR)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('evento "aluno alterado"', () => {
  it('mudar nome, CPF ou e-mail avisa os outros módulos; mudar só o apelido não', async () => {
    const eventos = new EventosInternos();
    const recebidos: string[] = [];
    eventos.ouvir('aluno-alterado', async (evento) => void recebidos.push(evento.alunoId));
    const { repositorio } = criarRepositorioFalso({ existente: ana });
    await new AlterarAluno(repositorio, eventos).executar('a1', { apelido: 'Aninha' }, AUTOR);
    expect(recebidos).toEqual([]);
    await new AlterarAluno(repositorio, eventos).executar('a1', { email: 'nova@exemplo.com' }, AUTOR);
    expect(recebidos).toEqual(['a1']);
  });
});

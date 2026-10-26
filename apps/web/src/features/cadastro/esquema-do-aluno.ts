import { z } from 'zod'
import type { AlunoDto, CriarAlunoDto, CursoAluno, PostoAluno } from '@integracasd/api-client'

// Formato do formulário de aluno (novo aluno e aba "Dados"). Só retorno rápido ao usuário:
// a validação que vale é a da API, inclusive o dígito do CPF e o CPF repetido ([Cadastros.RF001]).
// Todos os campos são texto, como nos inputs; `paraCorpoDaApi` converte para o formato da API.
export const esquemaDoAluno = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  cpf: z
    .string()
    .refine((texto) => texto.replace(/\D/g, '').length === 11, 'O CPF precisa ter 11 números, por exemplo 000.000.000-00.'),
  email: z.string().trim().email('Informe um e-mail válido, por exemplo nome@exemplo.com. O Asaas exige o e-mail.'),
  celular: z.string(),
  apelido: z.string(),
  matricula: z.string().refine((texto) => texto.trim() === '' || /^\d+$/.test(texto.trim()), 'Use só números na matrícula.'),
  turma: z.string(),
  curso: z.enum(['', 'AER', 'ELE', 'MEC', 'CIV', 'COMP', 'AESP']),
  posto: z.enum(['', 'CIVIL', 'ALUNO_MILITAR', 'ASP_OF']),
  bloco: z.string(),
  apto: z.string(),
  vaga: z.string(),
})

export type FormularioDoAluno = z.infer<typeof esquemaDoAluno>

export const FORMULARIO_VAZIO: FormularioDoAluno = {
  nome: '',
  cpf: '',
  email: '',
  celular: '',
  apelido: '',
  matricula: '',
  turma: '',
  curso: '',
  posto: '',
  bloco: '',
  apto: '',
  vaga: '',
}

// Campo de texto vazio vira `null` (a API entende `null` como "sem valor").
const ouNulo = (texto: string) => (texto.trim() === '' ? null : texto.trim())

export function paraCorpoDaApi(formulario: FormularioDoAluno): CriarAlunoDto {
  const temAlojamento = [formulario.bloco, formulario.apto, formulario.vaga].some((parte) => parte.trim() !== '')
  return {
    nome: formulario.nome,
    cpf: formulario.cpf,
    email: formulario.email,
    celular: ouNulo(formulario.celular),
    apelido: ouNulo(formulario.apelido),
    matricula: formulario.matricula.trim() === '' ? null : Number(formulario.matricula),
    turma: ouNulo(formulario.turma),
    curso: formulario.curso === '' ? null : (formulario.curso as CursoAluno),
    posto: formulario.posto === '' ? null : (formulario.posto as PostoAluno),
    alojamento: temAlojamento ? { bloco: formulario.bloco, apto: formulario.apto, vaga: formulario.vaga } : null,
  }
}

export function paraFormulario(aluno: AlunoDto): FormularioDoAluno {
  return {
    nome: aluno.nome,
    cpf: aluno.cpf,
    email: aluno.email,
    celular: aluno.celular ?? '',
    apelido: aluno.apelido ?? '',
    matricula: aluno.matricula === null ? '' : String(aluno.matricula),
    turma: aluno.turma ?? '',
    curso: aluno.curso ?? '',
    posto: aluno.posto ?? '',
    bloco: aluno.alojamento?.bloco ?? '',
    apto: aluno.alojamento?.apto ?? '',
    vaga: aluno.alojamento?.vaga ?? '',
  }
}

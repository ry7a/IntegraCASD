import { z } from 'zod'

// Formato do formulário de aluno (novo aluno e dados do aluno). Só retorno rápido ao usuário:
// a validação que vale é a da API, inclusive o CPF repetido ([Cadastros.RF001]).
export const esquemaDoAluno = z.object({
  nome: z.string().min(1, 'Informe o nome completo.'),
  cpf: z
    .string()
    .refine((texto) => texto.replace(/\D/g, '').length === 11, 'O CPF precisa ter 11 números, por exemplo 000.000.000-00.'),
  nascimento: z.string(),
  email: z.string().email('Informe um e-mail válido, por exemplo nome@exemplo.com. O Asaas exige o e-mail.'),
  telefone: z.string(),
  situacao: z.enum(['ATIVO', 'INATIVO']),
})

export type FormularioDoAluno = z.infer<typeof esquemaDoAluno>

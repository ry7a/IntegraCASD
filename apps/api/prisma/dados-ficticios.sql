-- Dados FICTÍCIOS para desenvolvimento local (LGPD: nenhum aluno real aqui).
-- Os CPFs só respeitam a regra dos dígitos verificadores; não pertencem a ninguém.
-- Pode rodar quantas vezes quiser: o que já existe não é duplicado.
-- Uso (na raiz): pnpm --filter api dados-ficticios

INSERT INTO turmas (id, nome, data_alteracao) VALUES
  (gen_random_uuid(), 'T26', now()),
  (gen_random_uuid(), 'T27', now()),
  (gen_random_uuid(), 'T28', now())
ON CONFLICT (nome) DO NOTHING;

INSERT INTO alojamentos (id, bloco, apto, vaga, data_alteracao) VALUES
  (gen_random_uuid(), 'A', '101', '1', now()),
  (gen_random_uuid(), 'A', '101', '2', now()),
  (gen_random_uuid(), 'B', '204', '1', now())
ON CONFLICT (bloco, apto, vaga) DO NOTHING;

INSERT INTO alunos (id, nome, cpf, email, apelido, curso, posto, turma_id, alojamento_id, ativo, data_alteracao)
SELECT gen_random_uuid(), a.nome, a.cpf, a.email, a.apelido, a.curso::curso_aluno, a.posto::posto_aluno,
       t.id, v.id, a.ativo, now()
FROM (VALUES
  ('Ana Clara Ribeiro',          '52601815906', 'ana.ribeiro@exemplo.com',         'Aninha', 'COMP', 'CIVIL',         'T28', 'A', '101', '1', true),
  ('Beatriz Moura Lima',         '08301661305', 'beatriz.lima@exemplo.com',        NULL,     'ELE',  'CIVIL',         'T27', 'A', '101', '2', true),
  ('Carlos Eduardo Vasconcelos', '18609139034', 'carlos.vasconcelos@exemplo.com',  'Cadu',   'AER',  'ALUNO_MILITAR', 'T28', 'B', '204', '1', true),
  ('Júlia Nogueira Prado',       '99603082430', 'julia.prado@exemplo.com',         NULL,     'MEC',  'CIVIL',         'T27', NULL, NULL, NULL, true),
  ('Lucas Andrade Ferreira',     '62819482112', 'lucas.ferreira@exemplo.com',      NULL,     'CIV',  'ASP_OF',        'T26', NULL, NULL, NULL, true),
  -- Cadastro incompleto (como os que virão da carga inicial): sem e-mail, não recebe cobrança.
  ('Pedro Henrique Sales',       '99351819019', '',                                NULL,     NULL,   NULL,            NULL,  NULL, NULL, NULL, true),
  -- Inativo: só aparece com o filtro "Inativos" ou "Todos".
  ('Mariana Costa Albuquerque',  '93786579741', 'mariana.albuquerque@exemplo.com', NULL,     'AESP', 'CIVIL',         'T26', NULL, NULL, NULL, false)
) AS a (nome, cpf, email, apelido, curso, posto, turma, bloco, apto, vaga, ativo)
LEFT JOIN turmas t ON t.nome = a.turma
LEFT JOIN alojamentos v ON v.bloco = a.bloco AND v.apto = a.apto AND v.vaga = a.vaga
WHERE NOT EXISTS (SELECT 1 FROM alunos existente WHERE existente.cpf = a.cpf);

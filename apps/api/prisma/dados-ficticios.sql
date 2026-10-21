-- Dados FICTÍCIOS para desenvolvimento local (LGPD: nenhum aluno real aqui).
-- Pode rodar quantas vezes quiser: o que já existe não é duplicado.
-- Uso (na raiz): pnpm --filter api dados-ficticios

INSERT INTO turmas (id, nome, data_alteracao) VALUES
  (gen_random_uuid(), 'T26', now()),
  (gen_random_uuid(), 'T27', now()),
  (gen_random_uuid(), 'T28', now())
ON CONFLICT (nome) DO NOTHING;

INSERT INTO alunos (id, nome, cpf, email, situacao, turma_id, ativo, data_alteracao)
SELECT gen_random_uuid(), a.nome, a.cpf, a.email, a.situacao::situacao_aluno, t.id, a.ativo, now()
FROM (VALUES
  ('Ana Clara Ribeiro',          '11122233344', 'ana.ribeiro@exemplo.com',         'MATRICULADO', 'T28', true),
  ('Beatriz Moura Lima',         '22233344455', 'beatriz.lima@exemplo.com',        'MATRICULADO', 'T27', true),
  ('Carlos Eduardo Vasconcelos', '33344455566', 'carlos.vasconcelos@exemplo.com',  'INTERCAMBIO', 'T28', true),
  ('Júlia Nogueira Prado',       '44455566677', 'julia.prado@exemplo.com',         'TRANCADO',    'T27', true),
  ('Lucas Andrade Ferreira',     '55566677788', 'lucas.ferreira@exemplo.com',      'MATRICULADO', 'T26', true),
  ('Pedro Henrique Sales',       '77788899900', 'pedro.sales@exemplo.com',         NULL,          NULL,  true),
  -- Inativo: não deve aparecer na lista de alunos ativos.
  ('Mariana Costa Albuquerque',  '66677788899', 'mariana.albuquerque@exemplo.com', 'FORMADO',     'T26', false)
) AS a (nome, cpf, email, situacao, turma, ativo)
LEFT JOIN turmas t ON t.nome = a.turma
WHERE NOT EXISTS (SELECT 1 FROM alunos existente WHERE existente.cpf = a.cpf);

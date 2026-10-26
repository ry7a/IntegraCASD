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

-- Conta e categorias para lançar movimentações (Movimentações > Nova movimentação).
INSERT INTO contas (id, nome, tipo, saldo_inicial_centavos, data_saldo_inicial, data_alteracao)
SELECT gen_random_uuid(), 'Conta corrente', 'CORRENTE', 0, '2026-01-01', now()
WHERE NOT EXISTS (SELECT 1 FROM contas WHERE nome = 'Conta corrente');

INSERT INTO categorias (id, nome, tipo, data_alteracao)
SELECT gen_random_uuid(), c.nome, c.tipo::tipo_categoria, now()
FROM (VALUES
  ('Mensalidades', 'ENTRADA'),
  ('Patrocínios',  'ENTRADA'),
  ('Manutenção',   'SAIDA'),
  ('Eventos',      'SAIDA'),
  ('Outros',       'AMBOS')
) AS c (nome, tipo)
WHERE NOT EXISTS (SELECT 1 FROM categorias existente WHERE existente.nome = c.nome AND existente.ativo);

-- Contratos (Cadastros > Contratos). Os códigos seguem o formato do sistema: ano + C + sequência.
-- Gráfica Pontual vence em menos de 60 dias (aparece o aviso); Som & Luz já terminou o prazo.
INSERT INTO contratos (id, codigo, contraparte, objeto, valor_centavos, periodicidade, data_inicio, data_fim, data_alteracao)
SELECT gen_random_uuid(), c.codigo, c.contraparte, c.objeto, c.valor_centavos, c.periodicidade::periodicidade_contrato,
       c.data_inicio::date, c.data_fim::date, now()
FROM (VALUES
  ('26C001', 'Lavanderia Bem Lavado', 'Manutenção das máquinas',               120000, 'MENSAL',      '2026-01-01', '2026-12-31'),
  ('26C002', 'Gráfica Pontual',       'Impressões e banners',                   45000, 'POR_DEMANDA', '2026-03-15', '2026-12-15'),
  ('26C003', 'Som & Luz Eventos',     'Sonorização da Semana de Integração',   600000, 'UNICA',       '2026-03-01', '2026-03-31')
) AS c (codigo, contraparte, objeto, valor_centavos, periodicidade, data_inicio, data_fim)
WHERE NOT EXISTS (SELECT 1 FROM contratos existente WHERE existente.codigo = c.codigo);

-- Projetos (Cadastros > Projetos): um executado, um em execução e um sem orçamento nem responsável.
INSERT INTO projetos (id, codigo, nome, responsavel, data_inicio, data_fim, orcamento_previsto_centavos, situacao, data_alteracao)
SELECT gen_random_uuid(), p.codigo, p.nome, p.responsavel, p.data_inicio::date, p.data_fim::date, p.orcamento,
       p.situacao::situacao_projeto, now()
FROM (VALUES
  ('26P001', 'Semana de Integração 2026',    'Gabriela Sato',  '2026-02-01', '2026-03-31', 2000000, 'EXECUTADO'),
  ('26P002', 'Reforma da sala de estudos',   'Thiago Rezende', '2026-08-01', '2026-11-30', 1200000, 'EM_EXECUCAO'),
  ('26P003', 'Olimpíada interna do ITA',     NULL,             '2026-10-01', '2026-11-15', NULL,    'LIBERADO')
) AS p (codigo, nome, responsavel, data_inicio, data_fim, orcamento, situacao)
WHERE NOT EXISTS (SELECT 1 FROM projetos existente WHERE existente.codigo = p.codigo);

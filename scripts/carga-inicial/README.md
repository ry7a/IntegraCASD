# Carga inicial

Script que leva os dados das planilhas do CASD para o banco, uma única vez, na implantação
([Distribuição.NF002]). Por enquanto carrega só os **alunos** da aba `H8` de
`data/SIRLEYDE NOVA.xlsx`, com as turmas e as vagas de alojamento. Movimentações, projetos e
contratos ficam para uma próxima etapa. Cobranças nunca entram por aqui: nenhuma cobrança pode
existir só no banco, sem o Asaas.

## LGPD: leia antes de rodar

- A planilha e tudo o que o script gera (`dados/`) têm dados reais de alunos. A pasta `dados/`
  está no `.gitignore`: nunca force a inclusão, não envie por chat e não copie para testes ou docs.
- **Não abra o túnel do ambiente de testes** (Cloudflare) com um banco que recebeu esta carga:
  ele deixa o sistema acessível pela internet. Para testar com o Asaas, use um banco só com dados
  fictícios.
- No terminal o script mostra só totais, nunca nomes ou CPFs.

## Como rodar (PowerShell, na raiz)

Precisa de Python 3.10 ou mais novo e do `openpyxl` (única dependência):

```powershell
python -m pip install -r scripts/carga-inicial/requirements.txt
```

1. Coloque a planilha em `data/SIRLEYDE NOVA.xlsx` (ou passe outro caminho com `--planilha`).
2. Gere o SQL e o relatório de pendências:

   ```powershell
   python scripts/carga-inicial/carregar_alunos.py
   ```

3. Com o banco no ar (`docker compose up -d`) e as migrações aplicadas, carregue:

   ```powershell
   pnpm --filter api exec prisma db execute --file ../../scripts/carga-inicial/dados/alunos.sql
   ```

O SQL roda numa transação só: ou entra tudo, ou nada. Pode ser aplicado de novo sem duplicar:
turma, vaga e aluno (pelo CPF) que já existem são pulados. Cada aluno incluído ganha um registro
na trilha de auditoria (sem usuário, como as rotinas automáticas).

Para começar de um banco vazio: `pnpm --filter api exec prisma migrate reset`. **Apaga todos os
dados do banco local**, inclusive os usuários; depois rode o `admin-inicial` de novo.

## O que o script gera

| Arquivo (em `dados/`)   | Conteúdo                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `alunos.sql`            | Turmas, vagas e alunos, prontos para o banco                                 |
| `pendencias-alunos.csv` | Uma linha por problema: linha da planilha, campo, valor, problema e o que a carga fez. Abre direto no Excel |

A área administrativa confere as pendências e corrige pela tela de Cadastros antes de o sistema
entrar em operação.

## Regras (em `regras.py`)

As mesmas do backend (`apps/api/src/modulos/cadastros/dominio/`), para o que entra passar na tela
de edição depois.

| Coluna            | Vira                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `ALUNOS`, `CPF`   | Nome e CPF. CPF perde a pontuação e recupera os zeros à esquerda. Sem nome ou CPF, a linha não é carregada |
| `EMAIL`           | Em minúsculas. Vazio ou inválido: aluno entra como **cadastro incompleto** (não recebe cobrança) |
| `CPF` inválido    | Também entra como cadastro incompleto e vai para as pendências                             |
| `TURMA`           | Ano de formatura vira turma: `2028` → `T28`                                                |
| `CURSO`           | `2º Comp` → `COMP`. `Fund` (os dois primeiros anos) fica sem curso                         |
| `POSTO`           | `Al Mil` → aluno militar; `Asp`/`Asp Of` → aspirante. Vazio fica sem posto (a planilha não diz se é civil) |
| `ALOJ/APTO/VAGA`  | `H-8A`, `105`, `C` → vaga bloco A, apto 105, vaga C. Uma vaga tem no máximo um aluno ativo |
| `SITUAC`          | Ativos: Matriculado e sem situação. Inativos: Trancado, Intercâmbio, Desligado, Suspenso, Fora do H8 (decisão de 30/10/2026) |
| `CELULAR`, `MATRIC`, `APELIDO` | Normalizados; valor que não serve fica em branco e vai para as pendências     |

Repetições: CPF repetido não é carregado; matrícula repetida fica em branco; vaga já ocupada por
outro aluno ativo fica em branco. Em todos os casos a primeira linha da planilha vence.

`STATUS`, `BOLETO`, `NEG` e `DEVENDO` não são carregados: são da cobrança.

## Testes

```powershell
python -m unittest discover -s scripts/carga-inicial -v
```

Só dados fictícios. Ainda não rodam nos ganchos do git nem no CI.

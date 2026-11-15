"""Testes da carga anonimizada (homologação). Só dados fictícios (LGPD).

Os CPFs válidos são os do apps/api/prisma/dados-ficticios.sql: passam na conta dos dígitos
verificadores, mas não pertencem a ninguém.

Rodar, na raiz do repositório:
    python -m unittest discover -s scripts/carga-inicial -v
"""

import copy
import random
import re
import unittest
from collections import Counter

import anonimizar
import regras
from carregar_alunos import Aluno, Debito


def debito(referencia: str) -> Debito:
    return Debito(referencia=referencia, descricao=f"Mensalidade {referencia}",
                  vencimento=f"{referencia}-05", valor_centavos=13176)


def aluno(linha, nome, cpf, email, turma, ativo=True, alojamento=None, debitos=(),
          matricula=None, celular=None, apelido=None, curso="COMP", posto="CIVIL") -> Aluno:
    return Aluno(linha=linha, nome=nome, cpf=cpf, email=email, celular=celular, apelido=apelido,
                 matricula=matricula, turma=turma, curso=curso, posto=posto, alojamento=alojamento,
                 ativo=ativo, debitos=[debito(r) for r in debitos])


def alunos_ficticios() -> list[Aluno]:
    """Doze alunos inventados: duas turmas e um grupo sem turma, ativos e inativos, com e sem vaga,
    com e sem e-mail, um CPF inválido e débitos diferentes para cada um."""
    return [
        aluno(10, "Ana Clara Ribeiro", "52601815906", "ana.ribeiro@exemplo.com", "T27",
              alojamento=("A", "101", "A"), debitos=["2026-08"], matricula=111111,
              celular="12991110001", apelido="Aninha"),
        aluno(11, "Beatriz Moura Lima", "08301661305", "beatriz.lima@exemplo.com", "T27",
              alojamento=("A", "101", "B"), debitos=["2026-08", "2026-09"], matricula=111112,
              celular="12991110002", curso="ELE"),
        aluno(12, "Carlos Eduardo Vasconcelos", "18609139034", "carlos.vasconcelos@exemplo.com", "T27",
              alojamento=("A", "102", "A"), debitos=[], matricula=111113, posto="ALUNO_MILITAR",
              apelido="Cadu"),
        aluno(13, "Júlia Nogueira Prado", "99603082430", "", "T27",
              alojamento=("A", "102", "B"), debitos=["2026-10"], curso="MEC"),
        aluno(14, "Lucas Andrade Ferreira", "62819482112", "lucas.ferreira@exemplo.com", "T28",
              alojamento=("B", "201", "A"), debitos=["2026-07", "2026-08", "2026-09"], matricula=111114,
              posto="ASP_OF", curso="CIV"),
        aluno(15, "Pedro Henrique Sales", "99351819019", "pedro.sales@exemplo.com", "T28",
              alojamento=("B", "201", "B"), debitos=["2026-09"], matricula=111115),
        aluno(16, "Mariana Costa Albuquerque", "93786579741", "mariana.albuquerque@exemplo.com", "T28",
              ativo=False, alojamento=("B", "202", "A"), debitos=["2026-06"], matricula=111116, curso="AESP"),
        # CPF com o último dígito trocado: cadastro incompleto.
        aluno(17, "Rafael Teixeira Gomes", "52601815907", "rafael.gomes@exemplo.com", "T28",
              debitos=["2026-10"], matricula=111117),
        aluno(18, "Sofia Martins Rocha", "08301661305", "sofia.rocha@exemplo.com", "T28",
              ativo=False, alojamento=("B", "202", "B"), debitos=[], matricula=111118),
        aluno(19, "Thiago Ramos Duarte", "18609139034", "", None,
              debitos=["2026-05", "2026-06"], curso=None, posto=None),
        aluno(20, "Vitória Almeida Castro", "99603082430", "vitoria.castro@exemplo.com", None,
              alojamento=("C", "301", "A"), debitos=["2026-10"], matricula=111119, curso=None),
        aluno(21, "Daniel Souza Pires", "62819482112", "daniel.pires@exemplo.com", None,
              ativo=False, debitos=[], matricula=111120, curso=None),
    ]


def referencias(a: Aluno) -> tuple[str, ...]:
    return tuple(d.referencia for d in a.debitos)


class TestCpfFicticio(unittest.TestCase):
    def test_cpf_ficticio_valido_passa_na_conta(self):
        gerador = random.Random(1)
        for _ in range(50):
            numero = anonimizar.cpf_ficticio(gerador, valido=True)
            self.assertRegex(numero, r"^\d{11}$")
            self.assertTrue(regras.cpf_valido(numero), numero)

    def test_cpf_ficticio_invalido_nao_passa(self):
        gerador = random.Random(2)
        for _ in range(50):
            numero = anonimizar.cpf_ficticio(gerador, valido=False)
            self.assertRegex(numero, r"^\d{11}$")
            self.assertFalse(regras.cpf_valido(numero), numero)


class TestAnonimizar(unittest.TestCase):
    def setUp(self):
        self.entrada = alunos_ficticios()
        self.saida = anonimizar.anonimizar(self.entrada, random.Random(3))

    def test_nenhum_identificador_original_sobrevive(self):
        for campo in ("nome", "cpf", "matricula"):
            originais = {getattr(a, campo) for a in self.entrada} - {None}
            novos = {getattr(a, campo) for a in self.saida} - {None}
            self.assertFalse(originais & novos, f"{campo} original na saída")
        emails_originais = {a.email for a in self.entrada} - {""}
        emails_novos = {a.email for a in self.saida} - {""}
        self.assertFalse(emails_originais & emails_novos, "e-mail original na saída")
        self.assertTrue(all(a.celular is None and a.apelido is None for a in self.saida))
        self.assertTrue(all(a.linha == 0 for a in self.saida))

    def test_cadastro_incompleto_continua_incompleto(self):
        self.assertEqual(Counter(a.email == "" for a in self.entrada), Counter(a.email == "" for a in self.saida))
        self.assertEqual(Counter(regras.cpf_valido(a.cpf) for a in self.entrada),
                         Counter(regras.cpf_valido(a.cpf) for a in self.saida))
        emails = [a.email for a in self.saida if a.email]
        self.assertTrue(all(e.endswith("@exemplo.com") for e in emails), emails)
        self.assertEqual(len(emails), len(set(emails)))
        cpfs = [a.cpf for a in self.saida]
        self.assertEqual(len(cpfs), len(set(cpfs)))

    def test_matricula_em_branco_continua_em_branco(self):
        self.assertEqual(Counter(a.matricula is None for a in self.entrada),
                         Counter(a.matricula is None for a in self.saida))
        matriculas = [a.matricula for a in self.saida if a.matricula is not None]
        self.assertEqual(len(matriculas), len(set(matriculas)))
        self.assertTrue(all(100000 <= m <= 999999 for m in matriculas), matriculas)

    def test_atributos_mantidos(self):
        def chave(a):
            return (a.turma, a.curso, a.posto, a.ativo)
        self.assertEqual(Counter(map(chave, self.entrada)), Counter(map(chave, self.saida)))

    def test_debitos_continuam_na_mesma_turma(self):
        def chave(a):
            return (a.turma, referencias(a))
        self.assertEqual(Counter(map(chave, self.entrada)), Counter(map(chave, self.saida)))

    def test_vagas_de_ativos_ficam_com_ativos(self):
        for ativo in (True, False):
            antes = [a.alojamento for a in self.entrada if a.ativo == ativo and a.alojamento]
            depois = [a.alojamento for a in self.saida if a.ativo == ativo and a.alojamento]
            self.assertEqual(sorted(antes), sorted(depois))
            self.assertEqual(len(depois), len(set(depois)))

    def test_nao_altera_a_lista_de_entrada(self):
        entrada = alunos_ficticios()
        copia = copy.deepcopy(entrada)
        anonimizar.anonimizar(entrada, random.Random(4))
        self.assertEqual(entrada, copia)

    def test_mesma_semente_mesmo_resultado(self):
        primeira = anonimizar.anonimizar(alunos_ficticios(), random.Random(7))
        segunda = anonimizar.anonimizar(alunos_ficticios(), random.Random(7))
        self.assertEqual(primeira, segunda)


if __name__ == "__main__":
    unittest.main()

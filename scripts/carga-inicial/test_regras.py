"""Testes das regras da carga inicial. Só dados fictícios (LGPD).

Os CPFs são os do apps/api/prisma/dados-ficticios.sql: passam na conta dos dígitos
verificadores, mas não pertencem a ninguém.

Rodar, na raiz do repositório:
    python -m unittest discover scripts/carga-inicial
"""

import unittest

import regras
from regras import ValorInvalido


class TestCpf(unittest.TestCase):
    def test_numero_do_excel_recupera_os_zeros_a_esquerda(self):
        # 08301661305 virou o número 8301661305.0 na planilha.
        self.assertEqual(regras.cpf(8301661305.0), "08301661305")

    def test_texto_com_lixo_fica_so_com_os_digitos(self):
        self.assertEqual(regras.cpf("'526.018.159-06"), "52601815906")

    def test_vazio_e_longo_demais_sao_recusados(self):
        with self.assertRaises(ValorInvalido):
            regras.cpf(None)
        with self.assertRaises(ValorInvalido):
            regras.cpf("526018159061")

    def test_digitos_verificadores(self):
        self.assertTrue(regras.cpf_valido("52601815906"))
        self.assertFalse(regras.cpf_valido("52601815907"))
        self.assertFalse(regras.cpf_valido("11111111111"))


class TestCamposDoAluno(unittest.TestCase):
    def test_nome_tira_espacos_repetidos(self):
        self.assertEqual(regras.nome("  Ana   Clara Ribeiro "), "Ana Clara Ribeiro")
        with self.assertRaises(ValorInvalido):
            regras.nome("Al")

    def test_email_invalido_vira_none(self):
        self.assertEqual(regras.email(" Ana.Ribeiro@Exemplo.com "), "ana.ribeiro@exemplo.com")
        self.assertIsNone(regras.email("ana.ribeiro"))
        self.assertIsNone(regras.email(None))

    def test_celular_aceita_os_formatos_da_planilha(self):
        self.assertEqual(regras.celular("(12) 90000-0000"), "12900000000")
        self.assertEqual(regras.celular(12900000000.0), "12900000000")
        self.assertEqual(regras.celular("(012) 90000-0000"), "12900000000")
        self.assertIsNone(regras.celular(None))
        with self.assertRaises(ValorInvalido):
            regras.celular("90000-0000")

    def test_apelido_numerico_nao_ganha_ponto_zero(self):
        self.assertEqual(regras.apelido(10.0), "10")

    def test_matricula(self):
        self.assertEqual(regras.matricula(12345.0), 12345)
        self.assertEqual(regras.matricula("12345"), 12345)
        self.assertIsNone(regras.matricula(None))

    def test_turma_vem_do_ano_de_formatura(self):
        self.assertEqual(regras.turma(2028.0), "T28")
        self.assertEqual(regras.turma("2025'"), "T25")
        self.assertIsNone(regras.turma(None))
        with self.assertRaises(ValorInvalido):
            regras.turma("T")

    def test_curso(self):
        self.assertEqual(regras.curso("2º Comp"), "COMP")
        self.assertEqual(regras.curso("*1º Aesp"), "AESP")
        self.assertEqual(regras.curso("1º Civil"), "CIV")
        # Fundamental (dois primeiros anos) ainda não tem curso.
        self.assertIsNone(regras.curso("1º Fund"))
        self.assertIsNone(regras.curso("1º"))
        with self.assertRaises(ValorInvalido):
            regras.curso("2º Química")

    def test_posto(self):
        self.assertEqual(regras.posto("Al Mil"), "ALUNO_MILITAR")
        self.assertEqual(regras.posto("Asp OF"), "ASP_OF")
        self.assertEqual(regras.posto("ASP"), "ASP_OF")
        self.assertIsNone(regras.posto(None))
        with self.assertRaises(ValorInvalido):
            regras.posto("Tenente")

    def test_alojamento(self):
        self.assertEqual(regras.alojamento("H-8A", 105.0, "c"), ("A", "105", "C"))
        self.assertIsNone(regras.alojamento(None, None, ""))
        with self.assertRaises(ValorInvalido):
            regras.alojamento("H-8A", None, "C")
        with self.assertRaises(ValorInvalido):
            regras.alojamento("Fora", 105, "C")

    def test_ativo_segue_a_decisao_da_equipe(self):
        self.assertTrue(regras.ativo("Matriculado"))
        self.assertTrue(regras.ativo("Matriculada"))
        self.assertTrue(regras.ativo(None))
        self.assertFalse(regras.ativo("INTERCÂMBIO"))
        self.assertFalse(regras.ativo("Trancado"))
        self.assertFalse(regras.ativo("Desligado"))
        self.assertFalse(regras.ativo("Fora do H8"))


class TestMesesDoFundo(unittest.TestCase):
    def test_rotulo_do_mes(self):
        self.assertEqual(regras.mes_da_planilha("SETEMBRO 2026"), (2026, 9))
        self.assertEqual(regras.mes_da_planilha("MARÇO 2026"), (2026, 3))
        with self.assertRaises(ValorInvalido):
            regras.mes_da_planilha("inadimplencia")

    def test_descricao_igual_a_da_geracao_do_sistema(self):
        self.assertEqual(regras.descricao_do_mes(2026, 3), "Mensalidade de março/2026")

    def test_so_nao_pago_e_debito(self):
        self.assertTrue(regras.mes_em_aberto("NÃO PAGO"))
        self.assertTrue(regras.mes_em_aberto("Nao pago "))
        for sem_debito in ("PAGO", None, "ANTES DA MORADIA", "BOLSISTA", "ISENTO", "FORA DO H8",
                           "INTERCÂMBIO", "TRANCADO", "DESLIGADO", "VAGA DISPONÍVEL"):
            self.assertFalse(regras.mes_em_aberto(sem_debito), sem_debito)
        with self.assertRaises(ValorInvalido):
            regras.mes_em_aberto("#REF!")

    def test_centavos_sem_float(self):
        self.assertEqual(regras.centavos(120.0), 12000)
        self.assertEqual(regras.centavos(122.5), 12250)
        self.assertEqual(regras.centavos("R$ 1.234,56"), 123456)
        for invalido in (None, 0, "abc", 1.005):
            with self.assertRaises(ValorInvalido):
                regras.centavos(invalido)


if __name__ == "__main__":
    unittest.main()

"""Testes das regras da carga inicial. Só dados fictícios (LGPD).

Os CPFs são os do apps/api/prisma/dados-ficticios.sql: passam na conta dos dígitos
verificadores, mas não pertencem a ninguém.

Rodar, na raiz do repositório:
    python -m unittest discover scripts/carga-inicial
"""

import re
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
        with self.assertRaises(ValorInvalido):
            regras.matricula(3_000_000_000)  # não cabe na coluna do banco

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
        self.assertEqual(regras.posto("Civil"), "CIVIL")
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

    def test_descricao_usa_o_mes_da_referencia_e_cita_o_da_planilha(self):
        # "setembro/2026" da planilha vence em 05/10/2026: referência 2026-10, como na geração do sistema.
        self.assertEqual(regras.descricao_do_debito("2026-10", 2026, 9),
                         "Mensalidade de outubro/2026 (planilha: setembro/2026)")
        self.assertEqual(regras.descricao_do_debito("2027-01", 2026, 12),
                         "Mensalidade de janeiro/2027 (planilha: dezembro/2026)")

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


class TestDebitosDoAluno(unittest.TestCase):
    """ler_debitos, com meses fictícios montados à mão."""

    def setUp(self):
        import carregar_alunos
        self.carga = carregar_alunos
        self.meses = [
            carregar_alunos.MesDaPlanilha(coluna_situacao=2, rotulo="outubro/2026",
                                          descricao="Mensalidade de novembro/2026 (planilha: outubro/2026)",
                                          vencimento="2026-11-05", valor_centavos=12000),
            carregar_alunos.MesDaPlanilha(coluna_situacao=5, rotulo="setembro/2026",
                                          descricao="Mensalidade de outubro/2026 (planilha: setembro/2026)",
                                          vencimento="2026-10-05", valor_centavos=12000),
        ]

    def test_so_mes_vencido_vira_herdada(self):
        resultado = self.carga.Resultado()
        debitos = self.carga.ler_debitos(resultado, 10, self.meses, ["NÃO PAGO", "NÃO PAGO"], 2, "2026-10-31")
        self.assertEqual([d.referencia for d in debitos], ["2026-10"])
        # O mês a vencer fica nas pendências, e a conferência com DEVENDO continua batendo.
        self.assertEqual([p[1] for p in resultado.pendencias], ["SITUAÇÃO de outubro/2026"])

    def test_divergencia_com_devendo_vira_pendencia(self):
        resultado = self.carga.Resultado()
        self.carga.ler_debitos(resultado, 10, self.meses, ["PAGO", "NÃO PAGO"], 3, "2026-12-01")
        self.assertEqual([p[1] for p in resultado.pendencias], ["DEVENDO"])


class TestTrilhaDaCarga(unittest.TestCase):
    """LGPD: a trilha de auditoria não pode ser apagada, então o detalhe gravado pela carga não
    leva nome, CPF, e-mail nem outro dado do aluno (mesma regra do backend, B14)."""

    CAMPOS_PESSOAIS = re.compile(r"\b(nome|cpf|email|celular|apelido|matricula)\b")

    def setUp(self):
        import carregar_alunos
        self.carga = carregar_alunos
        self.aluno = carregar_alunos.Aluno(
            linha=10, nome="Ana Clara Ribeiro", cpf="52601815906", email="ana.ficticia@exemplo.com",
            celular="12999990000", apelido="Aninha", matricula=12345, turma="T28", curso="COMP",
            posto=None, alojamento=("A", "105", "C"), ativo=True,
        )

    def trecho_da_trilha(self, sql: str) -> str:
        inicio = sql.index("INSERT INTO registros_auditoria")
        return sql[inicio:]

    def conferir_sem_dados_pessoais(self, sql: str) -> str:
        trilha = self.trecho_da_trilha(sql)
        for valor in (self.aluno.nome, self.aluno.cpf, self.aluno.email, self.aluno.celular, self.aluno.apelido):
            self.assertNotIn(valor, trilha)
        # Nem as colunas: 'Aluno "' || nome || '"' tiraria o nome do banco sem aparecer no SQL.
        self.assertIsNone(self.CAMPOS_PESSOAIS.search(trilha), trilha)
        return trilha

    def test_inclusao_do_aluno(self):
        trilha = self.conferir_sem_dados_pessoais(self.carga.sql_do_aluno(self.aluno))
        self.assertIn("'Aluno incluído pela carga inicial.'", trilha)

    def test_inclusao_da_cobranca_herdada(self):
        debito = self.carga.Debito(referencia="2026-10", vencimento="2026-10-05", valor_centavos=12000,
                                   descricao="Mensalidade de outubro/2026 (planilha: setembro/2026)")
        trilha = self.conferir_sem_dados_pessoais(self.carga.sql_do_debito(self.aluno, debito))
        self.assertIn("herdada da planilha pela carga inicial", trilha)


if __name__ == "__main__":
    unittest.main()

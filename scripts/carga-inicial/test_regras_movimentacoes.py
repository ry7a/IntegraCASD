"""Testes das regras da carga das movimentações. Só dados fictícios (LGPD).

Os rótulos de contrato e projeto são inventados (os nomes vêm de apps/api/prisma/dados-ficticios.sql),
nunca os da planilha real.

Rodar, na raiz do repositório:
    python -m unittest discover -s scripts/carga-inicial -v
"""

import unittest

from regras_movimentacoes import (
    Rotulo,
    categoria_da_saida,
    contraparte_e_objeto,
    descricao_neutra,
    mediana_centavos,
    nome_do_rotulo,
    numero_de_nf,
    periodicidade,
    rotulo,
    so_numero_de_nf,
)


class TestRotulo(unittest.TestCase):
    def test_contrato_com_contraparte_e_objeto(self):
        r = rotulo("26C001 - Lavanderia Bem Lavado -  Manutenção das máquinas")
        self.assertEqual(r.tipo, "CONTRATO")
        self.assertEqual(r.codigo, "26C001")
        self.assertEqual(contraparte_e_objeto(r), ("Lavanderia Bem Lavado", "Manutenção das máquinas"))

    def test_contrato_de_uma_parte(self):
        r = rotulo("26C002 - Contrato da Gráfica Pontual_")
        self.assertEqual(contraparte_e_objeto(r), ("Contrato da Gráfica Pontual", "Contrato da Gráfica Pontual"))

    def test_projeto_e_formato_antigo_com_z(self):
        r = rotulo("26P004 - Reforma da sala de estudos")
        self.assertEqual((r.tipo, r.codigo), ("PROJETO", "26P004"))
        self.assertEqual(nome_do_rotulo(r), "Reforma da sala de estudos")
        self.assertEqual((rotulo("23Z005 - Iluminação externa").tipo, rotulo("23Z005 - Iluminação externa").codigo),
                         ("PROJETO", "23Z005"))

    def test_centro_e_administrativo(self):
        centro = rotulo("Z - Jardins")
        self.assertEqual((centro.tipo, centro.codigo, nome_do_rotulo(centro)), ("CENTRO", None, "Jardins"))
        administrativo = rotulo("A - Impostos")
        self.assertEqual((administrativo.tipo, nome_do_rotulo(administrativo)), ("ADMINISTRATIVO", "Impostos"))

    def test_vazio_e_desconhecido(self):
        for vazio in (None, "  "):
            r = rotulo(vazio)
            self.assertEqual((r.tipo, r.reconhecido), ("NENHUM", True))
        desconhecido = rotulo("Sem padrão")
        self.assertEqual((desconhecido.tipo, desconhecido.reconhecido), ("NENHUM", False))


class TestCategoriaENotaFiscal(unittest.TestCase):
    def test_categoria_da_saida(self):
        self.assertEqual(categoria_da_saida(rotulo("A - Taxa Teste"), "Administrativo"), "Taxa Teste")
        self.assertEqual(categoria_da_saida(rotulo("26C001 - Lavanderia Bem Lavado"), " Contratos "), "Contratos")
        self.assertEqual(categoria_da_saida(rotulo(None), None), "Outros")

    def test_numero_de_nf(self):
        self.assertEqual(numero_de_nf("NF 685"), "685")
        self.assertEqual(numero_de_nf("nf: 1234 - Loja Exemplo"), "1234")
        self.assertEqual(numero_de_nf("Nota Fiscal nº 77"), "77")
        self.assertEqual(numero_de_nf("NF-e 3456"), "3456")
        self.assertIsNone(numero_de_nf("Pagamento"))
        self.assertIsNone(numero_de_nf(None))

    def test_so_numero_de_nf(self):
        self.assertTrue(so_numero_de_nf("NF 685"))
        self.assertTrue(so_numero_de_nf(" nf 12 "))
        self.assertFalse(so_numero_de_nf("NF 685 - Loja Exemplo"))
        self.assertFalse(so_numero_de_nf(""))


class TestTextosEValores(unittest.TestCase):
    def test_descricao_neutra(self):
        self.assertEqual(descricao_neutra(rotulo("26C001 - Lavanderia Bem Lavado"), "Contratos"),
                         "Pagamento do contrato 26C001")
        self.assertEqual(descricao_neutra(rotulo("26P004 - Reforma da sala de estudos"), "Projetos"),
                         "Despesa do projeto 26P004")
        self.assertEqual(descricao_neutra(rotulo("Z - Jardins"), "Zeladoria"), "Zeladoria: Jardins")
        self.assertEqual(descricao_neutra(rotulo("A - Impostos"), "Impostos"), "Impostos")
        self.assertEqual(descricao_neutra(rotulo(None), "Outros"), "Lançamento sem projetização")

    def test_periodicidade_e_mediana(self):
        self.assertEqual(periodicidade(6), "MENSAL")
        self.assertEqual(periodicidade(5), "POR_DEMANDA")
        self.assertEqual(mediana_centavos([100, 300, 200]), 200)
        self.assertEqual(mediana_centavos([100, 200]), 150)

    def test_rotulo_e_imutavel(self):
        self.assertIsInstance(rotulo("Z - Jardins"), Rotulo)


if __name__ == "__main__":
    unittest.main()

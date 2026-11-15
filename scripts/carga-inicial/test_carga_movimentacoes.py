"""Testes da carga das movimentações. Só dados fictícios (LGPD).

A planilha de teste é montada aqui, com o mesmo formato da planilha do Fundo de Manutenção, mas
com rótulos, nomes e valores inventados.

Rodar, na raiz do repositório:
    python -m unittest discover -s scripts/carga-inicial -v
"""

import copy
import datetime
import tempfile
import unittest
from pathlib import Path

import openpyxl

import anonimizar_movimentacoes as am
import carregar_movimentacoes as cm

MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro",
         "Outubro", "Novembro", "Dezembro"]


def dia(mes: int, numero: int) -> datetime.datetime:
    return datetime.datetime(2026, mes, numero)


def aba_do_mes(planilha, nome: str, entradas: list, saidas: list) -> None:
    aba = planilha.create_sheet(nome)
    aba.append([0, "Entradas", 0, "Saídas"])
    aba.append(["Data", "Categoria", "Descrição", "Valor", "Data", "Projetização", "Categoria", "Descrição",
                "Valor", "Comprovante"])
    for i in range(max(len(entradas), len(saidas))):
        entrada = list(entradas[i]) if i < len(entradas) else [None] * 4
        saida = list(saidas[i]) if i < len(saidas) else [None] * 5
        aba.append(entrada + saida + [None])


def planilha_ficticia(pasta: str) -> Path:
    planilha = openpyxl.Workbook()
    planilha.remove(planilha.active)

    aba_do_mes(planilha, "Janeiro", entradas=[
        (dia(1, 5), "Cobrança de Boletos", None, 1000.00),
        (dia(1, 6), "Outros", "Pix de Fulano Teste", 50.00),
    ], saidas=[
        (dia(1, 10), "26C001 - Lavanderia Bem Lavado - Manutenção das máquinas", "Contratos", "NF 12 - Lavanderia", 300.00),
        (dia(1, 11), "26P001 - Reforma Teste", "Projetos", "Tinta", 200.00),
        (dia(1, 12), "Z - Jardins", "Zeladoria", "Adubo", 80.00),
        (dia(1, 15), "A - Funcionárias", "Administrativo", "Salário Maria Teste", 1500.00),
        (dia(1, 20), "A - Funcionárias", "Administrativo", "Salário Joana Teste", 1400.00),
        (dia(1, 21), "A - Impostos", "Administrativo", None, 30.00),
        (dia(1, 22), None, None, "Sem classificação", 10.00),
        (dia(1, 23), "Z - Jardins", "Zeladoria", "Valor zerado", 0),
    ])
    aba_do_mes(planilha, "Fevereiro", entradas=[], saidas=[
        (dia(2, 15), "A - Funcionárias", "Administrativo", "Salário Maria Teste", 1500.00),
        (dia(2, 16), "26C001 - Lavanderia Bem Lavado - Manutenção das máquinas", "Contratos", None, 300.00),
    ])

    resumo = planilha.create_sheet("Resumo Mensal")
    resumo.append(["Resumo Geral", None] + MESES)
    for _ in range(6):
        resumo.append([])
    resumo.append(["Conta Corrente Fundo de Manutenção", "Saldo Inicial", 5000.00])  # linha 8
    resumo.append([None, "Total de Entradas", 1050.00, 0])  # linha 9
    resumo.append([None, "Total de Saídas", 3520.00, 1800.00])  # linha 10
    resumo.append([])
    resumo.append([])
    resumo.append(["Conta de Investimentos Fundo de Manutenção", "Saldo Inicial", 20000.10])  # linha 13
    resumo.append([None, "Total de Entradas", 100.00, 90.00])  # linha 14

    investimentos = planilha.create_sheet("Investimentos")
    investimentos.append(["Valor", "Data", None, "Descrição", "Saldo", "Categoria"])
    investimentos.append([20000.00, dia(1, 1), 0, "Saldo Investimento Inicial", 20000.00, "Inicial"])
    investimentos.append([100.00, dia(1, 31), 0, "Rendimento Jan/26", 20100.00, "Rendimento"])
    investimentos.append([90.00, dia(2, 28), 0, "Rendimento Fev/26", 20190.00, "Rendimento"])

    zeladoria = planilha.create_sheet("Zeladoria e Administrativo")
    # Como na planilha real: cada mês ocupa 3 colunas, mas junho tem uma a mais ("Valor a Consultar"),
    # o que empurra julho em diante uma coluna para a direita.
    linha1 = ["Projetização", "Gasto Médio", "Desvio Padrão"]
    linha2 = [None, None, None]
    for mes in MESES:
        linha1 += [mes, None, None] + ([None] if mes == "Junho" else [])
        linha2 += (["Valor Liberado", "Valor a Consultar", "Gasto", "Saldo"] if mes == "Junho"
                   else ["Valor Liberado", "Gasto", "Saldo"])
    zeladoria.append(linha1)
    zeladoria.append(linha2)
    jardins = ["Z - Jardins", 0, 0] + [None] * (len(linha1) - 3)
    jardins[linha1.index("Janeiro")] = 500.00
    jardins[linha1.index("Junho")] = 450.00
    jardins[linha1.index("Julho")] = 400.00
    zeladoria.append(jardins)
    impostos = ["A - Impostos", 0, 0] + [None] * (len(linha1) - 3)
    impostos[linha1.index("Janeiro")] = 100.00
    zeladoria.append(impostos)

    contratos = planilha.create_sheet("Contratos")
    contratos.append(["Descrição", "Numeração", "Situação", "Valor Pago", "Valor A Pagar", "Valor Comprometido",
                      "Descrição do valor", "Data de Início", "Período de Vigência"])
    contratos.append(["Lavanderia Bem Lavado", "26C001", "Ativo", 600, 0, 600, "R$ 300,00 mensal",
                      datetime.datetime(2025, 3, 1), "12 meses"])

    caminho = Path(pasta) / "planilha-ficticia.xlsx"
    planilha.save(caminho)
    return caminho


class ComPlanilhaFicticia(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pasta = tempfile.TemporaryDirectory()
        cls.carga = cm.ler_planilha(planilha_ficticia(cls.pasta.name))

    @classmethod
    def tearDownClass(cls):
        cls.pasta.cleanup()


class TestLeitura(ComPlanilhaFicticia):
    def test_le_entradas_saidas_e_rendimentos(self):
        lancamentos = self.carga.lancamentos
        entradas = [l for l in lancamentos if l.tipo == "ENTRADA" and l.conta == "CORRENTE"]
        saidas = [l for l in lancamentos if l.tipo == "SAIDA"]
        rendimentos = [l for l in lancamentos if l.conta == "APLICACAO"]
        self.assertEqual(len(entradas), 2)
        self.assertEqual(sum(l.valor_centavos for l in entradas), 105000)
        self.assertEqual(len(saidas), 9)
        self.assertEqual(len(rendimentos), 2)
        self.assertEqual(sum(l.valor_centavos for l in rendimentos), 19000)
        self.assertTrue(all(l.tipo == "ENTRADA" and l.categoria == "Rendimento" for l in rendimentos))

    def test_saldos_iniciais(self):
        self.assertEqual(self.carga.saldo_corrente, 500000)
        self.assertEqual(self.carga.saldo_aplicacao, 2000010)
        self.assertEqual(self.carga.ano, 2026)

    def test_verbas_com_a_coluna_extra_de_junho(self):
        verbas = self.carga.verbas
        self.assertIn(cm.Verba("Jardins", 2026, 1, 50000), verbas)
        self.assertIn(cm.Verba("Jardins", 2026, 6, 45000), verbas)
        self.assertIn(cm.Verba("Jardins", 2026, 7, 40000), verbas)
        self.assertFalse([v for v in verbas if v.centro == "Impostos"])
        self.assertEqual(self.carga.centros, ["Jardins"])

    def test_contrato_e_projeto(self):
        self.assertEqual(self.carga.contratos, [cm.ContratoDaCarga(
            codigo="26C001", contraparte="Lavanderia Bem Lavado", objeto="Manutenção das máquinas",
            valor_centavos=30000, periodicidade="POR_DEMANDA", data_inicio="2025-03-01")])
        self.assertEqual(self.carga.projetos, [cm.ProjetoDaCarga(codigo="26P001", nome="Reforma Teste",
                                                                 data_inicio="2026-01-11")])

    def test_categorias_das_saidas(self):
        categorias = {l.categoria for l in self.carga.lancamentos if l.tipo == "SAIDA"}
        self.assertEqual(categorias, {"Funcionárias", "Impostos", "Contratos", "Projetos", "Zeladoria", "Outros"})

    def test_pendencias(self):
        problemas = [p[4] for p in self.carga.pendencias]
        self.assertEqual(sum(1 for p in problemas if "zero" in p), 1)
        self.assertEqual(sum(1 for p in problemas if "sem projetização e sem categoria" in p), 1)
        self.assertEqual(sum(1 for p in problemas if "funcionári" in p), 3)
        self.assertEqual(sum(1 for p in problemas if "Resumo Mensal" in p), 1)

    def test_resumo_mensal(self):
        self.assertEqual(self.carga.resumo["entradas"][1], 105000)
        self.assertEqual(self.carga.resumo["saidas"][2], 180000)
        self.assertEqual(self.carga.resumo["rendimentos"][2], 9000)


def trechos_da_trilha(sql: str) -> list[str]:
    """O pedaço de cada comando que grava na trilha (depois de INSERT INTO registros_auditoria)."""
    return [comando.split("INSERT INTO registros_auditoria", 1)[1]
            for comando in sql.split(";\n") if "INSERT INTO registros_auditoria" in comando]


class TestSql(ComPlanilhaFicticia):
    def setUp(self):
        self.sql = cm.gerar_sql(self.carga)

    def test_sql_em_uma_transacao_com_marcos(self):
        self.assertTrue(self.sql.startswith("--"))
        self.assertIn("\nBEGIN;\n", self.sql)
        self.assertTrue(self.sql.endswith("COMMIT;\n"))
        self.assertIn("'movimentacoes-planilha-2026-01'", self.sql)
        self.assertIn("'movimentacoes-planilha-2026-02'", self.sql)

    def test_sql_faz_cast_dos_enums(self):
        for tipo in ("tipo_movimentacao", "forma_pagamento", "origem_movimentacao", "tipo_categoria", "tipo_conta",
                     "periodicidade_contrato", "situacao_contrato", "situacao_projeto"):
            self.assertIn(f"::{tipo}", self.sql, tipo)

    def test_sql_remapeia_codigo_em_colisao(self):
        self.assertIn("'Reforma Teste (planilha: 26P001)'", self.sql)
        self.assertIn("codigo ~ '^26P[0-9]{3}$'", self.sql)
        self.assertIn("'Manutenção das máquinas (planilha: 26C001)'", self.sql)

    def test_sql_confere_categoria_incompativel(self):
        self.assertIn("RAISE EXCEPTION", self.sql)
        self.assertIn("nome = 'Outros' AND tipo NOT IN ('AMBOS')", self.sql)
        self.assertIn("nome = 'Impostos' AND tipo NOT IN ('SAIDA', 'AMBOS')", self.sql)
        self.assertIn("nome = 'Rendimento' AND tipo NOT IN ('ENTRADA', 'AMBOS')", self.sql)

    def test_trilha_nao_leva_descricao_nem_contraparte(self):
        for texto_da_planilha in ("Pix de Fulano Teste", "Lavanderia Bem Lavado", "Salário Maria Teste"):
            self.assertIn(texto_da_planilha, self.sql)
            for trecho in trechos_da_trilha(self.sql):
                self.assertNotIn(texto_da_planilha, trecho)

    def test_cada_movimentacao_respeita_o_marco_do_mes(self):
        movimentacoes = [c for c in self.sql.split(";\n") if "INSERT INTO movimentacoes" in c]
        self.assertEqual(len(movimentacoes), 13)  # 2 entradas + 9 saídas + 2 rendimentos
        self.assertTrue(all("WHERE NOT EXISTS (SELECT 1 FROM registros_auditoria WHERE entidade = 'CARGA'" in c
                            for c in movimentacoes))


class TestConferencia(ComPlanilhaFicticia):
    def test_conferencia_por_mes(self):
        linhas = cm.conferencia(self.carga)
        janeiro = next(l for l in linhas if l.startswith("Janeiro"))
        self.assertIn("entradas confere", janeiro)
        self.assertIn("saídas confere", janeiro)
        self.assertIn("rendimentos confere", janeiro)

        alterada = copy.deepcopy(self.carga)
        alterada.resumo["entradas"][1] = 100000
        janeiro = next(l for l in cm.conferencia(alterada) if l.startswith("Janeiro"))
        self.assertIn("entradas difere em R$ 50,00", janeiro)


def totais_por_mes_tipo_e_conta(carga) -> dict:
    totais = {}
    for l in carga.lancamentos:
        chave = (l.data[:7], l.tipo, l.conta)
        totais[chave] = totais.get(chave, 0) + l.valor_centavos
    return totais


class TestAnonimizado(ComPlanilhaFicticia):
    def setUp(self):
        self.anonima = am.anonimizar(self.carga)

    def test_anonimizado_troca_descricoes(self):
        descricoes = [l.descricao for l in self.anonima.lancamentos]
        for texto_da_planilha in ("Fulano", "Maria", "Joana", "Lavanderia", "Tinta", "Adubo", "Sem classificação"):
            self.assertFalse(any(texto_da_planilha in d for d in descricoes), texto_da_planilha)
        self.assertIn("Pagamento do contrato 26C001 (NF 12)", descricoes)
        self.assertIn("Zeladoria: Jardins", descricoes)

    def test_entradas_e_rendimentos(self):
        entradas = [l.descricao for l in self.anonima.lancamentos if l.tipo == "ENTRADA" and l.conta == "CORRENTE"]
        self.assertEqual(sorted(entradas), ["Cobrança de Boletos", "Outros"])
        rendimentos = [l.descricao for l in self.anonima.lancamentos if l.conta == "APLICACAO"]
        self.assertEqual(rendimentos, ["Rendimento de 01/2026", "Rendimento de 02/2026"])

    def test_folha_somada_por_mes(self):
        folhas = [l for l in self.anonima.lancamentos if l.categoria == "Funcionárias"]
        self.assertEqual([(l.data, l.valor_centavos, l.descricao) for l in folhas],
                         [("2026-01-20", 290000, "Folha das funcionárias de 01/2026"),
                          ("2026-02-15", 150000, "Folha das funcionárias de 02/2026")])

    def test_contraparte_de_duas_partes_vira_contratada(self):
        contrato = self.anonima.contratos[0]
        self.assertEqual((contrato.contraparte, contrato.objeto),
                         ("Contratada do contrato 26C001", "Manutenção das máquinas"))

    def test_totais_por_mes_e_conta_iguais(self):
        self.assertEqual(totais_por_mes_tipo_e_conta(self.carga), totais_por_mes_tipo_e_conta(self.anonima))

    def test_nao_altera_a_carga_recebida(self):
        self.assertIn("Pix de Fulano Teste", [l.descricao for l in self.carga.lancamentos])
        self.assertEqual(self.carga.contratos[0].contraparte, "Lavanderia Bem Lavado")
        self.assertTrue(self.carga.pendencias)
        self.assertEqual(self.anonima.pendencias, [])


class TestTravaDasMovimentacoes(ComPlanilhaFicticia):
    def test_trava_acha_textos_no_sql_real(self):
        anonima = am.anonimizar(self.carga)
        achados = am.textos_pessoais_no_sql(cm.gerar_sql(self.carga), self.carga, anonima)
        self.assertGreater(achados["descricao"], 0)
        self.assertGreater(achados["contraparte"], 0)

    def test_trava_nao_acha_nada_no_anonimizado(self):
        anonima = am.anonimizar(self.carga)
        achados = am.textos_pessoais_no_sql(cm.gerar_sql(anonima, anonimizado=True), self.carga, anonima)
        self.assertEqual(achados, {"descricao": 0, "contraparte": 0})

    def test_trava_ignora_texto_que_tambem_e_dado_mantido(self):
        carga = copy.deepcopy(self.carga)
        next(l for l in carga.lancamentos if l.categoria == "Impostos").descricao = "Impostos"
        anonima = am.anonimizar(carga)
        achados = am.textos_pessoais_no_sql(cm.gerar_sql(anonima, anonimizado=True), carga, anonima)
        self.assertEqual(achados["descricao"], 0)

    def test_avisa_mes_com_um_pagamento_de_funcionaria(self):
        self.assertEqual(am.meses_com_um_pagamento_de_funcionaria(self.carga), ["2026-02"])


if __name__ == "__main__":
    unittest.main()

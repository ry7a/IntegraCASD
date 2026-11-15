"""Carga inicial das movimentações: planilha do Fundo de Manutenção do H8 -> SQL ([Distribuição.NF002]).

Lê data/2026 AEITA-CASD Fundo de Manutenção do H8.xlsx como o MER manda
(docs/arquitetura/mer-financeiro.md, "Da planilha para o modelo"):

- abas Janeiro…Dezembro: entradas e saídas da conta corrente; a projetização de cada saída vira o
  vínculo com contrato, projeto ou centro de custo (regras em regras_movimentacoes.py);
- Resumo Mensal: saldos iniciais das duas contas (C8 e C13) e os totais de cada mês, para conferir;
- Investimentos: rendimentos da conta de investimentos;
- Zeladoria e Administrativo: verba liberada para cada centro de custo em cada mês;
- Contratos: data de início dos contratos que estão lá.

Grava, na pasta dados/ (fora do git, LGPD), o SQL numa transação só e o relatório de pendências.
O script não fala com o banco. No terminal só aparecem totais, nunca descrições ou nomes.

Uso, na raiz do repositório:
    python scripts/carga-inicial/carregar_movimentacoes.py
    python scripts/carga-inicial/carregar_movimentacoes.py --anonimizar
"""

import datetime
import sys
import warnings
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

import openpyxl

from regras_movimentacoes import (
    CATEGORIA_SEM_CLASSIFICACAO,
    Rotulo,
    categoria_da_saida,
    contraparte_e_objeto,
    mediana_centavos,
    nome_do_rotulo,
    periodicidade,
    rotulo,
)

PASTA_DO_SCRIPT = Path(__file__).resolve().parent
RAIZ = PASTA_DO_SCRIPT.parent.parent
PLANILHA_PADRAO = RAIZ / "data" / "2026 AEITA-CASD Fundo de Manutenção do H8.xlsx"
PASTA_DE_SAIDA = PASTA_DO_SCRIPT / "dados"

MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro",
         "Outubro", "Novembro", "Dezembro"]
TAMANHO_MAXIMO_DA_DESCRICAO = 300  # o mesmo limite do backend (movimentacao.ts)
CATEGORIA_DO_RENDIMENTO = "Rendimento"  # regra 5 do MER
CATEGORIA_DAS_FUNCIONARIAS = "Funcionárias"


@dataclass
class Lancamento:
    """Uma movimentação da planilha. `data` é "AAAA-MM-DD"; `descricao` é a original ("" se vazia)."""
    aba: str
    linha: int
    tipo: str  # ENTRADA ou SAIDA
    conta: str  # CORRENTE ou APLICACAO
    data: str
    valor_centavos: int
    categoria: str
    descricao: str
    rotulo: Rotulo


@dataclass(frozen=True)
class Verba:
    centro: str
    ano: int
    mes: int
    valor_centavos: int


@dataclass
class ContratoDaCarga:
    codigo: str
    contraparte: str
    objeto: str
    valor_centavos: int  # valor de referência: a mediana dos pagamentos do ano
    periodicidade: str
    data_inicio: str


@dataclass
class ProjetoDaCarga:
    codigo: str
    nome: str
    data_inicio: str


@dataclass
class Carga:
    ano: int
    saldo_corrente: int
    saldo_aplicacao: int
    lancamentos: list[Lancamento]
    centros: list[str]
    verbas: list[Verba]
    contratos: list[ContratoDaCarga]
    projetos: list[ProjetoDaCarga]
    # Totais do Resumo Mensal, para conferir: {"entradas" | "saidas" | "rendimentos": {mês: centavos}}
    resumo: dict[str, dict[int, int]]
    # Cada pendência: (aba, linha, campo, valor na planilha, problema, o que a carga fez)
    pendencias: list[tuple[str, int, str, str, str, str]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Valores das células
# ---------------------------------------------------------------------------


def texto(valor) -> str:
    return "" if valor is None else " ".join(str(valor).split())


def centavos(valor) -> int | None:
    """Número da planilha em centavos, arredondado ao centavo. None quando a célula não tem número.

    Arredonda (em vez de recusar fração de centavo, como `regras.centavos`) porque muitas células
    desta planilha são fórmulas, e a soma em float deixa restos como 91810.96000000001.
    Aceita zero e negativo: quem chama decide o que é válido.
    """
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        numero = Decimal(str(valor))
    else:
        bruto = texto(valor).replace("R$", "").strip()
        if "," in bruto:
            bruto = bruto.replace(".", "").replace(",", ".")
        try:
            numero = Decimal(bruto)
        except InvalidOperation:
            return None
    return int((numero * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def data_iso(valor) -> str | None:
    if isinstance(valor, datetime.datetime):
        return valor.date().isoformat()
    if isinstance(valor, datetime.date):
        return valor.isoformat()
    return None


def celula(linha: tuple, indice: int):
    return linha[indice] if indice < len(linha) else None


# ---------------------------------------------------------------------------
# Leitura
# ---------------------------------------------------------------------------


class Pendencias:
    def __init__(self) -> None:
        self.lista: list[tuple[str, int, str, str, str, str]] = []

    def anotar(self, aba: str, linha: int, campo: str, valor, problema: str, feito: str) -> None:
        self.lista.append((aba, linha, campo, "" if valor is None else str(valor), problema, feito))


def montar_lancamento(pendencias: Pendencias, aba: str, linha: int, lado: str, tipo: str, conta: str,
                      data_bruta, valor_bruto, categoria: str, descricao_bruta, r: Rotulo) -> Lancamento | None:
    """Confere data e valor; devolve None (e anota a pendência) quando a linha não pode entrar."""
    data = data_iso(data_bruta)
    if data is None:
        pendencias.anotar(aba, linha, f"Data ({lado})", data_bruta, "data vazia ou que não é data",
                          "lançamento NÃO carregado")
        return None
    valor = centavos(valor_bruto)
    if valor is None or valor <= 0:
        pendencias.anotar(aba, linha, f"Valor ({lado})", valor_bruto, "valor vazio, zero ou negativo",
                          "lançamento NÃO carregado")
        return None
    descricao = texto(descricao_bruta)
    if len(descricao) > TAMANHO_MAXIMO_DA_DESCRICAO:
        pendencias.anotar(aba, linha, f"Descrição ({lado})", descricao, "descrição com mais de 300 caracteres",
                          "cortada em 300 caracteres")
        descricao = descricao[:TAMANHO_MAXIMO_DA_DESCRICAO]
    return Lancamento(aba, linha, tipo, conta, data, valor, categoria, descricao, r)


def ler_aba_do_mes(aba, nome: str, pendencias: Pendencias) -> list[Lancamento]:
    """Linha 2 é o cabeçalho. Entradas: Data, Categoria, Descrição, Valor (a partir do 1º "Data").
    Saídas: Data, Projetização, Categoria, Descrição, Valor (a partir do 2º "Data")."""
    linhas = list(aba.iter_rows(values_only=True))
    cabecalho = [texto(v) for v in linhas[1]] if len(linhas) > 1 else []
    colunas_de_data = [i for i, v in enumerate(cabecalho) if v == "Data"]
    if len(colunas_de_data) < 2:
        sys.exit(f"A aba {nome} não tem as duas tabelas (Entradas e Saídas) na linha 2. A planilha mudou de formato?")
    e, s = colunas_de_data[0], colunas_de_data[1]

    lancamentos = []
    for numero, linha in enumerate(linhas[2:], start=3):
        entrada = [celula(linha, e + k) for k in range(4)]
        if any(v is not None for v in entrada):
            data, categoria_bruta, descricao, valor = entrada
            categoria = texto(categoria_bruta) or CATEGORIA_SEM_CLASSIFICACAO
            lancamento = montar_lancamento(pendencias, nome, numero, "entrada", "ENTRADA", "CORRENTE",
                                           data, valor, categoria, descricao, rotulo(None))
            if lancamento:
                lancamentos.append(lancamento)
                if not texto(categoria_bruta):
                    pendencias.anotar(nome, numero, "Categoria (entrada)", "", "entrada sem categoria",
                                      f"carregada na categoria {CATEGORIA_SEM_CLASSIFICACAO}")

        saida = [celula(linha, s + k) for k in range(5)]
        if any(v is not None for v in saida):
            data, projetizacao, categoria_bruta, descricao, valor = saida
            r = rotulo(projetizacao)
            categoria = categoria_da_saida(r, categoria_bruta)
            lancamento = montar_lancamento(pendencias, nome, numero, "saída", "SAIDA", "CORRENTE",
                                           data, valor, categoria, descricao, r)
            if lancamento is None:
                continue
            lancamentos.append(lancamento)
            if not r.reconhecido:
                pendencias.anotar(nome, numero, "Projetização", projetizacao,
                                  "projetização fora dos formatos conhecidos", "carregada sem vínculo")
            if r.tipo == "NENHUM" and not texto(categoria_bruta):
                pendencias.anotar(nome, numero, "Categoria (saída)", "", "saída sem projetização e sem categoria",
                                  f"carregada na categoria {CATEGORIA_SEM_CLASSIFICACAO}")
            if r.tipo == "ADMINISTRATIVO" and categoria == CATEGORIA_DAS_FUNCIONARIAS:
                pendencias.anotar(nome, numero, "Projetização", projetizacao,
                                  "pagamento de funcionária sem cadastro de funcionário na planilha",
                                  "carregado sem vínculo com funcionário")
    return lancamentos


def ler_resumo(aba) -> tuple[int, int, dict[str, dict[int, int]]]:
    """Saldos iniciais (C8 corrente, C13 investimentos) e os totais de cada mês (linhas 9, 10 e 14)."""
    linhas = list(aba.iter_rows(min_row=1, max_row=16, values_only=True))
    saldos = []
    for numero in (8, 13):
        linha = linhas[numero - 1] if numero <= len(linhas) else ()
        if texto(celula(linha, 1)) != "Saldo Inicial" or centavos(celula(linha, 2)) is None:
            sys.exit(f"Resumo Mensal: esperava 'Saldo Inicial' e um número em B{numero}/C{numero}. "
                     "A planilha mudou de formato?")
        saldos.append(centavos(celula(linha, 2)))
    resumo: dict[str, dict[int, int]] = {}
    for chave, numero in (("entradas", 9), ("saidas", 10), ("rendimentos", 14)):
        linha = linhas[numero - 1] if numero <= len(linhas) else ()
        valores = {mes: centavos(celula(linha, 1 + mes)) for mes in range(1, 13)}
        resumo[chave] = {mes: v for mes, v in valores.items() if v is not None}
    return saldos[0], saldos[1], resumo


def ler_rendimentos(aba, saldo_aplicacao: int, pendencias: Pendencias) -> list[Lancamento]:
    """Categoria Rendimento vira entrada na conta de investimentos; Inicial é o saldo inicial (só confere)."""
    linhas = list(aba.iter_rows(values_only=True))
    cabecalho = [texto(v) for v in linhas[0]]
    try:
        c_valor, c_data, c_descricao, c_categoria = (cabecalho.index(n) for n in ("Valor", "Data", "Descrição", "Categoria"))
    except ValueError:
        sys.exit("A aba Investimentos não tem as colunas Valor, Data, Descrição e Categoria.")
    lancamentos = []
    for numero, linha in enumerate(linhas[1:], start=2):
        categoria = texto(celula(linha, c_categoria))
        valor = celula(linha, c_valor)
        if categoria == "Inicial":
            if centavos(valor) != saldo_aplicacao:
                pendencias.anotar("Investimentos", numero, "Valor (Inicial)", valor,
                                  "diferente do saldo inicial do Resumo Mensal (C13)", "vale o saldo do Resumo Mensal")
        elif categoria == CATEGORIA_DO_RENDIMENTO:
            lancamento = montar_lancamento(pendencias, "Investimentos", numero, "rendimento", "ENTRADA", "APLICACAO",
                                           celula(linha, c_data), valor, CATEGORIA_DO_RENDIMENTO,
                                           celula(linha, c_descricao), rotulo(None))
            if lancamento:
                lancamentos.append(lancamento)
        elif categoria or valor is not None:
            pendencias.anotar("Investimentos", numero, "Categoria", categoria,
                              "categoria de investimento desconhecida (aplicação e resgate não são tratados)",
                              "lançamento NÃO carregado")
    return lancamentos


def ler_verbas(aba, ano: int, pendencias: Pendencias) -> tuple[list[str], list[Verba]]:
    """Linha 1: nome do mês; linha 2: "Valor Liberado" (a primeira a partir da coluna do mês, porque
    junho tem uma coluna a mais). Só as linhas Z - X (centros de custo) viram verba."""
    linhas = list(aba.iter_rows(values_only=True))
    meses = {MESES.index(texto(v)) + 1: j for j, v in enumerate(linhas[0]) if texto(v) in MESES}
    rotulos_da_linha2 = [texto(v) for v in linhas[1]]
    coluna_do_liberado = {}
    for mes, j in meses.items():
        k = next((k for k in range(j, len(rotulos_da_linha2)) if rotulos_da_linha2[k] == "Valor Liberado"), None)
        if k is not None:
            coluna_do_liberado[mes] = k

    centros: list[str] = []
    verbas: list[Verba] = []
    for numero, linha in enumerate(linhas[2:], start=3):
        r = rotulo(celula(linha, 0))
        if r.tipo != "CENTRO":
            continue
        centro = nome_do_rotulo(r)
        if centro not in centros:
            centros.append(centro)
        for mes, k in coluna_do_liberado.items():
            valor = centavos(celula(linha, k))
            if valor is None:
                continue
            if valor < 0:
                pendencias.anotar("Zeladoria e Administrativo", numero, f"Valor Liberado ({MESES[mes - 1]})",
                                  celula(linha, k), "valor liberado negativo", "verba NÃO carregada")
                continue
            verbas.append(Verba(centro, ano, mes, valor))
    return centros, verbas


def ler_datas_dos_contratos(aba) -> dict[str, str]:
    """Código do contrato (coluna Numeração) -> data de início, quando a célula é uma data."""
    linhas = list(aba.iter_rows(values_only=True))
    cabecalho = [texto(v) for v in linhas[0]]
    if "Numeração" not in cabecalho or "Data de Início" not in cabecalho:
        return {}
    c_codigo, c_data = cabecalho.index("Numeração"), cabecalho.index("Data de Início")
    datas = {}
    for linha in linhas[1:]:
        codigo, data = texto(celula(linha, c_codigo)), data_iso(celula(linha, c_data))
        if codigo and data:
            datas[codigo] = data
    return datas


def montar_contratos_e_projetos(lancamentos: list[Lancamento], datas_de_inicio: dict[str, str]
                                ) -> tuple[list[ContratoDaCarga], list[ProjetoDaCarga]]:
    """Só os contratos e projetos citados nas saídas, na ordem do primeiro pagamento."""
    pagamentos: dict[str, list[Lancamento]] = {}
    for l in sorted(lancamentos, key=lambda l: l.data):
        if l.tipo == "SAIDA" and l.rotulo.tipo in ("CONTRATO", "PROJETO"):
            pagamentos.setdefault(l.rotulo.codigo, []).append(l)
    contratos, projetos = [], []
    for codigo, lista in pagamentos.items():
        r = lista[0].rotulo
        primeira_data = lista[0].data
        if r.tipo == "CONTRATO":
            contraparte, objeto = contraparte_e_objeto(r)
            meses = {l.data[:7] for l in lista}
            contratos.append(ContratoDaCarga(
                codigo=codigo, contraparte=contraparte, objeto=objeto,
                valor_centavos=mediana_centavos([l.valor_centavos for l in lista]),
                periodicidade=periodicidade(len(meses)),
                data_inicio=datas_de_inicio.get(codigo, primeira_data),
            ))
        else:
            projetos.append(ProjetoDaCarga(codigo=codigo, nome=nome_do_rotulo(r), data_inicio=primeira_data))
    return contratos, projetos


def ler_planilha(caminho: Path) -> Carga:
    # O openpyxl avisa de validações e formatos que não usamos.
    warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")
    planilha = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    try:
        return ler_abas(planilha)
    finally:
        planilha.close()  # no modo de leitura o arquivo fica aberto até fechar (no Windows, trancado)


def ler_abas(planilha) -> Carga:
    for obrigatoria in ("Janeiro", "Resumo Mensal", "Investimentos", "Zeladoria e Administrativo"):
        if obrigatoria not in planilha.sheetnames:
            sys.exit(f"A planilha não tem a aba {obrigatoria}.")
    pendencias = Pendencias()

    lancamentos: list[Lancamento] = []
    for nome in MESES:
        if nome in planilha.sheetnames:
            lancamentos += ler_aba_do_mes(planilha[nome], nome, pendencias)
    do_janeiro = sorted(l.data for l in lancamentos if l.aba == "Janeiro")
    if not do_janeiro:
        sys.exit("A aba Janeiro não tem nenhum lançamento: não dá para saber o ano da planilha.")
    ano = int(do_janeiro[0][:4])

    saldo_corrente, saldo_aplicacao, resumo = ler_resumo(planilha["Resumo Mensal"])
    lancamentos += ler_rendimentos(planilha["Investimentos"], saldo_aplicacao, pendencias)
    centros, verbas = ler_verbas(planilha["Zeladoria e Administrativo"], ano, pendencias)
    for l in lancamentos:
        if l.rotulo.tipo == "CENTRO" and nome_do_rotulo(l.rotulo) not in centros:
            centros.append(nome_do_rotulo(l.rotulo))
    datas = ler_datas_dos_contratos(planilha["Contratos"]) if "Contratos" in planilha.sheetnames else {}
    contratos, projetos = montar_contratos_e_projetos(lancamentos, datas)

    lancamentos.sort(key=lambda l: l.data)  # ordem estável: no mesmo dia, a ordem da planilha
    return Carga(ano=ano, saldo_corrente=saldo_corrente, saldo_aplicacao=saldo_aplicacao, lancamentos=lancamentos,
                 centros=centros, verbas=verbas, contratos=contratos, projetos=projetos, resumo=resumo,
                 pendencias=pendencias.lista)

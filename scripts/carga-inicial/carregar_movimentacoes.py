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

import argparse
import csv
import datetime
import sys
import warnings
from collections import Counter
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

import openpyxl

import anonimizar_movimentacoes
from carregar_alunos import reais, sql_texto
from regras_movimentacoes import (
    CATEGORIA_DAS_FUNCIONARIAS,
    CATEGORIA_SEM_CLASSIFICACAO,
    Rotulo,
    categoria_da_saida,
    contraparte_e_objeto,
    descricao_neutra,
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


# ---------------------------------------------------------------------------
# Saída: SQL, conferência e relatório de pendências
# ---------------------------------------------------------------------------

CONTA_CORRENTE = "Conta Corrente Fundo de Manutenção"
CONTA_APLICACAO = "Conta de Investimentos Fundo de Manutenção"
NOME_DA_CONTA = {"CORRENTE": CONTA_CORRENTE, "APLICACAO": CONTA_APLICACAO}
DETALHE_DA_CARGA = "incluída pela carga inicial (planilha)."


def marco_do_mes(mes: str) -> str:
    """Registro da trilha que diz "as movimentações deste mês já entraram" (mes = "AAAA-MM")."""
    return f"movimentacoes-planilha-{mes}"


def com_trilha(insercao: str, entidade: str, detalhe: str, retorno: str = "id") -> str:
    """Insere e, no mesmo comando, grava a inclusão na trilha (usuario_id nulo = rotina automática).
    `detalhe` é uma expressão SQL; nunca leva descrição, contraparte ou nome (regra B14)."""
    return (
        f"WITH novo AS (\n{insercao}\n  RETURNING {retorno}\n)\n"
        "INSERT INTO registros_auditoria (id, usuario_id, operacao, entidade, registro_id, detalhe)\n"
        f"SELECT gen_random_uuid(), NULL, 'INCLUSAO', '{entidade}', id::text, {detalhe}\n"
        "FROM novo;\n"
    )


def tipos_das_categorias(carga: Carga) -> dict[str, str]:
    """ENTRADA se a categoria só aparece em entradas, SAIDA se só em saídas, AMBOS se nas duas
    ("Outros" é sempre AMBOS)."""
    tipos: dict[str, set[str]] = {}
    for l in carga.lancamentos:
        tipos.setdefault(l.categoria, set()).add(l.tipo)
    resultado = {}
    for nome, encontrados in sorted(tipos.items()):
        if nome == CATEGORIA_SEM_CLASSIFICACAO or len(encontrados) == 2:
            resultado[nome] = "AMBOS"
        else:
            resultado[nome] = next(iter(encontrados))
    return resultado


def sql_das_categorias(carga: Carga) -> list[str]:
    """Antes de incluir, confere se já existe uma categoria ativa com o nome e outro tipo: aí a carga
    para com uma mensagem, em vez de gravar movimentação em categoria incompatível."""
    partes = []
    for nome, tipo in tipos_das_categorias(carga).items():
        aceitos = "('AMBOS')" if tipo == "AMBOS" else f"('{tipo}', 'AMBOS')"
        partes.append(
            "DO $$ BEGIN\n"
            f"  IF EXISTS (SELECT 1 FROM categorias WHERE ativo AND nome = {sql_texto(nome)} AND tipo NOT IN {aceitos}) THEN\n"
            f"    RAISE EXCEPTION 'A categoria \"%\" já existe com outro tipo: ajuste-a antes da carga.', {sql_texto(nome)};\n"
            "  END IF;\n"
            "END $$;\n"
        )
        partes.append(com_trilha(
            "  INSERT INTO categorias (id, nome, tipo, data_alteracao)\n"
            f"  SELECT gen_random_uuid(), {sql_texto(nome)}, '{tipo}'::tipo_categoria, now()\n"
            f"  WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE ativo AND nome = {sql_texto(nome)})",
            "CATEGORIA", f"'Categoria {DETALHE_DA_CARGA}'"))
    return partes


def sql_das_contas(carga: Carga) -> list[str]:
    partes = []
    for tipo, saldo in (("CORRENTE", carga.saldo_corrente), ("APLICACAO", carga.saldo_aplicacao)):
        nome = sql_texto(NOME_DA_CONTA[tipo])
        partes.append(com_trilha(
            "  INSERT INTO contas (id, nome, tipo, saldo_inicial_centavos, data_saldo_inicial, data_alteracao)\n"
            f"  SELECT gen_random_uuid(), {nome}, '{tipo}'::tipo_conta, {saldo}, DATE '{carga.ano}-01-01', now()\n"
            f"  WHERE NOT EXISTS (SELECT 1 FROM contas WHERE nome = {nome})",
            "CONTA", f"'Conta {DETALHE_DA_CARGA}'"))
    return partes


def sql_dos_centros_e_verbas(carga: Carga) -> list[str]:
    partes = []
    for centro in carga.centros:
        partes.append(com_trilha(
            "  INSERT INTO centros_custo (id, nome, data_alteracao)\n"
            f"  SELECT gen_random_uuid(), {sql_texto(centro)}, now()\n"
            f"  WHERE NOT EXISTS (SELECT 1 FROM centros_custo WHERE nome = {sql_texto(centro)})",
            "CENTRO_CUSTO", f"'Centro de custo {DETALHE_DA_CARGA}'"))
    for v in carga.verbas:
        partes.append(com_trilha(
            "  INSERT INTO verbas_mensais (id, centro_custo_id, ano, mes, valor_liberado_centavos, data_alteracao)\n"
            f"  SELECT gen_random_uuid(), c.id, {v.ano}, {v.mes}, {v.valor_centavos}, now()\n"
            f"  FROM centros_custo c WHERE c.nome = {sql_texto(v.centro)}\n"
            "  ON CONFLICT (centro_custo_id, ano, mes) DO NOTHING",
            "VERBA_MENSAL", f"'Verba mensal {DETALHE_DA_CARGA}'"))
    return partes


def sufixo_da_planilha(codigo: str) -> str:
    return f" (planilha: {codigo})"


def proximo_codigo(tabela: str, codigo: str) -> str:
    """Próximo código livre do mesmo ano e tipo (26P001 já usado -> 26P007, se o maior é 26P006).
    Fica no formato AAXNNN, que o gerador de códigos do backend espera."""
    prefixo = codigo[:3]
    return (f"(SELECT '{prefixo}' || lpad((coalesce(max(substring(codigo from 4)::int), 0) + 1)::text, 3, '0') "
            f"FROM {tabela} WHERE codigo ~ '^{prefixo}[0-9]{{3}}$')")


def identidade(coluna: str, codigo: str, texto_do_registro: str) -> str:
    """Condição que acha o registro desta carga: o código da planilha com o mesmo texto, ou o texto com o sufixo."""
    com_sufixo = sql_texto(texto_do_registro + sufixo_da_planilha(codigo))
    return (f"(codigo = {sql_texto(codigo)} AND {coluna} = {sql_texto(texto_do_registro)}) "
            f"OR {coluna} = {com_sufixo}")


def insercao_do_contrato(c: ContratoDaCarga, codigo_sql: str, objeto: str) -> str:
    return (
        "  INSERT INTO contratos (id, codigo, contraparte, objeto, valor_centavos, periodicidade, data_inicio,\n"
        "                         situacao, data_alteracao)\n"
        f"  SELECT gen_random_uuid(), {codigo_sql}, {sql_texto(c.contraparte)}, {sql_texto(objeto)}, {c.valor_centavos},\n"
        f"         '{c.periodicidade}'::periodicidade_contrato, DATE '{c.data_inicio}', 'ATIVO'::situacao_contrato, now()\n"
    )


def insercao_do_projeto(p: ProjetoDaCarga, codigo_sql: str, nome: str) -> str:
    return (
        "  INSERT INTO projetos (id, codigo, nome, data_inicio, situacao, data_alteracao)\n"
        f"  SELECT gen_random_uuid(), {codigo_sql}, {sql_texto(nome)}, DATE '{p.data_inicio}',\n"
        "         'EM_EXECUCAO'::situacao_projeto, now()\n"
    )


def sql_dos_contratos_e_projetos(carga: Carga) -> list[str]:
    """Duas passadas: primeiro os códigos da planilha que estão livres; depois, os que colidiram com outro
    registro (ex.: os projetos fictícios 26P001-26P003) ganham o próximo código livre e o sufixo no texto.
    A ordem importa: assim o código novo nunca toma o lugar de um código que ainda vinha da planilha."""
    registros = [("contratos", "objeto", "CONTRATO", "Contrato", c.codigo, c.objeto,
                  lambda codigo_sql, texto_, c=c: insercao_do_contrato(c, codigo_sql, texto_))
                 for c in carga.contratos]
    registros += [("projetos", "nome", "PROJETO", "Projeto", p.codigo, p.nome,
                   lambda codigo_sql, texto_, p=p: insercao_do_projeto(p, codigo_sql, texto_))
                  for p in carga.projetos]
    livres, colididos = [], []
    for tabela, coluna, entidade, nome_da_entidade, codigo, texto_do_registro, insercao in registros:
        com_sufixo = sql_texto(texto_do_registro + sufixo_da_planilha(codigo))
        livres.append(com_trilha(
            insercao(sql_texto(codigo), texto_do_registro)
            + f"  WHERE NOT EXISTS (SELECT 1 FROM {tabela} WHERE codigo = {sql_texto(codigo)})\n"
            + f"    AND NOT EXISTS (SELECT 1 FROM {tabela} WHERE {coluna} = {com_sufixo})",
            entidade, f"'{nome_da_entidade} {codigo} incluído pela carga inicial (planilha).'"))
        mesmo_registro = f"codigo = {sql_texto(codigo)} AND {coluna} = {sql_texto(texto_do_registro)}"
        detalhe = (f"'{nome_da_entidade} ' || codigo || ' incluído pela carga inicial "
                   f"(na planilha: {codigo}, código já usado).'")
        colididos.append(com_trilha(
            insercao(proximo_codigo(tabela, codigo), texto_do_registro + sufixo_da_planilha(codigo))
            + f"  WHERE NOT EXISTS (SELECT 1 FROM {tabela} WHERE {mesmo_registro})\n"
            + f"    AND NOT EXISTS (SELECT 1 FROM {tabela} WHERE {coluna} = {com_sufixo})",
            entidade, detalhe, retorno="id, codigo"))
    return livres + colididos


def descricao_para_gravar(l: Lancamento) -> str:
    """A descrição da planilha; vazia, a entrada leva o nome da categoria e a saída, o rótulo neutro."""
    if l.descricao:
        return l.descricao
    return l.categoria if l.tipo == "ENTRADA" else descricao_neutra(l.rotulo, l.categoria)


def vinculos(l: Lancamento, carga: Carga) -> tuple[str, str, str]:
    """(contrato_id, projeto_id, centro_custo_id) como subconsultas SQL; no máximo um preenchido."""
    nulo = "NULL"
    r = l.rotulo
    if r.tipo == "CONTRATO":
        c = next(c for c in carga.contratos if c.codigo == r.codigo)
        return (f"(SELECT id FROM contratos WHERE {identidade('objeto', c.codigo, c.objeto)} "
                "ORDER BY data_criacao LIMIT 1)", nulo, nulo)
    if r.tipo == "PROJETO":
        p = next(p for p in carga.projetos if p.codigo == r.codigo)
        return (nulo, f"(SELECT id FROM projetos WHERE {identidade('nome', p.codigo, p.nome)} "
                      "ORDER BY data_criacao LIMIT 1)", nulo)
    if r.tipo == "CENTRO":
        return nulo, nulo, f"(SELECT id FROM centros_custo WHERE nome = {sql_texto(nome_do_rotulo(r))})"
    return nulo, nulo, nulo


def sql_da_movimentacao(l: Lancamento, carga: Carga, anonimizado: bool) -> str:
    """Só entra se o marco do mês ainda não está na trilha: reaplicar o arquivo não duplica nada."""
    contrato, projeto, centro = vinculos(l, carga)
    marco = sql_texto(marco_do_mes(l.data[:7]))
    # Na anonimizada, o comentário não aponta a linha da planilha.
    comentario = f"-- {l.data}\n" if anonimizado else f"-- {l.aba}, linha {l.linha}\n"
    categoria = (f"(SELECT id FROM categorias WHERE ativo AND nome = {sql_texto(l.categoria)} "
                 f"AND tipo IN ('{l.tipo}', 'AMBOS') LIMIT 1)")
    return comentario + com_trilha(
        "  INSERT INTO movimentacoes (id, conta_id, tipo, valor_centavos, data, categoria_id, forma_pagamento, origem,\n"
        "                             descricao, contrato_id, projeto_id, centro_custo_id, data_alteracao)\n"
        "  SELECT gen_random_uuid(),\n"
        f"         (SELECT id FROM contas WHERE nome = {sql_texto(NOME_DA_CONTA[l.conta])}),\n"
        f"         '{l.tipo}'::tipo_movimentacao, {l.valor_centavos}, DATE '{l.data}',\n"
        f"         {categoria},\n"
        "         'TRANSFERENCIA'::forma_pagamento, 'MANUAL'::origem_movimentacao,\n"
        f"         {sql_texto(descricao_para_gravar(l))},\n"
        f"         {contrato}, {projeto}, {centro}, now()\n"
        f"  WHERE NOT EXISTS (SELECT 1 FROM registros_auditoria WHERE entidade = 'CARGA' AND registro_id = {marco})",
        "MOVIMENTACAO", f"'Movimentação {DETALHE_DA_CARGA}'")


def sql_dos_marcos(carga: Carga) -> list[str]:
    partes = []
    for mes in sorted({l.data[:7] for l in carga.lancamentos}):
        marco = sql_texto(marco_do_mes(mes))
        partes.append(
            "INSERT INTO registros_auditoria (id, usuario_id, operacao, entidade, registro_id, detalhe)\n"
            f"SELECT gen_random_uuid(), NULL, 'INCLUSAO', 'CARGA', {marco}, "
            f"'Movimentações de {mes} incluídas pela carga inicial.'\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM registros_auditoria WHERE entidade = 'CARGA' AND registro_id = {marco});\n"
        )
    return partes


def gerar_sql(carga: Carga, anonimizado: bool = False) -> str:
    if anonimizado:
        partes = [
            "-- Carga ANONIMIZADA das movimentações, gerada por scripts/carga-inicial/carregar_movimentacoes.py --anonimizar.",
            "-- DADOS ANONIMIZADOS para a homologação ([Padrões.NF001]): descrições neutras, folha das funcionárias",
            "-- somada por mês e contraparte de pessoa trocada. Valores, datas e categorias são os da planilha.",
        ]
    else:
        partes = [
            "-- Carga inicial das movimentações, gerada por scripts/carga-inicial/carregar_movimentacoes.py.",
            "-- CONTÉM DADOS REAIS (LGPD): não versionar, não enviar, não usar em ambiente exposto.",
        ]
    partes += [
        "-- Pode rodar de novo: cadastros que já existem são pulados, e as movimentações de um mês só entram",
        "-- se o marco do mês ainda não está na trilha (lançamento acrescentado depois num mês já carregado NÃO entra).",
        "BEGIN;",
        "",
    ]
    partes += sql_das_categorias(carga)
    partes += sql_das_contas(carga)
    partes += sql_dos_centros_e_verbas(carga)
    partes += sql_dos_contratos_e_projetos(carga)
    partes += [sql_da_movimentacao(l, carga, anonimizado) for l in carga.lancamentos]
    partes += sql_dos_marcos(carga)
    partes.append("COMMIT;")
    return "\n".join(partes) + "\n"


def totais_por_mes(carga: Carga) -> dict[str, dict[int, int]]:
    totais: dict[str, dict[int, int]] = {"entradas": {}, "saidas": {}, "rendimentos": {}}
    for l in carga.lancamentos:
        if int(l.data[:4]) != carga.ano:
            continue
        if l.conta == "APLICACAO":
            chave = "rendimentos"
        else:
            chave = "entradas" if l.tipo == "ENTRADA" else "saidas"
        mes = int(l.data[5:7])
        totais[chave][mes] = totais[chave].get(mes, 0) + l.valor_centavos
    return totais


def conferencia(carga: Carga) -> list[str]:
    """Uma linha por mês: o que a carga leva x o Resumo Mensal da planilha."""
    nomes = {"entradas": "entradas", "saidas": "saídas", "rendimentos": "rendimentos"}
    totais = totais_por_mes(carga)
    linhas = []
    for mes in range(1, 13):
        if not any(totais[chave].get(mes) or carga.resumo[chave].get(mes) for chave in nomes):
            continue
        partes = []
        for chave, nome in nomes.items():
            da_carga, do_resumo = totais[chave].get(mes, 0), carga.resumo[chave].get(mes, 0)
            if da_carga == do_resumo:
                partes.append(f"{nome} confere ({reais(da_carga)})")
            else:
                partes.append(f"{nome} difere em {reais(abs(da_carga - do_resumo))} "
                              f"(carga {reais(da_carga)}, resumo {reais(do_resumo)})")
        linhas.append(f"{MESES[mes - 1]}: " + "; ".join(partes))
    return linhas


def gravar_pendencias(caminho: Path, pendencias) -> None:
    # Ponto e vírgula e BOM: o Excel em português abre o arquivo direto, com acentos.
    with caminho.open("w", encoding="utf-8-sig", newline="") as arquivo:
        escritor = csv.writer(arquivo, delimiter=";")
        escritor.writerow(["aba", "linha", "campo", "valor na planilha", "problema", "o que a carga fez"])
        escritor.writerows(pendencias)


def resumir(carga: Carga) -> None:
    """Só totais: nada de descrição, contraparte ou nome no terminal."""
    grupos: dict[tuple[str, str], list[int]] = {}
    for l in carga.lancamentos:
        grupos.setdefault((l.tipo, l.conta), []).append(l.valor_centavos)
    for (tipo, conta), valores in sorted(grupos.items()):
        print(f"{tipo:7s} {NOME_DA_CONTA[conta]}: {len(valores)} lançamentos, {reais(sum(valores))}")
    print(f"Saldos iniciais: corrente {reais(carga.saldo_corrente)}, investimentos {reais(carga.saldo_aplicacao)}")
    print(f"Categorias: {len(tipos_das_categorias(carga))}; centros de custo: {len(carga.centros)}; "
          f"verbas: {len(carga.verbas)}; contratos: {len(carga.contratos)}; projetos: {len(carga.projetos)}")
    print("\nConferência com o Resumo Mensal:")
    for linha in conferencia(carga):
        print("  " + linha)


def resumir_pendencias(pendencias) -> None:
    """Contagem por problema. O texto do problema é fixo no código: não leva dado da planilha."""
    print(f"\nPendências: {len(pendencias)}")
    for problema, quantidade in Counter(p[4] for p in pendencias).most_common():
        print(f"  {quantidade:4d}  {problema}")


def gravar_carga_anonimizada(carga: Carga) -> None:
    """SQL com as trocas de anonimizar_movimentacoes, gravado só se a trava não achar texto pessoal nele.
    O relatório de pendências não é gravado: ele tem os textos da planilha."""
    anonima = anonimizar_movimentacoes.anonimizar(carga)
    sql = gerar_sql(anonima, anonimizado=True)
    achados = anonimizar_movimentacoes.textos_pessoais_no_sql(sql, carga, anonima)
    if any(achados.values()):
        campos = ", ".join(f"{campo}: {n}" for campo, n in achados.items() if n)
        sys.exit(f"PARADO: o SQL anonimizado ainda tem textos da planilha ({campos}). Nada foi gravado.")

    arquivo_sql = PASTA_DE_SAIDA / "movimentacoes-anonimizada.sql"
    arquivo_sql.write_text(sql, encoding="utf-8")
    resumir(anonima)
    print(f"\nPendências da planilha: {len(carga.pendencias)} (o relatório não é gravado no modo anonimizado; "
          "rode sem --anonimizar para vê-lo)")
    unicos = anonimizar_movimentacoes.meses_com_um_pagamento_de_funcionaria(carga)
    if unicos:
        print(f"ATENÇÃO: {len(unicos)} mês(es) com um só pagamento de funcionária ({', '.join(unicos)}): "
              "nesses meses a folha somada mostra o próprio pagamento.")
    print("\nCarga ANONIMIZADA: descrições neutras, folha somada por mês e contraparte de pessoa trocada.")
    print(f"Gerado (fora do git): {arquivo_sql.relative_to(RAIZ)}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Gera o SQL da carga das movimentações a partir da planilha do Fundo.")
    parser.add_argument("--planilha", type=Path, default=PLANILHA_PADRAO, help="caminho do .xlsx")
    parser.add_argument("--anonimizar", action="store_true",
                        help="gera dados/movimentacoes-anonimizada.sql, sem dado pessoal, para a homologação")
    argumentos = parser.parse_args()
    if not argumentos.planilha.exists():
        sys.exit(f"Planilha não encontrada: {argumentos.planilha}. Ela fica em data/, fora do git: peça à equipe.")

    carga = ler_planilha(argumentos.planilha)
    PASTA_DE_SAIDA.mkdir(exist_ok=True)
    if argumentos.anonimizar:
        gravar_carga_anonimizada(carga)
        return

    arquivo_sql = PASTA_DE_SAIDA / "movimentacoes.sql"
    arquivo_pendencias = PASTA_DE_SAIDA / "pendencias-movimentacoes.csv"
    arquivo_sql.write_text(gerar_sql(carga), encoding="utf-8")
    gravar_pendencias(arquivo_pendencias, carga.pendencias)
    resumir(carga)
    resumir_pendencias(carga.pendencias)
    print(f"\nGerados (fora do git, COM DADOS REAIS): {arquivo_sql.relative_to(RAIZ)} e "
          f"{arquivo_pendencias.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()

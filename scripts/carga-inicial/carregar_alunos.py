"""Carga inicial dos alunos e dos débitos deles: planilha do H8 -> SQL ([Distribuição.NF002]).

Lê a aba H8 de data/SIRLEYDE NOVA.xlsx, normaliza cada linha com as regras de
regras.py e grava, na pasta dados/ (fora do git, LGPD):

- carga.sql: turmas, vagas de alojamento, alunos e, para cada mês "NÃO PAGO", uma
  cobrança herdada (ADR-0005), numa transação só, cada inclusão com o seu registro
  na trilha de auditoria;
- pendencias-alunos.csv: o que a carga não conseguiu aproveitar, linha a linha,
  para a área administrativa conferir e digitar à mão.

O script não fala com o banco: o SQL é aplicado depois, com o Prisma (ver README.md).
No terminal só aparecem totais, nunca nomes ou CPFs.

Com --anonimizar, grava só dados/carga-anonimizada.sql, para a homologação ([Padrões.NF001]):
alunos fictícios com a mesma "cara" da planilha (ver anonimizar.py). Se algum dado real
sobrar no SQL, o script para sem gravar nada.

Uso, na raiz do repositório:
    python scripts/carga-inicial/carregar_alunos.py
    python scripts/carga-inicial/carregar_alunos.py --anonimizar --hoje AAAA-MM-DD
"""

import argparse
import csv
import datetime
import random
import sys
import warnings
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

import anonimizar
import regras

PASTA_DO_SCRIPT = Path(__file__).resolve().parent
RAIZ = PASTA_DO_SCRIPT.parent.parent
PLANILHA_PADRAO = RAIZ / "data" / "SIRLEYDE NOVA.xlsx"
PASTA_DE_SAIDA = PASTA_DO_SCRIPT / "dados"
ABA = "H8"

# Colunas usadas, com o nome do cabeçalho da planilha. DEVENDO (quantos meses o aluno deve)
# serve só para conferir a contagem dos meses "NÃO PAGO". STATUS, BOLETO e NEG ficam de fora.
COLUNAS = ["SITUAC", "POSTO", "CURSO", "CELULAR", "ALOJ", "APTO", "VAGA",
           "MATRIC", "CPF", "ALUNOS", "TURMA", "EMAIL", "APELIDO", "DEVENDO"]


@dataclass
class MesDaPlanilha:
    """Um mês do Fundo de Manutenção: três colunas (VALOR, DATA, SITUAÇÃO) por aluno."""
    coluna_situacao: int
    rotulo: str  # como a planilha chama: "setembro/2026"
    descricao: str  # "Mensalidade de outubro/2026 (planilha: setembro/2026)": ver regras.descricao_do_debito
    vencimento: str  # "AAAA-MM-DD", da linha de cima da planilha
    valor_centavos: int  # valor do mês, da linha de cima: a célula do aluno em aberto fica vazia


@dataclass
class Debito:
    """Um mês em aberto, que vira cobrança HERDADA (ADR-0005)."""
    referencia: str  # "AAAA-MM" do vencimento, como na geração recorrente
    descricao: str
    vencimento: str
    valor_centavos: int


@dataclass
class Aluno:
    linha: int  # linha no Excel, para achar o aluno na planilha
    nome: str
    cpf: str
    email: str  # "" quando a planilha não tem um e-mail válido (cadastro incompleto)
    celular: str | None
    apelido: str | None
    matricula: int | None
    turma: str | None
    curso: str | None
    posto: str | None
    alojamento: tuple[str, str, str] | None
    ativo: bool
    debitos: list[Debito] = field(default_factory=list)


@dataclass
class Planilha:
    meses: list[MesDaPlanilha]
    # (número da linha no Excel, {coluna: valor}, situação de cada mês, na ordem de `meses`)
    linhas: list[tuple[int, dict, list]]


@dataclass
class Resultado:
    alunos: list[Aluno] = field(default_factory=list)
    # Cada pendência: (linha, campo, valor original, problema, o que a carga fez)
    pendencias: list[tuple[int, str, str, str, str]] = field(default_factory=list)
    linhas_vazias: int = 0

    def anotar(self, linha: int, campo: str, valor, problema: str, feito: str) -> None:
        original = "" if valor is None else str(valor)
        self.pendencias.append((linha, campo, original, problema, feito))


# ---------------------------------------------------------------------------
# Leitura da planilha
# ---------------------------------------------------------------------------


def ler_planilha(caminho: Path) -> Planilha:
    # O openpyxl avisa de células com data impossível em outras colunas; não usamos essas colunas.
    warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")
    planilha = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    linhas = planilha[ABA].iter_rows(values_only=True)

    # O cabeçalho não está na primeira linha: procuramos a linha que tem STATUS e CPF.
    # As linhas de cima guardam o nome, o valor e o vencimento de cada mês.
    acima: list[tuple] = []
    cabecalho = None
    numero = 0
    for numero, valores in enumerate(linhas, start=1):
        textos = [str(v).strip() if v is not None else "" for v in valores]
        if "STATUS" in textos and "CPF" in textos:
            cabecalho = textos
            break
        acima.append(valores)
    if cabecalho is None:
        sys.exit(f"Não achei o cabeçalho (STATUS, CPF...) na aba {ABA}.")
    faltando = [nome for nome in COLUNAS if nome not in cabecalho]
    if faltando:
        sys.exit(f"A aba {ABA} não tem as colunas {faltando}. A planilha mudou de formato?")
    indices = {nome: cabecalho.index(nome) for nome in COLUNAS}
    meses = ler_meses(cabecalho, acima)

    dados = []
    for numero, valores in enumerate(linhas, start=numero + 1):
        def celula(i: int):
            return valores[i] if i < len(valores) else None
        dados.append((numero, {nome: celula(i) for nome, i in indices.items()},
                      [celula(mes.coluna_situacao) for mes in meses]))
    return Planilha(meses=meses, linhas=dados)


def ler_meses(cabecalho: list[str], acima: list[tuple]) -> list[MesDaPlanilha]:
    """Cada mês ocupa três colunas: VALOR, DATA e SITUAÇÃO. Nas linhas de cima ficam o nome do
    mês (na coluna VALOR), o valor do mês (VALOR) e o vencimento (DATA)."""
    meses = []
    for c in range(len(cabecalho) - 2):
        if cabecalho[c] != "VALOR" or cabecalho[c + 1] != "DATA":
            continue
        if not regras.sem_acento(cabecalho[c + 2]).upper().startswith("SITUA"):
            continue
        rotulo = None
        for linha in acima:
            try:
                rotulo = regras.mes_da_planilha(linha[c] if c < len(linha) else None)
                break
            except regras.ValorInvalido:
                continue
        valores = next((linha for linha in acima
                        if c + 1 < len(linha) and isinstance(linha[c + 1], datetime.datetime)), None)
        if rotulo is None or valores is None:
            sys.exit(f"O mês da coluna {c + 1} não tem nome ou vencimento nas linhas de cima. A planilha mudou de formato?")
        try:
            valor = regras.centavos(valores[c])
        except regras.ValorInvalido as erro:
            sys.exit(f"O mês da coluna {c + 1} tem um valor que não dá para ler: {erro}.")
        ano, mes = rotulo
        vencimento = valores[c + 1].date().isoformat()
        meses.append(MesDaPlanilha(
            coluna_situacao=c + 2,
            rotulo=f"{regras.NOMES_DOS_MESES[mes - 1]}/{ano}",
            descricao=regras.descricao_do_debito(vencimento[:7], ano, mes),
            vencimento=vencimento,
            valor_centavos=valor,
        ))
    if not meses:
        sys.exit(f"Não achei as colunas dos meses (VALOR, DATA, SITUAÇÃO) na aba {ABA}.")
    return meses


# ---------------------------------------------------------------------------
# Normalização
# ---------------------------------------------------------------------------


def campo_opcional(resultado: Resultado, linha: int, campo: str, regra, valor):
    """Aplica a regra; se o valor não serve, anota a pendência e deixa o campo vazio."""
    try:
        return regra(valor)
    except regras.ValorInvalido as erro:
        resultado.anotar(linha, campo, valor, str(erro), "campo deixado em branco")
        return None


def normalizar(planilha: Planilha, hoje: str) -> Resultado:
    resultado = Resultado()
    for linha, valores, situacoes in planilha.linhas:
        nome_bruto, cpf_bruto = valores["ALUNOS"], valores["CPF"]
        if regras.texto(nome_bruto) is None and regras.texto(cpf_bruto) is None:
            # Linha toda em branco (o Excel guarda muitas no fim da aba): ignorada.
            # Linha com alguma coisa mas sem aluno: em geral, uma vaga desocupada.
            if any(regras.texto(v) is not None for v in valores.values()):
                resultado.linhas_vazias += 1
            continue

        # Sem nome ou sem CPF não há como cadastrar: a linha inteira vira pendência.
        try:
            nome = regras.nome(nome_bruto)
            cpf = regras.cpf(cpf_bruto)
        except regras.ValorInvalido as erro:
            resultado.anotar(linha, "ALUNOS/CPF", "", str(erro), "aluno NÃO carregado")
            continue

        if not regras.cpf_valido(cpf):
            resultado.anotar(linha, "CPF", cpf_bruto, "CPF com dígitos verificadores errados",
                             "carregado como cadastro incompleto (não recebe cobrança)")

        email = regras.email(valores["EMAIL"])
        if email is None:
            resultado.anotar(linha, "EMAIL", valores["EMAIL"], "e-mail vazio ou fora do formato",
                             "carregado como cadastro incompleto (não recebe cobrança)")

        # O alojamento usa três colunas, por isso não passa por campo_opcional.
        try:
            vaga = regras.alojamento(valores["ALOJ"], valores["APTO"], valores["VAGA"])
        except regras.ValorInvalido as erro:
            original = f'{valores["ALOJ"]} {valores["APTO"]} {valores["VAGA"]}'
            resultado.anotar(linha, "ALOJ/APTO/VAGA", original, str(erro), "campo deixado em branco")
            vaga = None

        resultado.alunos.append(Aluno(
            linha=linha,
            nome=nome,
            cpf=cpf,
            email=email or "",
            celular=campo_opcional(resultado, linha, "CELULAR", regras.celular, valores["CELULAR"]),
            apelido=campo_opcional(resultado, linha, "APELIDO", regras.apelido, valores["APELIDO"]),
            matricula=campo_opcional(resultado, linha, "MATRIC", regras.matricula, valores["MATRIC"]),
            turma=campo_opcional(resultado, linha, "TURMA", regras.turma, valores["TURMA"]),
            curso=campo_opcional(resultado, linha, "CURSO", regras.curso, valores["CURSO"]),
            posto=campo_opcional(resultado, linha, "POSTO", regras.posto, valores["POSTO"]),
            alojamento=vaga,
            ativo=regras.ativo(valores["SITUAC"]),
            debitos=ler_debitos(resultado, linha, planilha.meses, situacoes, valores["DEVENDO"], hoje),
        ))

    resolver_repeticoes(resultado)
    return resultado


def ler_debitos(
    resultado: Resultado, linha: int, meses: list[MesDaPlanilha], situacoes: list, devendo, hoje: str
) -> list[Debito]:
    """Cada mês "NÃO PAGO" já vencido vira um débito. Situação que não dá para ler vira pendência.

    Mês "NÃO PAGO" que ainda não venceu não vira herdada: ele pode ser cobrado pelo Asaas (a herdada
    existe só porque o Asaas não aceita vencimento no passado, ADR-0005), e uma herdada com a
    referência do mês faria a geração recorrente pular o aluno, que ficaria sem boleto.
    """
    debitos: list[Debito] = []
    referencias: set[str] = set()
    a_vencer = 0
    for mes, situacao in zip(meses, situacoes):
        try:
            em_aberto = regras.mes_em_aberto(situacao)
        except regras.ValorInvalido as erro:
            resultado.anotar(linha, f"SITUAÇÃO de {mes.rotulo}", situacao, str(erro),
                             "débito do mês NÃO carregado: confira na planilha")
            continue
        if not em_aberto:
            continue
        if mes.vencimento >= hoje:
            a_vencer += 1
            resultado.anotar(linha, f"SITUAÇÃO de {mes.rotulo}", situacao,
                             f"mês ainda não venceu (vence em {mes.vencimento})",
                             "NÃO carregado como herdada: cobre pela geração do sistema")
            continue
        referencia = mes.vencimento[:7]
        if referencia in referencias:
            resultado.anotar(linha, f"SITUAÇÃO de {mes.rotulo}", situacao,
                             f"dois meses da planilha vencem em {referencia}", "só o primeiro foi carregado")
            continue
        referencias.add(referencia)
        debitos.append(Debito(referencia=referencia, descricao=mes.descricao,
                              vencimento=mes.vencimento, valor_centavos=mes.valor_centavos))

    # Conferência com a coluna DEVENDO, que a planilha calcula.
    if isinstance(devendo, (int, float)) and int(devendo) != len(debitos) + a_vencer:
        resultado.anotar(linha, "DEVENDO", devendo,
                         f"a planilha diz {int(devendo)} meses em aberto; a carga achou {len(debitos) + a_vencer}",
                         f"carregados os {len(debitos)} meses vencidos encontrados")
    return debitos


def resolver_repeticoes(resultado: Resultado) -> None:
    """O banco recusa repetições; a primeira linha da planilha fica, as outras viram pendência.

    - CPF: o SQL só insere aluno cujo CPF ainda não existe. O repetido não é carregado
      (nem os débitos dele).
    - Matrícula: única entre todos os alunos. A repetida fica em branco.
    - Vaga: no máximo um aluno ativo por vaga. A repetida fica em branco.
    """
    cpfs: dict[str, int] = {}
    matriculas: dict[int, int] = {}
    vagas_ocupadas: dict[tuple[str, str, str], int] = {}
    mantidos = []
    for aluno in resultado.alunos:
        if aluno.cpf in cpfs:
            resultado.anotar(aluno.linha, "CPF", aluno.cpf,
                             f"CPF repetido (já está na linha {cpfs[aluno.cpf]})",
                             "aluno NÃO carregado")
            continue
        cpfs[aluno.cpf] = aluno.linha

        if aluno.matricula is not None:
            if aluno.matricula in matriculas:
                resultado.anotar(aluno.linha, "MATRIC", aluno.matricula,
                                 f"matrícula repetida (já está na linha {matriculas[aluno.matricula]})",
                                 "campo deixado em branco")
                aluno.matricula = None
            else:
                matriculas[aluno.matricula] = aluno.linha

        if aluno.ativo and aluno.alojamento is not None:
            if aluno.alojamento in vagas_ocupadas:
                resultado.anotar(aluno.linha, "ALOJ/APTO/VAGA", " ".join(aluno.alojamento),
                                 f"vaga já ocupada pelo aluno ativo da linha {vagas_ocupadas[aluno.alojamento]}",
                                 "campo deixado em branco")
                aluno.alojamento = None
            else:
                vagas_ocupadas[aluno.alojamento] = aluno.linha

        mantidos.append(aluno)
    resultado.alunos = mantidos


# ---------------------------------------------------------------------------
# Saída: SQL e relatório de pendências
# ---------------------------------------------------------------------------


def sql_texto(valor) -> str:
    """Valor como literal SQL. Aspas simples são dobradas: O'Neil -> 'O''Neil'."""
    if valor is None:
        return "NULL"
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if isinstance(valor, int):
        return str(valor)
    return "'" + str(valor).replace("'", "''") + "'"


def sql_do_aluno(a: Aluno, anonimizado: bool = False) -> str:
    """Insere se o CPF ainda não existe e, no mesmo comando, grava a inclusão na trilha
    (usuario_id nulo = rotina automática, como no backend).

    Na carga anonimizada o comentário não leva a linha da planilha: ela ligaria o aluno
    fictício à pessoa real."""
    turma_id = "NULL" if a.turma is None else f"(SELECT id FROM turmas WHERE nome = {sql_texto(a.turma)})"
    if a.alojamento is None:
        alojamento_id = "NULL"
    else:
        b, ap, v = (sql_texto(parte) for parte in a.alojamento)
        # Vaga já ocupada por um aluno ativo que estava no banco: fica em branco (como na planilha).
        ocupada = "" if not a.ativo else " AND NOT EXISTS (SELECT 1 FROM alunos o WHERE o.alojamento_id = al.id AND o.ativo)"
        alojamento_id = f"(SELECT al.id FROM alojamentos al WHERE al.bloco = {b} AND al.apto = {ap} AND al.vaga = {v}{ocupada})"
    # Matrícula já usada por outro aluno do banco: fica em branco.
    matricula = "NULL" if a.matricula is None else (
        f"(SELECT {a.matricula} WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE matricula = {a.matricula}))"
    )
    posto = "NULL" if a.posto is None else f"{sql_texto(a.posto)}::posto_aluno"
    curso = "NULL" if a.curso is None else f"{sql_texto(a.curso)}::curso_aluno"
    comentario = "-- aluno fictício\n" if anonimizado else f"-- linha {a.linha}\n"
    return (
        comentario
        + "WITH novo AS (\n"
        "  INSERT INTO alunos (id, nome, cpf, email, matricula, posto, curso, turma_id, celular, apelido,\n"
        "                      alojamento_id, ativo, data_alteracao)\n"
        f"  SELECT gen_random_uuid(), {sql_texto(a.nome)}, {sql_texto(a.cpf)}, {sql_texto(a.email)},\n"
        f"         {matricula}, {posto}, {curso}, {turma_id},\n"
        f"         {sql_texto(a.celular)}, {sql_texto(a.apelido)}, {alojamento_id}, {sql_texto(a.ativo)}, now()\n"
        f"  WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE cpf = {sql_texto(a.cpf)})\n"
        "  RETURNING id\n"
        ")\n"
        # Sem o nome no detalhe (LGPD): a trilha não pode ser apagada, e o registro_id já
        # identifica o aluno. Mesma regra do backend (B14).
        "INSERT INTO registros_auditoria (id, usuario_id, operacao, entidade, registro_id, detalhe)\n"
        "SELECT gen_random_uuid(), NULL, 'INCLUSAO', 'ALUNO', id::text,\n"
        "       'Aluno incluído pela carga inicial.'\n"
        "FROM novo;\n"
    )


def sql_do_debito(a: Aluno, d: Debito, anonimizado: bool = False) -> str:
    """Cobrança HERDADA (ADR-0005): aberta, sem id do Asaas, multa e juros zerados. O mês de
    referência é único por aluno: rodar de novo não duplica (ON CONFLICT)."""
    comentario = f"-- {d.descricao}\n" if anonimizado else f"-- linha {a.linha}, {d.descricao}\n"
    return (
        comentario
        + "WITH nova AS (\n"
        "  INSERT INTO cobrancas (id, aluno_id, origem, referencia, descricao, valor_centavos, vencimento,\n"
        "                         multa_percentual, juros_mensal_percentual, data_alteracao)\n"
        f"  SELECT gen_random_uuid(), id, 'HERDADA', {sql_texto(d.referencia)}, {sql_texto(d.descricao)},\n"
        f"         {d.valor_centavos}, DATE {sql_texto(d.vencimento)}, 0, 0, now()\n"
        f"  FROM alunos WHERE cpf = {sql_texto(a.cpf)} ORDER BY ativo DESC, data_criacao LIMIT 1\n"
        "  ON CONFLICT (aluno_id, referencia) DO NOTHING\n"
        "  RETURNING id, descricao\n"
        ")\n"
        "INSERT INTO registros_auditoria (id, usuario_id, operacao, entidade, registro_id, detalhe)\n"
        "SELECT gen_random_uuid(), NULL, 'INCLUSAO', 'COBRANCA', id::text,\n"
        "       'Cobrança \"' || descricao || '\" herdada da planilha pela carga inicial (não existe no Asaas).'\n"
        "FROM nova;\n"
    )


def gerar_sql(alunos: list[Aluno], anonimizado: bool = False) -> str:
    if anonimizado:
        partes = [
            "-- Carga ANONIMIZADA dos alunos e dos débitos, gerada por scripts/carga-inicial/carregar_alunos.py --anonimizar.",
            "-- DADOS ANONIMIZADOS para a homologação ([Padrões.NF001]): nenhum aluno real. Nomes, CPFs, e-mails e",
            "-- matrículas são fictícios; débitos e vagas foram embaralhados entre os alunos.",
            "-- Pode rodar de novo este mesmo arquivo sem duplicar. Outra geração cria alunos novos: não aplique as duas.",
        ]
    else:
        partes = [
            "-- Carga inicial dos alunos e dos débitos deles, gerada por scripts/carga-inicial/carregar_alunos.py.",
            "-- CONTÉM DADOS REAIS (LGPD): não versionar, não enviar, não usar em ambiente exposto.",
            "-- Pode rodar de novo: turma, vaga, aluno (pelo CPF) e débito (aluno + mês) que já existem não são duplicados.",
        ]
    partes += ["BEGIN;", ""]

    turmas = sorted({a.turma for a in alunos if a.turma is not None})
    if turmas:
        valores = ",\n  ".join(f"(gen_random_uuid(), {sql_texto(t)}, now())" for t in turmas)
        partes += [f"INSERT INTO turmas (id, nome, data_alteracao) VALUES\n  {valores}\nON CONFLICT (nome) DO NOTHING;", ""]

    vagas = sorted({a.alojamento for a in alunos if a.alojamento is not None})
    if vagas:
        valores = ",\n  ".join(
            f"(gen_random_uuid(), {sql_texto(b)}, {sql_texto(ap)}, {sql_texto(v)}, now())" for b, ap, v in vagas
        )
        partes += [
            f"INSERT INTO alojamentos (id, bloco, apto, vaga, data_alteracao) VALUES\n  {valores}\n"
            "ON CONFLICT (bloco, apto, vaga) DO NOTHING;",
            "",
        ]

    partes += [sql_do_aluno(a, anonimizado) for a in alunos]
    partes += [sql_do_debito(a, d, anonimizado) for a in alunos for d in a.debitos]
    partes.append("COMMIT;")
    return "\n".join(partes) + "\n"


def gravar_pendencias(caminho: Path, pendencias) -> None:
    # Ponto e vírgula e BOM: o Excel em português abre o arquivo direto, com acentos.
    with caminho.open("w", encoding="utf-8-sig", newline="") as arquivo:
        escritor = csv.writer(arquivo, delimiter=";")
        escritor.writerow(["linha da planilha", "campo", "valor na planilha", "problema", "o que a carga fez"])
        escritor.writerows(sorted(pendencias))


def reais(centavos: int) -> str:
    """131760 -> 'R$ 1.317,60', só com inteiros."""
    milhares = f"{centavos // 100:,}".replace(",", ".")
    return f"R$ {milhares},{centavos % 100:02d}"


def resumir(resultado: Resultado, meses: list[MesDaPlanilha]) -> None:
    alunos = resultado.alunos
    ativos = sum(1 for a in alunos if a.ativo)
    incompletos = sum(1 for a in alunos if a.email == "" or not regras.cpf_valido(a.cpf))
    nao_carregados = sum(1 for p in resultado.pendencias if p[4] == "aluno NÃO carregado")
    por_campo = Counter(p[1].split(" de ")[0] for p in resultado.pendencias)
    debitos = [d for a in alunos for d in a.debitos]
    print(f"Alunos para carregar: {len(alunos)} ({ativos} ativos, {len(alunos) - ativos} inativos)")
    print(f"  cadastros incompletos (sem e-mail válido ou CPF inválido): {incompletos}")
    print(f"  com turma: {sum(1 for a in alunos if a.turma)}, com curso: {sum(1 for a in alunos if a.curso)}, "
          f"com posto: {sum(1 for a in alunos if a.posto)}, com vaga: {sum(1 for a in alunos if a.alojamento)}")
    print(f"Linhas da planilha sem aluno (vaga vazia): {resultado.linhas_vazias}")
    print(f"Linhas NÃO carregadas: {nao_carregados}")
    print(f"Meses lidos da planilha: {len(meses)} ({meses[-1].rotulo} a {meses[0].rotulo})")
    print(f"Débitos herdados (meses NÃO PAGO): {len(debitos)} de {sum(1 for a in alunos if a.debitos)} alunos, "
          f"total {reais(sum(d.valor_centavos for d in debitos))}")
    print(f"Pendências para conferir: {len(resultado.pendencias)}"
          + ("" if not por_campo else " (" + ", ".join(f"{c}: {n}" for c, n in sorted(por_campo.items())) + ")"))


def gravar_carga_anonimizada(resultado: Resultado, meses: list[MesDaPlanilha]) -> None:
    """Gera o SQL com alunos fictícios e só grava se a trava não achar nenhum dado real nele.
    O relatório de pendências não é gravado: ele tem os valores da planilha."""
    # Semente nova a cada execução: não dá para refazer o sorteio a partir do código.
    anonimos = anonimizar.anonimizar(resultado.alunos, random.Random())
    sql = gerar_sql(anonimos, anonimizado=True)
    achados = anonimizar.dados_reais_no_sql(sql, resultado.alunos)
    if any(achados.values()):
        campos = ", ".join(f"{campo}: {n}" for campo, n in achados.items() if n)
        sys.exit(f"PARADO: o SQL anonimizado ainda tem dados reais ({campos}). Nada foi gravado.")

    arquivo_sql = PASTA_DE_SAIDA / "carga-anonimizada.sql"
    arquivo_sql.write_text(sql, encoding="utf-8")
    resumir(Resultado(alunos=anonimos, pendencias=resultado.pendencias, linhas_vazias=resultado.linhas_vazias), meses)
    print("\nCarga ANONIMIZADA: nenhum nome, CPF, e-mail, celular, apelido ou matrícula real no SQL.")
    print(f"Gerado (fora do git): {arquivo_sql.relative_to(RAIZ)}. Aplique sempre este mesmo arquivo: "
          "outra geração cria alunos novos.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera o SQL da carga inicial dos alunos a partir da planilha do H8.")
    parser.add_argument("--planilha", type=Path, default=PLANILHA_PADRAO, help="caminho do .xlsx")
    parser.add_argument("--hoje", default=datetime.date.today().isoformat(),
                        help="data da carga (AAAA-MM-DD); mês que vence a partir dela não vira herdada")
    parser.add_argument("--anonimizar", action="store_true",
                        help="gera dados/carga-anonimizada.sql, com alunos fictícios, para a homologação")
    argumentos = parser.parse_args()
    if not argumentos.planilha.exists():
        sys.exit(f"Planilha não encontrada: {argumentos.planilha}. Ela fica em data/, fora do git: peça à equipe.")

    planilha = ler_planilha(argumentos.planilha)
    resultado = normalizar(planilha, argumentos.hoje)

    PASTA_DE_SAIDA.mkdir(exist_ok=True)
    if argumentos.anonimizar:
        gravar_carga_anonimizada(resultado, planilha.meses)
        return
    arquivo_sql = PASTA_DE_SAIDA / "carga.sql"
    arquivo_pendencias = PASTA_DE_SAIDA / "pendencias-alunos.csv"
    arquivo_sql.write_text(gerar_sql(resultado.alunos), encoding="utf-8")
    gravar_pendencias(arquivo_pendencias, resultado.pendencias)

    resumir(resultado, planilha.meses)
    print(f"\nGerados (fora do git): {arquivo_sql.relative_to(RAIZ)} e {arquivo_pendencias.relative_to(RAIZ)}")
    print("Para aplicar no banco local: pnpm --filter api exec prisma db execute --file ../../scripts/carga-inicial/dados/carga.sql")


if __name__ == "__main__":
    main()

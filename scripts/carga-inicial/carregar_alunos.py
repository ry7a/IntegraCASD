"""Carga inicial dos alunos: planilha do H8 -> SQL para o banco ([Distribuição.NF002]).

Lê a aba H8 de data/SIRLEYDE NOVA.xlsx, normaliza cada linha com as regras de
regras.py e grava, na pasta dados/ (fora do git, LGPD):

- alunos.sql: turmas, vagas de alojamento e alunos, numa transação só, cada aluno
  com o seu registro na trilha de auditoria;
- pendencias-alunos.csv: o que a carga não conseguiu aproveitar, linha a linha,
  para a área administrativa conferir e digitar à mão.

O script não fala com o banco: o SQL é aplicado depois, com o Prisma (ver README.md).
No terminal só aparecem totais, nunca nomes ou CPFs.

Uso, na raiz do repositório:
    python scripts/carga-inicial/carregar_alunos.py
"""

import argparse
import csv
import sys
import warnings
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

import regras

PASTA_DO_SCRIPT = Path(__file__).resolve().parent
RAIZ = PASTA_DO_SCRIPT.parent.parent
PLANILHA_PADRAO = RAIZ / "data" / "SIRLEYDE NOVA.xlsx"
PASTA_DE_SAIDA = PASTA_DO_SCRIPT / "dados"
ABA = "H8"

# Colunas usadas, com o nome do cabeçalho da planilha. STATUS, BOLETO, NEG e DEVENDO
# ficam de fora: são da cobrança, e nenhuma cobrança pode existir só no banco local.
COLUNAS = ["SITUAC", "POSTO", "CURSO", "CELULAR", "ALOJ", "APTO", "VAGA",
           "MATRIC", "CPF", "ALUNOS", "TURMA", "EMAIL", "APELIDO"]


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


def ler_linhas(caminho: Path):
    """Devolve (número da linha no Excel, {coluna: valor}) para cada linha de dados."""
    # O openpyxl avisa de células com data impossível em outras colunas; não usamos essas colunas.
    warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")
    planilha = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    linhas = planilha[ABA].iter_rows(values_only=True)

    # O cabeçalho não está na primeira linha: procuramos a linha que tem STATUS e CPF.
    indices = None
    for numero, valores in enumerate(linhas, start=1):
        textos = [str(v).strip() if v is not None else "" for v in valores]
        if "STATUS" in textos and "CPF" in textos:
            faltando = [nome for nome in COLUNAS if nome not in textos]
            if faltando:
                sys.exit(f"A aba {ABA} não tem as colunas {faltando}. A planilha mudou de formato?")
            indices = {nome: textos.index(nome) for nome in COLUNAS}
            break
    if indices is None:
        sys.exit(f"Não achei o cabeçalho (STATUS, CPF...) na aba {ABA}.")

    for numero, valores in enumerate(linhas, start=numero + 1):
        yield numero, {nome: valores[i] if i < len(valores) else None for nome, i in indices.items()}


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


def normalizar(linhas) -> Resultado:
    resultado = Resultado()
    for linha, valores in linhas:
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
        ))

    resolver_repeticoes(resultado)
    return resultado


def resolver_repeticoes(resultado: Resultado) -> None:
    """O banco recusa repetições; a primeira linha da planilha fica, as outras viram pendência.

    - CPF: o SQL só insere aluno cujo CPF ainda não existe. O repetido não é carregado.
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


def gerar_sql(alunos: list[Aluno]) -> str:
    partes = [
        "-- Carga inicial dos alunos, gerada por scripts/carga-inicial/carregar_alunos.py.",
        "-- CONTÉM DADOS REAIS (LGPD): não versionar, não enviar, não usar em ambiente exposto.",
        "-- Pode rodar de novo: turma, vaga e aluno (pelo CPF) que já existem não são duplicados.",
        "BEGIN;",
        "",
    ]

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

    # Um comando por aluno: insere se o CPF ainda não existe e, no mesmo comando, grava a
    # inclusão na trilha de auditoria (usuario_id nulo = rotina automática, como no backend).
    for a in alunos:
        turma_id = "NULL" if a.turma is None else f"(SELECT id FROM turmas WHERE nome = {sql_texto(a.turma)})"
        if a.alojamento is None:
            alojamento_id = "NULL"
        else:
            b, ap, v = (sql_texto(parte) for parte in a.alojamento)
            alojamento_id = f"(SELECT id FROM alojamentos WHERE bloco = {b} AND apto = {ap} AND vaga = {v})"
        posto = "NULL" if a.posto is None else f"{sql_texto(a.posto)}::posto_aluno"
        curso = "NULL" if a.curso is None else f"{sql_texto(a.curso)}::curso_aluno"
        partes.append(
            f"-- linha {a.linha}\n"
            "WITH novo AS (\n"
            "  INSERT INTO alunos (id, nome, cpf, email, matricula, posto, curso, turma_id, celular, apelido,\n"
            "                      alojamento_id, ativo, data_alteracao)\n"
            f"  SELECT gen_random_uuid(), {sql_texto(a.nome)}, {sql_texto(a.cpf)}, {sql_texto(a.email)},\n"
            f"         {sql_texto(a.matricula)}, {posto}, {curso}, {turma_id},\n"
            f"         {sql_texto(a.celular)}, {sql_texto(a.apelido)}, {alojamento_id}, {sql_texto(a.ativo)}, now()\n"
            f"  WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE cpf = {sql_texto(a.cpf)})\n"
            "  RETURNING id, nome\n"
            ")\n"
            "INSERT INTO registros_auditoria (id, usuario_id, operacao, entidade, registro_id, detalhe)\n"
            "SELECT gen_random_uuid(), NULL, 'INCLUSAO', 'ALUNO', id::text,\n"
            "       'Aluno \"' || nome || '\" incluído pela carga inicial.'\n"
            "FROM novo;\n"
        )

    partes.append("COMMIT;")
    return "\n".join(partes) + "\n"


def gravar_pendencias(caminho: Path, pendencias) -> None:
    # Ponto e vírgula e BOM: o Excel em português abre o arquivo direto, com acentos.
    with caminho.open("w", encoding="utf-8-sig", newline="") as arquivo:
        escritor = csv.writer(arquivo, delimiter=";")
        escritor.writerow(["linha da planilha", "campo", "valor na planilha", "problema", "o que a carga fez"])
        escritor.writerows(sorted(pendencias))


def resumir(resultado: Resultado) -> None:
    alunos = resultado.alunos
    ativos = sum(1 for a in alunos if a.ativo)
    incompletos = sum(1 for a in alunos if a.email == "" or not regras.cpf_valido(a.cpf))
    nao_carregados = sum(1 for p in resultado.pendencias if p[4] == "aluno NÃO carregado")
    por_campo = Counter(p[1] for p in resultado.pendencias)
    print(f"Alunos para carregar: {len(alunos)} ({ativos} ativos, {len(alunos) - ativos} inativos)")
    print(f"  cadastros incompletos (sem e-mail válido ou CPF inválido): {incompletos}")
    print(f"  com turma: {sum(1 for a in alunos if a.turma)}, com curso: {sum(1 for a in alunos if a.curso)}, "
          f"com posto: {sum(1 for a in alunos if a.posto)}, com vaga: {sum(1 for a in alunos if a.alojamento)}")
    print(f"Linhas da planilha sem aluno (vaga vazia): {resultado.linhas_vazias}")
    print(f"Linhas NÃO carregadas: {nao_carregados}")
    print(f"Pendências para conferir: {len(resultado.pendencias)}"
          + ("" if not por_campo else " (" + ", ".join(f"{c}: {n}" for c, n in sorted(por_campo.items())) + ")"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera o SQL da carga inicial dos alunos a partir da planilha do H8.")
    parser.add_argument("--planilha", type=Path, default=PLANILHA_PADRAO, help="caminho do .xlsx")
    argumentos = parser.parse_args()
    if not argumentos.planilha.exists():
        sys.exit(f"Planilha não encontrada: {argumentos.planilha}. Ela fica em data/, fora do git: peça à equipe.")

    resultado = normalizar(ler_linhas(argumentos.planilha))

    PASTA_DE_SAIDA.mkdir(exist_ok=True)
    arquivo_sql = PASTA_DE_SAIDA / "alunos.sql"
    arquivo_pendencias = PASTA_DE_SAIDA / "pendencias-alunos.csv"
    arquivo_sql.write_text(gerar_sql(resultado.alunos), encoding="utf-8")
    gravar_pendencias(arquivo_pendencias, resultado.pendencias)

    resumir(resultado)
    print(f"\nGerados (fora do git): {arquivo_sql.relative_to(RAIZ)} e {arquivo_pendencias.relative_to(RAIZ)}")
    print("Para aplicar no banco local: pnpm --filter api exec prisma db execute --file ../../scripts/carga-inicial/dados/alunos.sql")


if __name__ == "__main__":
    main()

# Cria o backlog do IntegraCASD no GitHub: rótulos, marcos, quadro (Project) e issues.
# Rode UMA vez, na raiz do repositório: .\scripts\criar-backlog.ps1
# Rodar de novo duplica as issues.

$ErrorActionPreference = "Stop"
$repo  = gh repo view --json nameWithOwner -q .nameWithOwner
$owner = $repo.Split("/")[0]

Write-Host "Repositório: $repo"
$ok = Read-Host "Isso cria ~50 issues. Continuar? (s/n)"
if ($ok -ne "s") { exit }

# ---------------------------------------------------------------- Rótulos
$rotulos = @(
  @("tipo:feat",            "1D76DB", "Funcionalidade nova"),
  @("tipo:fix",             "D73A4A", "Correção de bug"),
  @("tipo:docs",            "0075CA", "Documentação"),
  @("tipo:chore",           "C5DEF5", "Configuração e ferramentas"),
  @("tipo:decisao",         "FBCA04", "Decisão a tomar com a equipe ou o CASD"),
  @("area:cadastros",       "BFD4F2", ""),
  @("area:cobrancas",       "BFD4F2", ""),
  @("area:movimentacoes",   "BFD4F2", ""),
  @("area:indicadores",     "BFD4F2", ""),
  @("area:administracao",   "BFD4F2", ""),
  @("area:web",             "BFD4F2", "Frontend"),
  @("area:infra",           "BFD4F2", "Infraestrutura, CI, nuvem"),
  @("prioridade:essencial", "B60205", "Sem isso o sistema não funciona"),
  @("prioridade:importante","E99695", "Funciona sem, mas de forma insatisfatória"),
  @("prioridade:desejavel", "0E8A16", "Pode ficar para uma versão futura"),
  @("bloqueado",            "000000", "Depende de algo fora da equipe")
)
foreach ($r in $rotulos) {
  gh label create $r[0] --repo $repo --color $r[1] --description $r[2] --force | Out-Null
}
Write-Host "Rótulos criados."

# ---------------------------------------------------------------- Marcos
$marcos = @(
  @("M0 Fundação",                         "2026-10-16"),
  @("M1 Acesso e cadastros",               "2026-10-23"),
  @("M2 Cobranças",                        "2026-11-06"),
  @("M3 Conciliação e movimentações",      "2026-11-20"),
  @("M4 Contratos, projetos e indicadores","2026-11-27"),
  @("M5 Implantação",                      "2026-12-04")
)
foreach ($m in $marcos) {
  gh api "repos/$repo/milestones" -f title="$($m[0])" -f due_on="$($m[1])T23:59:59Z" 2>$null | Out-Null
}
Write-Host "Marcos criados."

# ---------------------------------------------------------------- Quadro
$projeto = gh project create --owner $owner --title "IntegraCASD - MVP" --format json | ConvertFrom-Json
$num = $projeto.number
gh project link $num --owner $owner --repo $repo | Out-Null
Write-Host "Quadro criado: projeto número $num."

# ---------------------------------------------------------------- Issues
function Nova-Issue($marco, $rotulos, $titulo, $descricao) {
  $corpo = "$descricao`n`n---`nAntes de fechar, confira a definição de pronto no CONTRIBUTING.md."
  $url = gh issue create --repo $repo --title $titulo --body $corpo --label $rotulos --milestone $marco
  gh project item-add $num --owner $owner --url $url | Out-Null
  Write-Host "  + $titulo"
}

$M0 = "M0 Fundação"
Nova-Issue $M0 "tipo:chore,area:infra,prioridade:essencial" "Configurar CI com lint, testes e build em todo PR" "GitHub Actions rodando pnpm lint, pnpm test e pnpm build. Depois, exigir o CI na proteção da main."
Nova-Issue $M0 "tipo:chore,prioridade:essencial" "Configurar o Prisma e a primeira migração" "Prisma 7.10.0 (versão explícita), conexão pelo DATABASE_URL e uma migração inicial com a tabela de alunos."
Nova-Issue $M0 "tipo:feat,area:web,prioridade:essencial" "Esqueleto andante: tela lista alunos vindos da API" "Fluxo fino de ponta a ponta: React -> cliente gerado -> NestJS -> Prisma -> PostgreSQL. Sem regra de negócio."
Nova-Issue $M0 "tipo:feat,area:cobrancas,prioridade:essencial" "Esqueleto andante: webhook do sandbox chega ao worker" "Evento do sandbox do Asaas -> túnel -> API -> fila pg-boss -> worker registra o recebimento."
Nova-Issue $M0 "tipo:chore,area:web,prioridade:essencial" "Gerar o cliente da API com orval" "OpenAPI do NestJS -> packages/api-client com hooks do TanStack Query."
Nova-Issue $M0 "tipo:chore,area:web,prioridade:importante" "Configurar shadcn/ui, Tailwind e o tema do CASD" "Preto #0E0E0E, amarelo #FFC20E, branco; fontes Archivo e IBM Plex Sans."
Nova-Issue $M0 "tipo:feat,area:web,prioridade:essencial" "Layout base: menu lateral, rotas e faixa de ambiente de testes" "Menu: Indicadores, Cadastro (Alunos, Contratos, Projetos), Cobranças, Movimentações, Administração. [Hardware e software.NF003]"
Nova-Issue $M0 "tipo:chore,area:infra,prioridade:essencial" "Criar a conta sandbox do Asaas e distribuir as credenciais" "Chave de API e token do webhook para o .env de cada membro, por canal privado."
Nova-Issue $M0 "tipo:docs,prioridade:importante" "Validar o playbook de configuração com outro membro" "Alguém configura a máquina só pelo playbook, sem ajuda. Onde travar, o playbook melhora."
Nova-Issue $M0 "tipo:docs,prioridade:importante" "Diagramas de arquitetura no repositório" "Arquivos .drawio e exportações em SVG em docs/arquitetura."
Nova-Issue $M0 "tipo:docs,prioridade:essencial,bloqueado" "Dicionário de dados das planilhas (reunião com a Sheyla)" "Significado de cada aba e coluna, e para qual entidade cada uma vai. Sem dados reais no repositório."
Nova-Issue $M0 "tipo:decisao,prioridade:essencial,bloqueado" "Decidir se assinaturas internas geram cobrança" "Muda o modelo da cobrança: por aluno ou por vínculo. Perguntar à Sheyla e à diretoria."
Nova-Issue $M0 "tipo:docs,prioridade:essencial" "Modelo conceitual do banco (diagrama entidade-relacionamento)" "Entidades centrais e relacionamentos, a partir do dicionário de dados."
Nova-Issue $M0 "tipo:docs,prioridade:importante" "Documento de requisitos v1.1 com as lacunas encontradas" "Tela de pendências, histórico da geração recorrente, pagamento fora do Asaas, LGPD x exclusão, data de nascimento."

$M1 = "M1 Acesso e cadastros"
Nova-Issue $M1 "tipo:feat,area:administracao,prioridade:essencial" "Autenticação com sessão e bloqueio após 5 tentativas" "Sessão em cookie httpOnly, senha com argon2. [Segurança.NF001] [Segurança.NF005] [Segurança.NF007]"
Nova-Issue $M1 "tipo:feat,area:administracao,prioridade:essencial" "Manter usuários e perfis (administrativo e diretoria)" "Inclui troca de gestão e proibição de autoinativação. [Administração.RF001]"
Nova-Issue $M1 "tipo:feat,prioridade:importante" "Gravação central da trilha de auditoria" "Interceptor que registra usuário, data, operação e registro afetado. Sem edição nem exclusão. [Segurança.NF006]"
Nova-Issue $M1 "tipo:feat,area:cadastros,prioridade:essencial" "Manter cadastro de alunos (módulo de referência)" "Inclusão, alteração, consulta e inativação; CPF único entre ativos; aviso de débito ao inativar. [Cadastros.RF001]"
Nova-Issue $M1 "tipo:feat,area:cadastros,prioridade:essencial" "Manter cadastro de funcionários" "Com data de desligamento e salário de referência. [Cadastros.RF002]"
Nova-Issue $M1 "tipo:feat,area:cadastros,prioridade:importante" "Manter cadastro de fornecedores e parceiros" "Inativação bloqueada com contrato vigente. [Cadastros.RF003]"
Nova-Issue $M1 "tipo:feat,area:administracao,prioridade:essencial" "Manter categorias de movimentação" "Inativar sem excluir; nome único entre ativas. [Administração.RF002]"
Nova-Issue $M1 "tipo:feat,area:administracao,prioridade:essencial" "Configurar a integração com o Asaas" "Chave cifrada, nunca exibida; teste de comunicação; ambiente sandbox ou produção. [Administração.RF004] [Segurança.NF003]"

$M2 = "M2 Cobranças"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:essencial" "Cliente Asaas com interface, dublê de testes e retentativa no 429" "Único componente que fala com o Asaas. [Desempenho.NF005] [Usabilidade.NF002]"
Nova-Issue $M2 "tipo:feat,area:administracao,prioridade:essencial" "Parametrizar cobranças recorrentes" "Valor, dias de geração e vencimento, multa e juros, com prévia da próxima geração. [Administração.RF003]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:essencial" "Emitir cobrança avulsa" "Nada é gravado se o Asaas falhar. [Cobranças.RF002] [Confiabilidade.NF005]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:essencial" "Gerar cobranças recorrentes (job agendado)" "Seguro para rodar duas vezes; registra execução e falhas. [Cobranças.RF001] [Confiabilidade.NF007] [Desempenho.NF004]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:essencial" "Consultar cobranças" "Filtros e totais por situação. [Cobranças.RF008]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:importante" "Obter o boleto: baixar e reenviar por e-mail" "[Cobranças.RF003]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:importante" "Cancelar e renegociar cobrança" "Cancela no Asaas primeiro; renegociação vincula a cobrança nova à antiga. [Cobranças.RF004] [Usabilidade.NF003]"
Nova-Issue $M2 "tipo:feat,area:cobrancas,prioridade:importante" "Atualizar o cliente no Asaas quando o aluno muda" "Evento interno 'aluno alterado' publicado por Cadastros e tratado por Cobranças."

$M3 = "M3 Conciliação e movimentações"
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:essencial" "Receptor do webhook: valida, grava e enfileira" "Responde em até 5 s, sem regra de negócio. [Segurança.NF002] [Desempenho.NF001] ADR-0002"
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:essencial" "Conciliar pagamento no worker" "Idempotente; baixa, movimentação e auditoria na mesma transação. [Cobranças.RF005] [Confiabilidade.NF003] [Confiabilidade.NF004]"
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:importante" "Reprocessar eventos gravados e não processados" "Rotina periódica que cobre a falha entre gravar e enfileirar. ADR-0002"
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:importante" "Sincronizar cobranças com o Asaas" "Manual e periódica; não sobrescreve registro manual. [Cobranças.RF007]"
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:importante" "Registrar pagamento fora do Asaas" "Pix direto ou dinheiro, confirmando o recebimento no Asaas para o boleto deixar de valer. Exige justificativa."
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:importante" "Tela de pendências de conciliação" "Fila única: sem cobrança, após registro manual, divergências, falhas na geração."
Nova-Issue $M3 "tipo:feat,area:cobrancas,prioridade:essencial" "Alerta de webhook parado" "E-mail à diretoria após o período configurado (até 48 h) sem notificações. [Confiabilidade.NF002]"
Nova-Issue $M3 "tipo:feat,area:movimentacoes,prioridade:essencial" "Registrar movimentação" "Com categoria e vínculos opcionais; recusa data futura e valor zero. [Movimentações.RF001]"
Nova-Issue $M3 "tipo:feat,area:movimentacoes,prioridade:importante" "Estornar movimentação" "Lançamento espelho; recusa estorno de entrada vinda da conciliação. [Movimentações.RF002]"
Nova-Issue $M3 "tipo:feat,area:movimentacoes,prioridade:essencial" "Consultar movimentações" "Filtros, totais do recorte e opção de ocultar estornos. [Movimentações.RF003]"

$M4 = "M4 Contratos, projetos e indicadores"
Nova-Issue $M4 "tipo:feat,area:cadastros,prioridade:importante" "Manter contratos" "Destaque dos que vencem em 60 dias; total pago. [Cadastros.RF004]"
Nova-Issue $M4 "tipo:feat,area:cadastros,prioridade:importante" "Manter projetos" "Realizado contra orçamento; aceita despesa depois do encerramento. [Cadastros.RF005]"
Nova-Issue $M4 "tipo:feat,area:indicadores,prioridade:essencial" "Painel de indicadores (visão geral)" "Entradas, saídas, saldo e valor disponível; até 5 s para 12 meses. [Indicadores.RF001] [Desempenho.NF003]"
Nova-Issue $M4 "tipo:feat,area:indicadores,prioridade:essencial" "Consultar inadimplência" "Ranking de devedores, reenvio de boleto, alerta de sincronização antiga. [Indicadores.RF002]"
Nova-Issue $M4 "tipo:feat,area:indicadores,prioridade:importante" "Gastos por categoria" "Comparação com o período anterior; destaque para não classificadas. [Indicadores.RF003]"
Nova-Issue $M4 "tipo:feat,area:administracao,prioridade:desejavel" "Tela de consulta da trilha de auditoria" "Lista com filtros. [Administração.RF005]"

$M5 = "M5 Implantação"
Nova-Issue $M5 "tipo:decisao,area:infra,prioridade:essencial" "Escolher o provedor de nuvem (ADR-0003)" "Critérios na seção Implantação do documento de arquitetura. Atenção: serviços sempre ligados."
Nova-Issue $M5 "tipo:chore,area:infra,prioridade:importante" "Ambiente de homologação na nuvem" "Dados anonimizados e Asaas sandbox. [Hardware e software.NF004]"
Nova-Issue $M5 "tipo:feat,prioridade:essencial" "Script de carga inicial das planilhas" "Python, roda uma vez; carga conferida e aprovada pela área administrativa. [Distribuição.NF002]"
Nova-Issue $M5 "tipo:docs,area:infra,prioridade:essencial" "Testar e documentar a restauração do backup" "Novo playbook em docs/playbooks. [Confiabilidade.NF006]"
Nova-Issue $M5 "tipo:chore,area:infra,prioridade:essencial" "Implantação em produção" "Depois da aprovação da diretoria na homologação; volta à versão anterior em até 30 min. [Distribuição.NF003]"

Write-Host "`nPronto! Abra o quadro em: https://github.com/users/$owner/projects/$num"
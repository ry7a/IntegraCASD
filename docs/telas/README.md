# Protótipo de telas

Mockups navegáveis do frontend, com **dados fictícios** e sem chamar a API. Servem para validar o visual e o fluxo antes de implementar em React.

Para abrir, dê dois cliques em `indicadores.html` (ou rode `Start-Process docs\telas\indicadores.html` na raiz). O menu lateral leva às outras telas.

Para apontar uma aba ou um diálogo específico na revisão, use o id no fim do endereço: `administracao.html#painel-integracao` abre a aba, `cobranca.html#dialogo-cancelar` abre o diálogo. As telas de detalhe (`aluno.html` e `cobranca.html`) abrem a partir das listas.

## Estrutura

- `estilo.css`: o tema do CASD, com as mesmas variáveis de `apps/web/src/index.css`.
- `prototipo.js`: monta o menu lateral e a barra do topo, e liga abas, diálogos e dicas. Cada página só tem o próprio conteúdo.
- Uma página por item do menu. Cada uma vira uma pasta em `apps/web/src/features/`.

| Tela                 | Feature          | O que mostra                                                                                                                                  | Requisitos                |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `indicadores.html`   | `indicadores/`   | Página inicial: entradas, saídas, resultado e valor aguardando liberação; evolução de 6 meses; inadimplência com reenvio de boleto; gastos por categoria | Indicadores.RF001 a RF003 |
| `cadastros.html`     | `cadastro/`      | Abas de alunos, funcionários, contratos (com aviso de vencimento e contraparte em texto) e projetos (orçamento x realizado); formulário de novo aluno | Cadastros.RF001 a RF005   |
| `aluno.html`         | `cadastro/`      | Detalhe do aluno: dados editáveis, cobranças, movimentações, nova cobrança já com o aluno preenchido e inativação com aviso de débito         | Cadastros.RF001           |
| `cobrancas.html`     | `cobrancas/`     | Resumo por situação, filtros, lista de abertas e vencidas com link para o detalhe, e sincronização geral                                       | Cobranças.RF002 a RF008   |
| `cobranca.html`      | `cobrancas/`     | Detalhe da cobrança, centro das ações: boleto, reenvio, sincronização, pagamento manual, cancelar/renegociar e histórico de eventos do Asaas  | Cobranças.RF003 a RF008   |
| `movimentacoes.html` | `movimentacoes/` | Totais do recorte, filtros, estorno (só lançamento manual) e movimentação estornada com seu espelho                                            | Movimentações.RF001 a RF003 |
| `administracao.html` | `administracao/` | Usuários, categorias, parâmetros com conferência e execuções, integração com o Asaas (chave nunca exibida), trilha de auditoria               | Administração.RF001 a RF005 |

## Decisões de interface já aplicadas

- **Ações rápidas na barra do topo**, em todas as telas: buscar aluno, nova cobrança e nova movimentação a até três interações da página inicial ([Usabilidade.NF001]).
- **Confirmação com resumo do efeito** em cancelar cobrança, estornar e registrar pagamento manual ([Usabilidade.NF003]).
- **Selos sempre com texto** e, quando ajuda, ícone; nunca só cor.
- **Amarelo só** no botão principal, no item ativo do menu e em alertas.
- **Faixa no topo** enquanto a integração estiver no ambiente de testes do Asaas.
- **Gráficos** com paleta validada para daltonismo (azul para entradas, laranja para saídas), dica ao passar o mouse e os dados também em tabela.

## Decisões

- **Fora do MVP e do protótipo, por ora:** cadastro de fornecedores (o contrato guarda só o nome da contraparte), assinaturas internas, exportar relatório, anexo de comprovante e tela de login.
- **Estorno continua direto da lista** de Movimentações, sem passar por uma tela de detalhe.
- **O detalhe da cobrança é o centro das ações** (boleto, reenvio, sincronização, pagamento manual, cancelar/renegociar). A lista só mostra e leva ao detalhe.
- **A lista de cobranças abre só com abertas e vencidas**, ordenadas por vencimento; as demais situações se ligam pelos cartões de resumo.

## Em aberto para a equipe validar

- Se o resultado de uma busca na barra do topo abre uma lista ou vai direto ao cadastro do aluno (`aluno.html`).
# Frontend (apps/web)

SPA em React 19 + Vite 8 + TypeScript 6. Consome a API NestJS pelo cliente gerado em `packages/api-client`.

## Organização

```
src/
  app/            shell: rotas, layout com menu lateral, guarda de perfil, faixa de ambiente de testes
  features/       uma pasta por área do menu
    indicadores/  (página inicial)
    cadastro/     (alunos, contratos, projetos)
    cobrancas/
    movimentacoes/
    administracao/
  compartilhado/  componentes, formulários, utilitários usados por mais de uma feature
```

- **Uma feature nunca importa outra feature.** O que for usado por duas features sobe para `compartilhado/`.
- Componentes em PascalCase (`ListaDeAlunos.tsx`), um componente principal por arquivo.

## Dados

- **Nunca use `fetch` direto.** Toda chamada à API usa os hooks do TanStack Query gerados pelo orval em `packages/api-client`. Se faltar um endpoint, ele precisa existir na API primeiro.
- Não crie estado global para dados que vêm da API; o cache do TanStack Query já cumpre esse papel.
- Erros da API chegam traduzidos pelo cliente HTTP. Mostre a mensagem recebida; não invente texto técnico.

## Regras de interface

- **Nenhuma regra de negócio aqui.** Validações com Zod nos formulários são só para retorno rápido ao usuário.
- Formulários com React Hook Form + Zod.
- Operações irreversíveis (cancelar cobrança, estornar, registrar pagamento fora do Asaas) passam pelo diálogo de confirmação compartilhado, que mostra o resumo do efeito ([Usabilidade.NF003]).
- A guarda de perfil só esconde o que o usuário não pode usar; a permissão real é verificada na API.
- Mensagens de erro dizem o que fazer, não só o que falhou ([Usabilidade.NF002]).
- Valores monetários chegam em centavos e são exibidos com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Datas exibidas no formato brasileiro (dd/mm/aaaa).

## Identidade visual (CASD)

- Cores: preto `#0E0E0E` (menu, destaques fortes), amarelo `#FFC20E` (ação principal, item ativo, alertas) e branco. Fundo das telas `#F4F3EF`.
- O amarelo é reservado para ação principal, item ativo e alertas; não usar como decoração.
- Fontes: Archivo (títulos) e IBM Plex Sans (texto).
- Componentes base do shadcn/ui, customizados com essas cores via variáveis do Tailwind.
- Selos de situação sempre com texto, nunca só cor (Aberta, Vencida, Paga, Paga com registro manual, Cancelada, Estornada).
- Referência das telas: o canvas de design do projeto (pedir o link à equipe).

## Acessibilidade

- Todo campo tem `<label>` associado. Botões de ícone têm `aria-label`.
- Use elementos nativos (`button`, `a`, `select`) antes de recriá-los com `div`.
- Contraste mínimo AA: texto amarelo só sobre fundo preto.

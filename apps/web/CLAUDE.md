# Frontend (apps/web)

SPA em React 19 + Vite 8 + TypeScript 6. Consome a API NestJS pelo cliente gerado em `packages/api-client`.

## Organização

```
src/
  app/            shell: rotas (rotas.tsx), layout com menu lateral e barra do topo, rotas protegidas,
                  guarda de diretoria, faixa de ambiente de testes
  features/       uma pasta por área do menu
    acesso/       (login)
    indicadores/  (página inicial)
    cadastro/     (alunos, funcionários, contratos, projetos)
    cobrancas/    (lista, detalhe, pendências de conciliação)
    movimentacoes/
    administracao/
  compartilhado/  componentes, formatação, sessão, rótulos do domínio, usados por mais de uma feature
```

- **Uma feature nunca importa outra feature.** O que for usado por duas features sobe para `compartilhado/`.
  Só `app/` importa features (as páginas, em `app/rotas.tsx`); `compartilhado/` não importa `features/` nem `app/`.
- Componentes em PascalCase (`ListaDeAlunos.tsx`), um componente principal por arquivo. Nomes seguem o padrão
  `Pagina...`, `Aba...`, `Dialogo...`.
- `createContext` só em `app/` e `compartilhado/` (regra F7). O usuário logado vem de `useUsuarioAtual`.
- O ESLint (`eslint.config.js`) confere essas regras (F1 a F7, em `docs/governanca/README.md`). O frontend
  ainda não tem testes: `pnpm --filter web lint` e `pnpm --filter web build` são a verificação.

## Dados

- **Nunca use `fetch` direto.** Toda chamada à API usa os hooks do TanStack Query gerados pelo orval, importados
  só de `@integracasd/api-client` (ex.: `useListarMovimentacoes`). O nome do hook vem do `operationId` do endpoint.
  Se faltar um endpoint, ele precisa existir na API primeiro; depois rode `pnpm gerar:cliente-api` na raiz.
- Não crie estado global para dados que vêm da API; o cache do TanStack Query já cumpre esse papel.
- Erros da API chegam traduzidos pelo cliente HTTP. Mostre a mensagem recebida; não invente texto técnico.
  Carregando, erro e lista vazia usam `compartilhado/componentes/EstadoDaConsulta.tsx`.
- Todas as telas já usam a API; não há mais dados fictícios no frontend. O CI roda `verificar:build --estrito`,
  que falha se um `dados-ficticios.ts` voltar ao bundle (regra F6).

## Regras de interface

- **Nenhuma regra de negócio aqui.** Validações com Zod nos formulários são só para retorno rápido ao usuário.
- Formulários com React Hook Form + Zod.
- O Zod roda sem `eval` (`z.config({ jitless: true })` em `src/compartilhado/zod-sem-eval.ts`, o primeiro import
  do `main.tsx`): em produção o site tem CSP sem `'unsafe-eval'`, e o modo padrão do Zod geraria violação.
- Operações irreversíveis (cancelar cobrança, estornar, registrar pagamento fora do Asaas) passam pelo diálogo de confirmação compartilhado (`compartilhado/componentes/Dialogo.tsx`), que mostra o resumo do efeito ([Usabilidade.NF003]).
- A guarda de perfil (`app/GuardaDiretoria.tsx`) só esconde o que o usuário não pode usar; a permissão real é verificada na API.
- Mensagens de erro dizem o que fazer, não só o que falhou ([Usabilidade.NF002]).
- **Formatação só pelas funções de `compartilhado/formatacao.ts`** (regra F4): `formatarMoeda` (centavos → R$),
  `paraCentavos` (campo → centavos), `formatarData` (dd/mm/aaaa), `hojeIso` (dia de hoje em São Paulo).
  `Intl.*`, `toLocale...` e `toFixed` não aparecem fora desse arquivo; se faltar um formato, acrescente lá.
- Rótulos dos valores de enum (forma de pagamento, situação etc.) ficam em `compartilhado/dominio.ts` ou no
  `rotulos.ts` da feature.

## Identidade visual (CASD)

- Cores: preto `#0E0E0E` (menu, destaques fortes), amarelo `#FFC20E` (ação principal, item ativo, alertas) e branco. Fundo das telas `#F4F3EF`.
- O amarelo é reservado para ação principal, item ativo e alertas; não usar como decoração.
- Fontes: Archivo (títulos) e IBM Plex Sans (texto).
- O tema (cores, fontes, raio) fica todo em `src/index.css`. Use as classes do tema (`bg-primary`, `text-muted-foreground`, `bg-sidebar`, `font-heading`), nunca a cor em hex direto no componente (regra F5).
  - As telas vieram do protótipo (`docs/telas/`) e ainda usam as classes de `src/compartilhado/estilo-telas.css`,
    que tem cores em hex por exceção registrada em `docs/governanca/excecoes.json`. Não acrescente hex novo
    nele; ao mexer numa cor, leve-a para variável do tema em `src/index.css`.
  - Os componentes de hoje são próprios, em `src/compartilhado/componentes/` (`Abas`, `Dialogo`, `SeloDaCobranca`...).
    Use-os antes de criar outro.
  - O shadcn/ui está configurado (`components.json`), mas nenhum componente dele foi adicionado ainda. Se for usar,
    eles ficam em `src/compartilhado/componentes/ui/`; rode em `apps/web`: `pnpm dlx shadcn@4.21.4 add button`.
    Quase todos pedem dependência nova (Radix): combine com a equipe antes.
  - Imports a partir de `src/` usam o alias `@/` (ex.: `import { cn } from '@/compartilhado/utils'`).
  - Anel de foco em preto (`ring`): amarelo sobre o fundo claro não tem contraste suficiente.
- Selos de situação sempre com texto, nunca só cor (Aberta, Vencida, Paga, Paga com registro manual, Cancelada, Estornada).
- Referência das telas: o canvas de design do projeto (pedir o link à equipe).

## Acessibilidade

- Todo campo tem `<label>` associado. Botões de ícone têm `aria-label`.
- Use elementos nativos (`button`, `a`, `select`) antes de recriá-los com `div`.
- Contraste mínimo AA: texto amarelo só sobre fundo preto.

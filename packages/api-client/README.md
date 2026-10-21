# @integracasd/api-client

Cliente da API usado pelo frontend: tipos e hooks do TanStack Query gerados pelo [orval](https://orval.dev) a partir do OpenAPI da API.

```
openapi.json         contrato da API, gerado pelo NestJS (não editar)
orval.config.ts      configuração do orval
src/gerado/          código gerado pelo orval (não editar)
src/cliente-http.ts  único lugar que chama fetch; transforma falhas em ErroDaApi com mensagem para a tela
src/index.ts         o que o frontend pode importar
```

## Quando a API muda

Mudou ou criou uma rota, ou mudou um DTO? Na raiz, rode:

```powershell
pnpm gerar:cliente-api
```

Isso compila a API, grava o `openapi.json` e roda o orval. Faça commit do `openapi.json` e de `src/gerado/` junto com a mudança da API, no mesmo commit: assim quem ler o histórico vê o efeito no contrato.

## Como usar no frontend

```tsx
import { useListarAlunos } from '@integracasd/api-client'

const { data, error, isPending } = useListarAlunos()
// error é sempre um ErroDaApi: mostre error.message direto na tela.
```

O nome do hook vem do `operationId` da rota no controller (`listarAlunos` vira `useListarAlunos`).

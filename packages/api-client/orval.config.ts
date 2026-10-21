import { defineConfig } from 'orval';

// Gera tipos e hooks do TanStack Query a partir do openapi.json (que vem da API).
// O resultado em src/gerado/ não se edita à mão: rode `pnpm gerar:cliente-api` na raiz.
export default defineConfig({
  integracasd: {
    input: './openapi.json',
    output: {
      target: './src/gerado/api.ts',
      client: 'react-query',
      httpClient: 'fetch',
      // Um arquivo por tag do OpenAPI (alunos, cobrancas...), em vez de um arquivo gigante.
      mode: 'tags-split',
      clean: true,
      override: {
        // Toda chamada passa pelo nosso cliente HTTP, que trata os erros num lugar só.
        mutator: {
          path: './src/cliente-http.ts',
          name: 'clienteHttp',
        },
        // Os hooks devolvem só o corpo da resposta (ex.: { itens: [...] }), sem status e headers.
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});

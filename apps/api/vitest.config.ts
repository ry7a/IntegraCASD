import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Alguns testes são lentos de propósito (hash Argon2) ou leem todos os arquivos versionados (B11).
    // Com os testes rodando em paralelo, os 5 s padrão às vezes não bastavam e o teste falhava à toa.
    testTimeout: 20_000,
    // O mesmo para os `beforeEach` que montam um módulo do Nest: sob carga, passavam dos 10 s padrão.
    hookTimeout: 20_000,
    // Usado só com `--coverage` (`pnpm cobertura`). O `include` conta todos os arquivos de src/, inclusive
    // os que nenhum teste carrega; sem ele a porcentagem sairia maior do que a real.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/generated/**'],
      reporter: ['text-summary', 'html'],
      reportOnFailure: true,
    },
  },
});

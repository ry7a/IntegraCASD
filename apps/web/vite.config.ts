import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." aponta para src/. O mesmo alias está no tsconfig, para o editor e o tsc entenderem.
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Em desenvolvimento, o Vite repassa /api para a API NestJS. Para o navegador
    // tudo vem da mesma origem (localhost:5173), então não precisamos configurar CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

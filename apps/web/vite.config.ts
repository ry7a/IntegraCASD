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
})

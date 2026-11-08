// Primeiro de tudo: desliga o eval do Zod antes de as telas montarem os esquemas (ver o arquivo).
import './compartilhado/zod-sem-eval'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './compartilhado/estilo-telas.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

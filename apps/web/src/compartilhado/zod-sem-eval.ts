import { z } from 'zod'

// Em produção a API manda o CSP `default-src 'self'` sem 'unsafe-eval' (apps/api/src/site.ts). O Zod 4,
// para acelerar a validação de objetos, testa se pode compilar código com `new Function('')`; o teste
// falha em silêncio, mas o Chrome registra uma violação do CSP no console a cada carga da página. Com
// `jitless` o Zod nem tenta: valida do jeito interpretado (para os nossos formulários, sem diferença).
//
// Precisa rodar antes de qualquer `z.object(...)` ser criado, porque o Zod lê a opção ao montar o
// esquema. Por isso este arquivo é o PRIMEIRO import do main.tsx: os imports rodam na ordem em que
// aparecem, e as telas (que montam os esquemas) só são carregadas depois.
z.config({ jitless: true })

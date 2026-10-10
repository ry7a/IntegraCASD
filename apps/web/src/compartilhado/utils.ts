import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Junta classes do Tailwind; quando duas conflitam (ex.: "p-2" e "p-4"), vence a última.
// Usado pelos componentes do shadcn/ui.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

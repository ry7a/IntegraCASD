// Formatações de exibição usadas em várias telas.

// '12345678901' -> '123.456.789-01'. Se não tiver 11 dígitos, mostra como veio.
export function formatarCpf(cpf: string): string {
  if (!/^\d{11}$/.test(cpf)) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

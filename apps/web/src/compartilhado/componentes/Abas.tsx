interface Aba<T extends string> {
  id: T
  titulo: string
}

interface AbasProps<T extends string> {
  abas: readonly Aba<T>[]
  atual: T
  aoMudar: (id: T) => void
  rotulo: string
}

// Abas acessíveis: botões com role="tab". O painel de cada aba é o <PainelDaAba> logo abaixo.
export function Abas<T extends string>({ abas, atual, aoMudar, rotulo }: AbasProps<T>) {
  return (
    <div className="abas" role="tablist" aria-label={rotulo}>
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          id={`aba-${aba.id}`}
          className="aba"
          role="tab"
          aria-selected={aba.id === atual}
          aria-controls={`painel-${aba.id}`}
          onClick={() => aoMudar(aba.id)}
        >
          {aba.titulo}
        </button>
      ))}
    </div>
  )
}

// Só a aba aberta é montada: assim cada aba só consulta a API quando o usuário a abre.
export function PainelDaAba({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section className="painel-aba" id={`painel-${id}`} role="tabpanel" aria-labelledby={`aba-${id}`}>
      {children}
    </section>
  )
}

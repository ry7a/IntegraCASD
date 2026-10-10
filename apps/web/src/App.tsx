// Página provisória para conferir o tema do CASD. Será substituída pelo shell (src/app/).
function App() {
  return (
    <div className="flex min-h-screen">
      <nav aria-label="Menu principal" className="w-56 bg-sidebar p-4 text-sidebar-foreground">
        <p className="mb-6 font-heading text-lg font-bold">IntegraCASD</p>
        <ul className="space-y-1 text-sm">
          <li>
            <a
              href="#"
              aria-current="page"
              className="block rounded-md bg-sidebar-primary px-3 py-2 font-medium text-sidebar-primary-foreground"
            >
              Indicadores
            </a>
          </li>
          <li>
            <a href="#" className="block rounded-md px-3 py-2 hover:bg-sidebar-accent">
              Cobranças
            </a>
          </li>
        </ul>
      </nav>

      <main className="flex-1 space-y-6 p-8">
        <h1 className="text-3xl font-bold">Indicadores</h1>
        <div className="max-w-md space-y-4 rounded-lg border bg-card p-6 text-card-foreground">
          <h2 className="text-xl font-semibold">Tema do CASD</h2>
          <p className="text-muted-foreground">
            Títulos em Archivo, texto em IBM Plex Sans. Amarelo só na ação principal.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Emitir cobrança
            </button>
            <button
              type="button"
              className="rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancelar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

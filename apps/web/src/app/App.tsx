import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { rotas } from './rotas'

// O QueryClient guarda o cache das respostas da API. Criado uma vez, fora do
// componente, para não ser recriado a cada renderização.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Uma nova tentativa automática basta; depois disso a tela mostra o erro.
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={rotas} />
    </QueryClientProvider>
  )
}

export default App

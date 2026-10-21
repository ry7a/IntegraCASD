import { useEffect, useRef } from 'react'

// Dica ao passar o mouse: qualquer elemento com data-dica="texto" mostra o texto.
// Usa um único ouvinte no documento (como no protótipo) e mexe direto no elemento, para não
// renderizar a tela inteira a cada movimento do mouse.
function DicaFlutuante() {
  const referencia = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoMoverOMouse(evento: MouseEvent) {
      const dica = referencia.current
      if (!dica) return
      const alvo = (evento.target as Element | null)?.closest<HTMLElement>('[data-dica]')
      if (!alvo) {
        dica.hidden = true
        return
      }
      dica.textContent = alvo.dataset.dica ?? ''
      dica.hidden = false
      const margem = 14
      const esquerda = Math.min(evento.clientX + margem, window.innerWidth - dica.offsetWidth - 8)
      dica.style.left = `${esquerda}px`
      dica.style.top = `${evento.clientY + margem}px`
    }
    document.addEventListener('mousemove', aoMoverOMouse)
    return () => document.removeEventListener('mousemove', aoMoverOMouse)
  }, [])

  return <div ref={referencia} className="dica-flutuante" hidden />
}

export default DicaFlutuante

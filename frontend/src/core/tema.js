// El modo oscuro de cada persona en este dispositivo: 'auto' (sigue al
// celular), 'claro' u 'oscuro'. index.html aplica lo mismo antes de pintar,
// para que no se vea un destello claro al abrir.
const KEY = 'tema'
const VALID = ['auto', 'claro', 'oscuro']
const DARK_BAR = '#0B0C0E' // la barra del navegador en modo oscuro

const media = () => (typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null)

export function getTema() {
  try {
    const t = localStorage.getItem(KEY)
    return VALID.includes(t) ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function resolveTema(t, prefersDark) {
  return t === 'oscuro' || (t === 'auto' && prefersDark) ? 'oscuro' : 'claro'
}

export function applyTema(t) {
  const dark = resolveTema(t, !!media()?.matches) === 'oscuro'
  const html = document.documentElement
  if (dark) html.dataset.tema = 'oscuro'
  else delete html.dataset.tema
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    if (!meta.dataset.claro) meta.dataset.claro = meta.content // el de la marca
    meta.content = dark ? DARK_BAR : meta.dataset.claro
  }
}

export function setTema(t) {
  try { localStorage.setItem(KEY, t) } catch { /* sin almacenamiento: vale solo por ahora */ }
  applyTema(t)
}

// en 'auto', avisa cuando el celular cambia de claro a oscuro (o al reves)
export function watchTema(onChange) {
  const m = media()
  if (!m) return () => {}
  const fn = () => onChange()
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}

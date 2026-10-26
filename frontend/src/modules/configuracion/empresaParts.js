// Tu empresa por dentro: como se muestran las tallas y la tienda, y la
// direccion de la tienda completa. Sin pantalla.
import { sizeRank } from '../../core/utils'

// lo que se ve a la derecha de cada fila: "S a 4XL" si van de menor a mayor,
// si no las primeras y cuantas mas ("28, S, M +2")
export function tallasLabel(t) {
  if (t.length <= 3) return t.join(', ')
  const ordered = t.every((s, i) => i === 0 || sizeRank(t[i - 1]) < sizeRank(s))
  return ordered ? `${t[0]} a ${t[t.length - 1]}` : `${t.slice(0, 3).join(', ')} +${t.length - 3}`
}

export function tiendaLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Sin conectar'
  }
}

// "mitienda.com" -> "https://mitienda.com/products.json" (la lista de Shopify)
export function tiendaUrl(text) {
  const s = text.trim()
  if (!s) return ''
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(full)
    if (!/products\.json$/.test(u.pathname)) u.pathname = `${u.pathname.replace(/\/+$/, '')}/products.json`
    return u.toString()
  } catch {
    return full
  }
}

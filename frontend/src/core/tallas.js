// Las tallas de una referencia nueva en una remision y para contar lo de
// paso. Las cambia un administrador en Configuracion > Tu empresa (la app las
// pone al llegar los ajustes); mientras tanto, las de siempre.

export const TALLAS_BASE = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

let actuales = TALLAS_BASE

export const tallas = () => actuales

// una lista vacia o con tallas en blanco deja la de antes
export function setTallas(list) {
  if (!Array.isArray(list) || !list.length || !list.every((t) => typeof t === 'string' && t.trim())) return
  actuales = list.map((t) => t.trim().toUpperCase())
}

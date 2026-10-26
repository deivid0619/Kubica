// Lo de paso por dentro: los recordatorios ("recordar el...") y lo contado
// por talla (prendas que no son del inventario). Sin pantalla.
import { sizeRank } from '../../core/utils'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dayFrom = (days, now = new Date()) => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return ymd(d)
}

const dayLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}

// "Recordar hoy", "Recordar mañana", "Recordar el vie 17 oct" o "Atrasado: era el lun 13 oct"
export function reminderOf(remindOn, now = new Date()) {
  if (!remindOn) return null
  const today = ymd(now)
  if (remindOn < today) return { state: 'late', text: `Atrasado: era el ${dayLabel(remindOn)}` }
  if (remindOn === today) return { state: 'today', text: 'Recordar hoy' }
  if (remindOn === dayFrom(1, now)) return { state: 'soon', text: 'Recordar mañana' }
  return { state: 'later', text: `Recordar el ${dayLabel(remindOn)}` }
}

// primero lo de hoy y lo atrasado, despues lo que tiene fecha (la mas cercana
// primero) y al final lo que no tiene fecha, en el orden en que venia
export function byReminder(list, now = new Date()) {
  const today = ymd(now)
  const rank = (p) => (!p.remind_on ? 2 : p.remind_on <= today ? 0 : 1)
  return (list || []).map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p)
    || (rank(a.p) < 2 ? a.p.remind_on.localeCompare(b.p.remind_on) : 0) || a.i - b.i).map((x) => x.p)
}

export const dueToday = (list, now = new Date()) => (list || []).filter((p) => p.remind_on && p.remind_on <= ymd(now)).length

// [{ name, size, qty }] -> [{ name, rows: [{ size, qty }], total }], las tallas en orden
export function groupItems(items) {
  const groups = new Map()
  for (const it of items || []) {
    if (!groups.has(it.name)) groups.set(it.name, { name: it.name, rows: [], total: 0 })
    const g = groups.get(it.name)
    g.rows.push({ size: it.size || '', qty: it.qty })
    g.total += it.qty
  }
  for (const g of groups.values()) g.rows.sort((a, b) => sizeRank(a.size) - sizeRank(b.size))
  return [...groups.values()]
}

export const itemsTotal = (items) => (items || []).reduce((t, it) => t + it.qty, 0)

// "28 prendas: CAMISA HONDA 20 · CAMISA YAMAHA 8"
export function countText(items) {
  const groups = groupItems(items)
  if (!groups.length) return ''
  const total = groups.reduce((t, g) => t + g.total, 0)
  return `${total} ${total === 1 ? 'prenda' : 'prendas'}: ${groups.map((g) => `${g.name} ${g.total}`).join(' · ')}`
}

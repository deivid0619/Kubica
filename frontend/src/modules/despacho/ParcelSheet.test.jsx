// "Anotar algo de paso": contar prendas por talla (no son inventario), sacar
// el PDF del conteo, recordar un dia y las notas sueltas. Y la lista de "Por
// despachar" con lo de hoy primero. Se dibuja con datos de ejemplo, sin red.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayFrom } from './parcelParts'

const post = vi.fn(async (url, body) => ({ id: 9, ...body, location_name: 'Despacho (de paso)', user_name: 'Admin', created_at: new Date().toISOString() }))
const pdf = vi.fn(async () => new Blob(['%PDF']))
const download = vi.fn(async () => {})
let parcels = []

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../../core/api', () => ({ api: { post: (...a) => post(...a), patch: (...a) => post(...a), delete: async () => {} }, ApiError: class ApiError extends Error {} }))
vi.mock('../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, name: 'Admin' }, isAdmin: true }) }))
vi.mock('../../core/useApi', () => ({
  mutate: () => {}, revalidate: () => {}, refreshInventory: () => {},
  useLayout: () => ({ data: { elements: [] } }),
  usePolling: (path) => ({ data: path.startsWith('/api/parcels/owners') ? [] : path.startsWith('/api/parcels') ? parcels : [] }),
}))
vi.mock('../../ui/ToastContext', () => ({ useToast: () => () => {} }))
vi.mock('../../ui/ConfirmContext', () => ({ useConfirm: () => async () => true }))
vi.mock('../../ui/Sheet', () => ({
  default: ({ children }) => <div className="sheet">{children}</div>,
  SheetHeader: ({ title }) => <header><h2>{title}</h2></header>,
  useSheet: () => ({ close: () => {} }),
}))
vi.mock('../documentos/docPhotos', () => ({ downloadPhoto: (...a) => download(...a) }))
vi.mock('./parcelPdf', () => ({ parcelPdf: (...a) => pdf(...a) }))

const { default: ParcelSheet } = await import('./ParcelSheet')
const { default: PassingSection } = await import('./Passing')

let host
let root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  post.mockClear()
  pdf.mockClear()
  download.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const button = (text) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text))
// escribir en un campo de React (el valor pasa por el setter nativo)
const type = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('anotar algo de paso', () => {
  it('cuenta prendas por talla, saca el PDF y lo guarda con el día para recordar', async () => {
    act(() => root.render(<ParcelSheet onClose={() => {}} />))
    act(() => type(host.querySelector('input[list="parcel-owners"]'), 'Cliente Prueba'))
    act(() => button('Contar prendas por talla').click())
    act(() => type(host.querySelector('input[aria-label="Qué prenda es"]'), 'camisa honda'))
    act(() => type(host.querySelector('input[aria-label="CAMISA HONDA, talla M"]'), '5'))
    act(() => type(host.querySelector('input[aria-label="CAMISA HONDA, talla L"]'), '3'))
    expect(host.textContent).toContain('8 prendas contadas')
    act(() => button('Hoy').click())
    expect(host.textContent).toContain('Recordar hoy')

    await act(async () => button('PDF del conteo').click())
    expect(pdf).toHaveBeenCalledTimes(1)
    expect(pdf.mock.calls[0][0].items).toEqual([{ name: 'CAMISA HONDA', size: 'M', qty: 5 }, { name: 'CAMISA HONDA', size: 'L', qty: 3 }])
    expect(download.mock.calls[0][1]).toBe('conteo-cliente-prueba.pdf')

    await act(async () => button('Anotar').click())
    const body = post.mock.calls[0][1]
    expect(body.kind).toBe('caja')
    expect(body.items).toEqual([{ name: 'CAMISA HONDA', size: 'M', qty: 5 }, { name: 'CAMISA HONDA', size: 'L', qty: 3 }])
    expect(body.remind_on).toBe(dayFrom(0))
  })

  it('una nota suelta: solo lo que hay que recordar, sin cantidad ni ubicación', async () => {
    act(() => root.render(<ParcelSheet defaultKind="nota" onClose={() => {}} />))
    expect(host.textContent).toContain('¿Qué hay que recordar?')
    expect(host.textContent).not.toContain('¿Dónde quedó?')
    expect(host.textContent).not.toContain('Prendas por talla')
    expect(button('Anotar nota').disabled).toBe(true)
    act(() => type(host.querySelector('textarea'), 'Llamar al taller por las 7 que faltan'))
    act(() => button('Mañana').click())
    await act(async () => button('Anotar nota').click())
    expect(post.mock.calls[0][1]).toMatchObject({ kind: 'nota', qty: 1, items: [], notes: 'Llamar al taller por las 7 que faltan', remind_on: dayFrom(1) })
  })
})

describe('la lista de Por despachar', () => {
  it('lo de hoy y lo atrasado primero, resaltado; la nota se marca con Listo', () => {
    const at = new Date().toISOString()
    parcels = [
      { id: 1, kind: 'caja', qty: 1, owner: 'Sin fecha', notes: 'Enviar', location_id: 'DESPACHO', location_name: 'Despacho', created_at: at, user_name: 'A' },
      { id: 2, kind: 'caja', qty: 2, owner: 'Cliente', notes: 'Enviar', location_id: 'DESPACHO', location_name: 'Despacho', created_at: at, user_name: 'A',
        remind_on: dayFrom(3), items: [{ name: 'CAMISA HONDA', size: 'M', qty: 20 }, { name: 'CAMISA YAMAHA', size: 'L', qty: 8 }] },
      { id: 3, kind: 'nota', qty: 1, notes: 'Llamar al taller', location_id: 'DESPACHO', created_at: at, user_name: 'A', remind_on: dayFrom(0) },
    ]
    act(() => root.render(<PassingSection />))
    const rows = [...host.querySelectorAll('.need.parcel')]
    expect(rows.map((r) => r.querySelector('b').textContent)).toEqual(['Llamar al taller', '2 cajas · Cliente', '1 caja · Sin fecha'])
    expect(rows[0].className).toContain('due')
    expect(rows[0].textContent).toContain('Recordar hoy')
    expect(rows[0].querySelector('.parcel-out').textContent).toBe('Listo')
    expect(rows[1].textContent).toContain('28 prendas: CAMISA HONDA 20 · CAMISA YAMAHA 8')
    expect(host.querySelector('h2').textContent).toContain('1 nota')
    expect(host.querySelector('h2').textContent).toContain('1 para hoy')
  })
})

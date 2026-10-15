import { describe, expect, it } from 'vitest'
import { parcelPdf } from './parcelPdf'

const read = (blob) => new Promise((resolve) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.readAsBinaryString(blob)
})

describe('el PDF del conteo de lo de paso', () => {
  it('trae el título, cada prenda con sus tallas y el total', async () => {
    const blob = await parcelPdf({
      title: 'Conteo · 2 cajas · Cliente Prueba', owner: 'Cliente Prueba', notes: 'Enviar el viernes', place: 'Despacho (de paso)',
      by: 'Administrador', when: '15 oct 2026',
      items: [{ name: 'CAMISA HONDA', size: 'S', qty: 6 }, { name: 'CAMISA HONDA', size: '2XL', qty: 10 }, { name: 'CAMISA YAMAHA', size: 'M', qty: 8 }],
    })
    const raw = await read(blob)
    expect(raw.startsWith('%PDF')).toBe(true)
    expect(raw).toContain('Conteo')
    expect(raw).toContain('CAMISA HONDA')
    expect(raw).toContain('CAMISA YAMAHA')
    expect(raw).toContain('Prendas contadas')
    expect(raw).toContain('Enviar el viernes')
  })

  it('con muchas tallas usa una fila por talla y pasa de hoja si no cabe', async () => {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '28', '30', '32']
    const items = []
    for (let r = 0; r < 8; r++) for (const s of sizes) items.push({ name: `CAMISA ${r}`, size: s, qty: 2 })
    const raw = await read(await parcelPdf({ title: 'Conteo grande', items }))
    expect(raw).toContain('Cantidad')
    expect(raw).toContain('Página 2 de')
  })
})

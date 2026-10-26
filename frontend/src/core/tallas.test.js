import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TALLAS_BASE, setTallas, tallas } from './tallas'
import { nombreApp, setEmpresa } from './marca'
import { rowsOf } from '../modules/remisiones/refs'

describe('las tallas de la empresa (Configuracion > Tu empresa)', () => {
  beforeEach(() => setTallas(TALLAS_BASE))

  it('por defecto, las de siempre', () => {
    expect(tallas()).toEqual(['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'])
  })

  it('se cambian por las de la empresa', () => {
    setTallas(['28', '30', '32'])
    expect(tallas()).toEqual(['28', '30', '32'])
  })

  it('una lista vacia o que no sirve deja la de antes', () => {
    setTallas(['28', '30'])
    setTallas([])
    setTallas(null)
    setTallas(['', '  '])
    expect(tallas()).toEqual(['28', '30'])
  })

  it('una referencia nueva trae una fila por talla, en cero', () => {
    setTallas(['28', '30', '32'])
    expect(rowsOf({ isNew: true }).map((r) => [r.size, r.qty])).toEqual([['28', 0], ['30', 0], ['32', 0]])
  })

  it('lo que ya estaba anotado (o un borrador guardado) no cambia', () => {
    const before = rowsOf({ isNew: true })
    setTallas(['28'])
    expect(before.map((r) => r.size)).toEqual(TALLAS_BASE)
    // una referencia que ya existe sigue con sus propias tallas
    const known = { sizes: new Map([['XL', { size: 'XL', sku: 'REF-XL', have: 2 }]]) }
    expect(rowsOf(known).map((r) => r.size)).toEqual(['XL'])
  })
})

describe('el nombre de la empresa', () => {
  afterEach(() => setEmpresa(''))

  it('con nombre, va antes del de la app', () => {
    setEmpresa('Uno')
    expect(nombreApp()).toBe('Uno · Kubica')
  })

  it('vacio, solo la app', () => {
    setEmpresa('Uno')
    setEmpresa('')
    expect(nombreApp()).toBe('Kubica')
  })
})

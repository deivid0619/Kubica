import { describe, expect, it } from 'vitest'
import { tallasLabel, tiendaLabel, tiendaUrl } from './empresaParts'

describe('Tu empresa: lo que se ve en cada fila', () => {
  it('las tallas en orden se ven como un rango', () => {
    expect(tallasLabel(['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'])).toBe('S a 4XL')
    expect(tallasLabel(['28', '30', '32', '34'])).toBe('28 a 34')
  })

  it('en otro orden, las primeras y cuantas mas', () => {
    expect(tallasLabel(['S', 'M', 'L', 'XL', 'XS'])).toBe('S, M, L +2')
  })

  it('pocas tallas, todas', () => {
    expect(tallasLabel(['ÚNICA'])).toBe('ÚNICA')
    expect(tallasLabel(['S', 'M'])).toBe('S, M')
  })

  it('la tienda por su dominio', () => {
    expect(tiendaLabel('https://www.mitienda.com/products.json')).toBe('mitienda.com')
    expect(tiendaLabel('no es una direccion')).toBe('Sin conectar')
  })
})

describe('la direccion de la tienda', () => {
  it('se completa hasta la lista de productos', () => {
    expect(tiendaUrl('mitienda.com')).toBe('https://mitienda.com/products.json')
    expect(tiendaUrl(' https://mitienda.com/ ')).toBe('https://mitienda.com/products.json')
    expect(tiendaUrl('https://mitienda.com/products.json')).toBe('https://mitienda.com/products.json')
  })

  it('vacia es sin tienda', () => {
    expect(tiendaUrl('   ')).toBe('')
  })
})

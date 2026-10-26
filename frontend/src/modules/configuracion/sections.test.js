import { describe, expect, it } from 'vitest'
import { sectionsFor } from './sections'

describe('sectionsFor', () => {
  it('el administrador ve todas las secciones, en orden', () => {
    expect(sectionsFor('admin')).toEqual(['apariencia', 'bodega', 'empresa', 'equipo', 'avisos', 'datos', 'cuenta'])
  })
  it('el operador ve apariencia, avisos y su cuenta', () => {
    expect(sectionsFor('operator')).toEqual(['apariencia', 'avisos', 'cuenta'])
  })
  it('la cuenta "solo ver" ve apariencia y su cuenta', () => {
    expect(sectionsFor('viewer')).toEqual(['apariencia', 'cuenta'])
  })
  it('un rol desconocido ve lo mismo que "solo ver"', () => {
    expect(sectionsFor('otro')).toEqual(sectionsFor('viewer'))
    expect(sectionsFor(undefined)).toEqual(sectionsFor('viewer'))
  })
})

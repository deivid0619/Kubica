import { describe, expect, it } from 'vitest'
import { byReminder, countText, dayFrom, dueToday, groupItems, reminderOf } from './parcelParts'

const now = new Date(2026, 9, 15, 10, 0) // jueves 15 de octubre de 2026

describe('recordatorios de lo de paso', () => {
  it('dice si es hoy, mañana, otro día o ya pasó', () => {
    expect(reminderOf(null, now)).toBeNull()
    expect(reminderOf('2026-10-15', now)).toEqual({ state: 'today', text: 'Recordar hoy' })
    expect(reminderOf('2026-10-16', now)).toEqual({ state: 'soon', text: 'Recordar mañana' })
    expect(reminderOf('2026-10-20', now).state).toBe('later')
    expect(reminderOf('2026-10-20', now).text).toMatch(/^Recordar el /)
    expect(reminderOf('2026-10-13', now).state).toBe('late')
    expect(reminderOf('2026-10-13', now).text).toMatch(/^Atrasado: era el /)
    expect(dayFrom(1, now)).toBe('2026-10-16')
  })

  it('primero lo de hoy y lo atrasado, después por fecha y al final lo sin fecha', () => {
    const list = [
      { id: 1 }, { id: 2, remind_on: '2026-10-20' }, { id: 3, remind_on: '2026-10-15' },
      { id: 4 }, { id: 5, remind_on: '2026-10-10' }, { id: 6, remind_on: '2026-10-17' },
    ]
    expect(byReminder(list, now).map((p) => p.id)).toEqual([5, 3, 6, 2, 1, 4])
    expect(dueToday(list, now)).toBe(2)
  })
})

describe('lo contado por talla', () => {
  const items = [
    { name: 'CAMISA HONDA', size: 'L', qty: 4 }, { name: 'CAMISA YAMAHA', size: 'M', qty: 8 },
    { name: 'CAMISA HONDA', size: 'S', qty: 6 }, { name: 'CAMISA HONDA', size: '2XL', qty: 10 },
  ]
  it('se agrupa por prenda, con las tallas en orden y su total', () => {
    expect(groupItems(items)).toEqual([
      { name: 'CAMISA HONDA', total: 20, rows: [{ size: 'S', qty: 6 }, { size: 'L', qty: 4 }, { size: '2XL', qty: 10 }] },
      { name: 'CAMISA YAMAHA', total: 8, rows: [{ size: 'M', qty: 8 }] },
    ])
    expect(countText(items)).toBe('28 prendas: CAMISA HONDA 20 · CAMISA YAMAHA 8')
    expect(countText(null)).toBe('')
  })
})

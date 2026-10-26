import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTema, getTema, resolveTema, setTema, watchTema } from './tema'

// un localStorage de verdad (el de Node, si existe, no tiene getItem/setItem)
function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  }
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

// un matchMedia de mentira que se puede cambiar desde la prueba
function fakeMedia(dark) {
  const listeners = new Set()
  const mql = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    emit(next) { mql.matches = next; listeners.forEach((fn) => fn({ matches: next })) },
  }
  window.matchMedia = vi.fn(() => mql)
  return mql
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.tema
})

describe('resolveTema', () => {
  it('automático sigue al celular', () => {
    expect(resolveTema('auto', true)).toBe('oscuro')
    expect(resolveTema('auto', false)).toBe('claro')
  })
  it('claro y oscuro mandan sobre el celular', () => {
    expect(resolveTema('claro', true)).toBe('claro')
    expect(resolveTema('oscuro', false)).toBe('oscuro')
  })
})

describe('getTema / setTema', () => {
  it('sin nada guardado o con algo raro es automático', () => {
    expect(getTema()).toBe('auto')
    localStorage.setItem('tema', 'xx')
    expect(getTema()).toBe('auto')
  })
  it('setTema guarda y aplica', () => {
    fakeMedia(false)
    setTema('oscuro')
    expect(getTema()).toBe('oscuro')
    expect(document.documentElement.dataset.tema).toBe('oscuro')
  })
})

describe('applyTema', () => {
  it('pone y quita data-tema en <html>', () => {
    fakeMedia(false)
    applyTema('oscuro')
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    applyTema('claro')
    expect(document.documentElement.dataset.tema).toBeUndefined()
  })
  it('automático con el celular en oscuro queda oscuro', () => {
    fakeMedia(true)
    applyTema('auto')
    expect(document.documentElement.dataset.tema).toBe('oscuro')
  })
})

describe('watchTema', () => {
  it('avisa cuando el celular cambia de claro a oscuro, y deja de avisar al soltarlo', () => {
    const mql = fakeMedia(false)
    const cb = vi.fn()
    const stop = watchTema(cb)
    mql.emit(true)
    expect(cb).toHaveBeenCalledTimes(1)
    stop()
    mql.emit(false)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

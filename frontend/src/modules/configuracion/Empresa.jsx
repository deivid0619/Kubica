import { useState } from 'react'
import { api, ApiError } from '../../core/api'
import { revalidate } from '../../core/useApi'
import { nombreAppCon, setEmpresa } from '../../core/marca'
import { TALLAS_BASE, setTallas } from '../../core/tallas'
import { useToast } from '../../ui/ToastContext'
import Icon from '../../ui/Icon'
import Sheet, { SheetHeader } from '../../ui/Sheet'
import StoreStatus from '../resumen/StoreStatus'
import { tiendaUrl } from './empresaParts'

// Configuracion > Tu empresa: las hojas para el nombre, las tallas y la
// tienda en linea. Lo guardado lo ve toda la app (ver App.jsx, Shell).

// guarda y lo pone ya en este celular; los demas lo ven en su proximo sondeo
async function save(cambios) {
  const res = await api.put('/api/settings', cambios)
  setEmpresa(res.empresa_nombre)
  setTallas(res.tallas)
  revalidate('/api/settings')
  return res
}

function useSave(onDone) {
  const showToast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (cambios, msg) => {
    setBusy(true)
    try {
      const res = await save(cambios)
      showToast(msg)
      onDone?.(res)
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo guardar. Revisa la conexión.', 'err')
    } finally {
      setBusy(false)
    }
  }
  return [run, busy]
}

function NombreSheet({ value, onClose }) {
  const [name, setName] = useState(value)
  const [run, busy] = useSave(onClose)
  const clean = name.trim()
  return (
    <Sheet modal onClose={onClose} label="Nombre de la empresa">
      <SheetHeader title="Nombre de la empresa" subtitle="Sale en los PDF, en el Excel y en el texto de los enlaces «solo ver»." />
      <form onSubmit={(e) => { e.preventDefault(); run({ empresa_nombre: clean }, clean ? 'Nombre guardado' : 'Nombre quitado') }}>
        <label className="field">
          <span className="field-label">Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                 placeholder="Ej.: Distribuidora Uno" autoComplete="organization" />
          <span className="field-hint">Así se ve: <b>{nombreAppCon(clean)}</b></span>
        </label>
        <button type="submit" className="btn btn-lime btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || clean === value}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </Sheet>
  )
}

function TallasSheet({ value, onClose }) {
  const [list, setList] = useState(value)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [run, busy] = useSave(onClose)
  const same = list.join() === value.join()

  const add = () => {
    const nuevas = text.split(/[,;\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    if (nuevas.some((t) => t.length > 8)) return setErr('Cada talla va de 1 a 8 letras o números.')
    const next = [...list]
    for (const t of nuevas) if (!next.includes(t)) next.push(t)
    if (next.length > 20) return setErr('Son 20 tallas como máximo.')
    setList(next)
    setText('')
    setErr('')
    return null
  }

  return (
    <Sheet modal onClose={onClose} label="Tallas que manejan">
      <SheetHeader title="Tallas que manejan" subtitle="Las que trae una referencia nueva al recibir, y las de contar lo de paso." />
      <div className="set-tallas" role="list" aria-label="Tallas">
        {list.map((t) => (
          <span role="listitem" key={t}>
            <button type="button" className="chip set-talla" onClick={() => setList(list.filter((x) => x !== t))} aria-label={`Quitar ${t}`}>
              {t}<Icon name="x" size={14} stroke={2.4} />
            </button>
          </span>
        ))}
        {!list.length && <span className="field-hint">Agrega al menos una talla.</span>}
      </div>
      <form className="field" onSubmit={(e) => { e.preventDefault(); add() }}>
        <label className="field-label" htmlFor="set-talla-nueva">Agregar tallas</label>
        <div className="set-add">
          <input id="set-talla-nueva" className="input mono" value={text} onChange={(e) => { setText(e.target.value); setErr('') }}
                 placeholder="Ej.: XS, XXL o 28, 30" autoCapitalize="characters" autoComplete="off" spellCheck="false" />
          <button type="submit" className="btn btn-ghost" disabled={!text.trim()}>Agregar</button>
        </div>
        <span className={`field-hint${err ? ' set-err' : ''}`} role={err ? 'alert' : undefined}>
          {err || 'Separa varias con comas. Quedan en el orden en que las agregues.'}
        </span>
      </form>
      <p className="set-note">Solo cambia las referencias nuevas: lo que ya está registrado sigue con sus tallas.</p>
      {list.join() !== TALLAS_BASE.join() && (
        <button type="button" className="link-btn set-base" onClick={() => { setList(TALLAS_BASE); setErr('') }}>
          Volver a las de siempre (S a 4XL)
        </button>
      )}
      <button type="button" className="btn btn-lime btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || !list.length || same}
              onClick={() => run({ tallas: list }, 'Tallas guardadas')}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </Sheet>
  )
}

function TiendaSheet({ value, onClose }) {
  const [url, setUrl] = useState(value)
  const [saved, setSaved] = useState(value)
  const [run, busy] = useSave((res) => {
    setSaved(res.catalogo_url)
    setUrl(res.catalogo_url)
    revalidate('/api/catalog/status')
  })
  const next = tiendaUrl(url)
  return (
    <Sheet modal onClose={onClose} label="Tienda en línea">
      <SheetHeader title="Tienda en línea" subtitle="Si tu tienda es Shopify, al escanear un código nuevo se llenan solos el nombre, la foto y el precio." />
      <form onSubmit={(e) => { e.preventDefault(); run({ catalogo_url: next }, next ? 'Tienda guardada' : 'Tienda quitada') }}>
        <label className="field">
          <span className="field-label">Dirección de la tienda</span>
          <input className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300}
                 placeholder="https://mitienda.com" autoComplete="url" autoCapitalize="off" spellCheck="false" />
          <span className="field-hint">La app lee su lista de productos. Vacía: sin tienda.</span>
        </label>
        {saved && <div className="set-store"><StoreStatus /></div>}
        <button type="submit" className="btn btn-lime btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || next === saved}>
          {busy ? 'Guardando…' : next || !saved ? 'Guardar' : 'Quitar la tienda'}
        </button>
      </form>
    </Sheet>
  )
}

export default function EmpresaSheet({ kind, ajustes, onClose }) {
  if (kind === 'nombre') return <NombreSheet value={ajustes.empresa_nombre} onClose={onClose} />
  if (kind === 'tallas') return <TallasSheet value={ajustes.tallas} onClose={onClose} />
  if (kind === 'tienda') return <TiendaSheet value={ajustes.catalogo_url} onClose={onClose} />
  return null
}

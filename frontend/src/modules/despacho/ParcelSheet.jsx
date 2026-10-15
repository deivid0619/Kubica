import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../core/api'
import { useAuth } from '../../core/AuthContext'
import { mutate, revalidate, useLayout, usePolling } from '../../core/useApi'
import { DISPATCH, locationGroups } from '../../core/locationGroups'
import { fmtTime } from '../../core/utils'
import { useToast } from '../../ui/ToastContext'
import { useConfirm } from '../../ui/ConfirmContext'
import Sheet, { SheetHeader, useSheet } from '../../ui/Sheet'
import Icon from '../../ui/Icon'
import LocationPicker from '../../ui/LocationPicker'
import { Empty, Stepper, plural } from '../../ui/Bits'
import { downloadPhoto } from '../documentos/docPhotos'
import { SIZES, dayFrom, groupItems, itemsTotal, reminderOf } from './parcelParts'

// Lo que esta de paso sin ser inventario: una caja suelta, una canasta, una
// bolsa... con de quien es y que hacer con ella. No suma a la bodega ni a
// los reportes; sale de la lista con "Ya salio". Tambien notas sueltas
// (recordatorios), y cualquiera puede llevar "recordar el...".
export const KINDS = [
  { k: 'caja', label: 'Caja', icon: 'box', one: 'caja', many: 'cajas' },
  { k: 'canasta', label: 'Canasta', icon: 'crate', one: 'canasta', many: 'canastas' },
  { k: 'bolsa', label: 'Bolsa', icon: 'bag', one: 'bolsa', many: 'bolsas' },
  { k: 'otro', label: 'Otro', icon: 'tag' },
  { k: 'nota', label: 'Nota', icon: 'pencil' },
]
const KIND = Object.fromEntries(KINDS.map((x) => [x.k, x]))
const TODO = ['Enviar', 'Entregar al cliente', 'Vienen a recogerlo', 'Devolver al proveedor', 'Revisar']
const NOTE_TODO = ['Llamar a', 'Pedir', 'Cobrar', 'Revisar', 'Avisar a']

// "2 cajas", "1 canasta", "Casco", "Casco (2)", "Nota": igual que en los avisos
export function parcelName(p) {
  if (p.kind === 'nota') return 'Nota'
  const k = KIND[p.kind]
  if (k?.one) return `${p.qty} ${p.qty === 1 ? k.one : k.many}`
  const label = p.label || 'Otro'
  return p.qty === 1 ? label : `${label} (${p.qty})`
}

// lo contado por talla, para editarlo: una prenda con las tallas de la plantilla y las que traiga
let nextKey = 1
const newCount = (name = '', rows = []) => {
  const have = new Map(rows.map((r) => [r.size, r.qty]))
  const extra = rows.filter((r) => !SIZES.includes(r.size)).map((r) => r.size)
  return { key: nextKey++, name, rows: [...SIZES, ...extra].map((size) => ({ size, qty: have.get(size) || 0 })) }
}
const countsFrom = (items) => groupItems(items).map((g) => newCount(g.name, g.rows))
const flatten = (counts) => counts.flatMap((c) => (c.name.trim()
  ? c.rows.filter((r) => r.qty > 0).map((r) => ({ name: c.name.trim(), size: r.size, qty: r.qty })) : []))

export const parcelIcon = (p) => KIND[p.kind]?.icon || 'tag'

// cuanto lleva esperando; pasada una semana se marca: lo de paso debe salir pronto
export function waited(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return { text: days <= 0 ? 'llegó hoy' : days === 1 ? 'llegó ayer' : `lleva ${days} días`, late: days > 7 }
}

// "Ya salio" desde cualquier lista: sale de la lista en el acto, con
// Deshacer en el aviso de abajo por si fue un toque sin querer.
export async function markDone(parcel, showToast) {
  mutate('/api/parcels', (list) => list.filter((x) => x?.id !== parcel.id))
  try {
    await api.post(`/api/parcels/${parcel.id}/done`)
    showToast(parcel.kind === 'nota' ? `Listo: ${parcel.notes}` : `Ya salió: ${parcelName(parcel)}${parcel.owner ? ` · ${parcel.owner}` : ''}`, 'ok', {
      label: 'Deshacer',
      onClick: async () => {
        try {
          await api.post(`/api/parcels/${parcel.id}/reopen`)
          showToast('Volvió a la lista')
        } catch (e) {
          showToast(e instanceof ApiError ? e.message : 'No se pudo deshacer.', 'err')
        }
        revalidate('/api/parcels')
      },
    })
  } catch (e) {
    showToast(e instanceof ApiError ? e.message : 'No se pudo marcar. Intenta otra vez.', 'err')
  }
  revalidate('/api/parcels')
}

function Form({ parcel, defaultLocation, defaultKind, showMap }) {
  const { close } = useSheet()
  const showToast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { data: layout } = useLayout()
  const { data: owners } = usePolling('/api/parcels/owners', { interval: 120000 })
  const groups = useMemo(() => locationGroups(layout?.elements, { dispatch: false }), [layout])
  const editing = !!parcel
  const [kind, setKind] = useState(parcel?.kind || defaultKind || 'caja')
  const [label, setLabel] = useState(parcel?.label || '')
  const [qty, setQty] = useState(parcel?.qty || 1)
  const [owner, setOwner] = useState(parcel?.owner || '')
  const [notes, setNotes] = useState(parcel?.notes || '')
  const [place, setPlace] = useState(parcel?.location_id || defaultLocation || DISPATCH)
  const [remind, setRemind] = useState(parcel?.remind_on || '') // recordar el (AAAA-MM-DD)
  const [counts, setCounts] = useState(() => countsFrom(parcel?.items)) // lo contado por talla
  const [addingSize, setAddingSize] = useState(null) // la prenda a la que se le agrega otra talla
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const labelRef = useRef(null)
  const notesRef = useRef(null)
  const nota = kind === 'nota'
  const items = nota ? [] : flatten(counts)
  const counted = itemsTotal(items)
  const today = dayFrom(0)
  const tomorrow = dayFrom(1)
  const reminder = reminderOf(remind)

  const known = groups.some((g) => g.options.some((l) => l.id === place))
  const unnamed = !nota && counts.some((c) => !c.name.trim() && c.rows.some((r) => r.qty > 0))
  const problem = nota && !notes.trim() ? 'Escribe qué hay que recordar.'
    : kind === 'otro' && !label.trim() ? 'Escribe qué es.'
      : !owner.trim() && !notes.trim() ? 'Escribe de quién es o qué hay que hacer.'
        : unnamed ? 'Escribe el nombre de cada prenda que contaste.' : ''
  const canDelete = editing && (isAdmin || parcel.user_id === user?.id)

  // el foco va en el mismo toque (flushSync): el iPhone solo abre el teclado asi
  const pickKind = (k) => {
    flushSync(() => setKind(k))
    if (k === 'otro') labelRef.current?.focus()
    if (k === 'nota') notesRef.current?.focus()
  }

  // contar por talla: cada prenda con sus tallas
  const setCount = (key, patch) => setCounts((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  const setQtyOf = (key, size, n) => setCounts((cs) => cs.map((c) => (c.key !== key ? c : {
    ...c, rows: c.rows.map((r) => (r.size === size ? { ...r, qty: Math.max(0, Math.min(99999, Math.floor(+n) || 0)) } : r)),
  })))
  const addSizeTo = (key, raw) => {
    const s = String(raw || '').trim().toUpperCase().replace(/^T(?=\w)/, '')
    setAddingSize(null)
    if (s) setCounts((cs) => cs.map((c) => (c.key !== key || c.rows.some((r) => r.size === s) ? c : { ...c, rows: [...c.rows, { size: s, qty: 0 }] })))
  }

  // el PDF de lo contado, con lo que hay en el formulario (antes o despues de guardar)
  const makePdf = async () => {
    setPdfBusy(true)
    try {
      const { parcelPdf } = await import('./parcelPdf')
      const what = parcelName({ kind, label, qty })
      const where = place === DISPATCH ? 'Despacho (de paso)' : groups.flatMap((g) => g.options).find((o) => o.id === place)?.name || place
      const when = new Date(parcel?.created_at || Date.now()).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      const blob = await parcelPdf({
        title: `Conteo · ${what}${owner.trim() ? ` · ${owner.trim()}` : ''}`, owner: owner.trim(), notes: notes.trim(),
        place: where, by: parcel?.user_name || user?.name, when, items,
      })
      const slug = (owner.trim() || 'de-paso').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await downloadPhoto(blob, `conteo-${slug}.pdf`)
    } catch {
      showToast('No se pudo armar el PDF. Intenta otra vez.', 'err')
    } finally {
      setPdfBusy(false)
    }
  }

  // el atajo escribe el comienzo y deja el cursor al final para completarlo
  const addTodo = (t) => {
    const cur = notes.trim().replace(/[.,;]$/, '')
    const next = cur ? `${cur}. ${t} ` : `${t} `
    flushSync(() => setNotes(next))
    const el = notesRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(next.length, next.length)
  }

  const save = async () => {
    if (problem || busy) return
    setBusy(true)
    const body = { kind, label: kind === 'otro' ? label : '', qty: nota ? 1 : qty, owner, notes, location_id: place,
                   items, remind_on: remind || null }
    try {
      const res = editing ? await api.patch(`/api/parcels/${parcel.id}`, body) : await api.post('/api/parcels', body)
      revalidate('/api/parcels')
      showToast(editing ? 'Cambios guardados'
        : nota ? `Nota anotada${remind ? ` · ${reminder.text.toLowerCase()}` : ''}`
          : `Anotado: ${parcelName(res)}${res.owner ? ` · ${res.owner}` : ''}${counted ? ` · ${plural(counted, 'prenda', 'prendas')}` : ''}`)
      close()
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo guardar. Intenta otra vez.', 'err')
      setBusy(false)
    }
  }

  const leave = () => {
    markDone(parcel, showToast)
    close()
  }

  const remove = async () => {
    const ok = await confirm({
      title: parcel.kind === 'nota' ? '¿Borrar esta nota?' : `¿Borrar ${parcelName(parcel)}${parcel.owner ? ` de ${parcel.owner}` : ''}?`,
      body: parcel.kind === 'nota' ? 'Se quita de la lista. Si ya la hiciste, toca "Listo".'
        : 'Se quita de lo que está de paso. Úsalo solo si lo anotaste por error: si ya salió, toca "Ya salió".',
      confirmLabel: 'Sí, borrar',
    })
    if (!ok) return
    try {
      await api.delete(`/api/parcels/${parcel.id}`)
      revalidate('/api/parcels')
      showToast('Borrado de la lista')
      close()
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo borrar.', 'err')
    }
  }

  return (
    <>
      <SheetHeader
        eyebrow={<div className="sheet-eyebrow"><span className="tag tag-set">{nota ? 'Recordatorio' : 'De paso'}</span></div>}
        title={editing ? parcelName(parcel) : nota ? 'Anotar una nota' : 'Anotar algo de paso'}
        subtitle={editing
          ? `Anotado ${fmtTime(parcel.created_at)} por ${parcel.user_name}`
          : nota ? 'Algo que no hay que olvidar: llamar a alguien, pedir algo, revisar algo.'
            : 'Una caja suelta, una canasta o lo que entre aparte y salga pronto.'}
      />

      <span className="field-label">¿Qué es?</span>
      <div className="kind-pick" role="radiogroup" aria-label="Qué es">
        {KINDS.map((x) => (
          <button key={x.k} type="button" role="radio" aria-checked={kind === x.k} onClick={() => pickKind(x.k)}>
            <Icon name={x.icon} size={22} />{x.label}
          </button>
        ))}
      </div>
      {kind === 'otro' && (
        <input
          ref={labelRef}
          className="input"
          style={{ marginTop: 10 }}
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="¿Qué es? Ej. un casco, un rollo de tela"
          aria-label="Qué es"
        />
      )}

      {!nota && (
        <div className="card scan-qty">
          <div><b>Cantidad</b><small>Cuántas son iguales</small></div>
          <Stepper
            value={qty}
            onMinus={() => setQty((q) => Math.max(1, q - 1))}
            onPlus={() => setQty((q) => Math.min(999, q + 1))}
            disabledMinus={qty <= 1}
          />
        </div>
      )}

      {nota && (
        <label className="field">
          <span className="field-label">¿Qué hay que recordar?</span>
          <textarea ref={notesRef} className="input notes" rows={3} maxLength={500} value={notes}
                    onChange={(e) => setNotes(e.target.value)} placeholder="Ej. llamar al taller por las 7 que faltan de la OPR" />
        </label>
      )}
      {nota && (
        <div className="chips todo-chips" role="toolbar" aria-label="Atajos para la nota">
          {NOTE_TODO.map((t) => <button key={t} type="button" className="chip" onClick={() => addTodo(t)}>{t}</button>)}
        </div>
      )}

      <label className="field">
        <span className="field-label">{nota ? <>¿Con quién o de quién? <small className="opt">si quieres</small></> : <>¿De quién es? <small className="opt">o para quién</small></>}</span>
        <input
          className="input"
          value={owner}
          maxLength={120}
          onChange={(e) => setOwner(e.target.value)}
          list="parcel-owners"
          placeholder="Ej. un cliente, una tienda, un taller"
          autoCapitalize="words"
          autoComplete="off"
        />
        <datalist id="parcel-owners">{(owners || []).map((o) => <option key={o} value={o} />)}</datalist>
      </label>

      {!nota && (
        <>
          <label className="field">
            <span className="field-label">¿Qué hay que hacer?</span>
            <textarea
              ref={notesRef}
              className="input notes"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. enviar el viernes por la transportadora"
            />
          </label>
          <div className="chips todo-chips" role="toolbar" aria-label="Atajos para qué hacer">
            {TODO.map((t) => <button key={t} type="button" className="chip" onClick={() => addTodo(t)}>{t}</button>)}
          </div>
        </>
      )}

      {/* recordar el...: ese dia sale arriba en "Por despachar" */}
      <div className="field">
        <span className="field-label">Recordar <small className="opt">si quieres</small></span>
        <div className="chips remind-pick" role="radiogroup" aria-label="Cuándo recordar">
          {[['', 'Sin fecha'], [today, 'Hoy'], [tomorrow, 'Mañana']].map(([v, l]) => (
            <button key={l} type="button" className="chip" role="radio" aria-checked={remind === v} onClick={() => setRemind(v)}>{l}</button>
          ))}
          <label className={`chip remind-day${remind && remind !== today && remind !== tomorrow ? ' on' : ''}`}>
            <span>Otro día</span>
            <input type="date" value={remind} min={today} onChange={(e) => setRemind(e.target.value)} aria-label="Recordar otro día" />
          </label>
        </div>
        {reminder && <span className="field-hint">{reminder.text}: ese día sale arriba en «Por despachar».</span>}
      </div>

      {/* lo que trae adentro, contado por talla (prendas que no son del inventario) */}
      {!nota && (
        <div className="field">
          <span className="field-label">Prendas por talla <small className="opt">si las cuentas</small></span>
          {counts.map((c) => {
            const total = c.rows.reduce((t, r) => t + r.qty, 0)
            return (
              <div className="pc-ref" key={c.key}>
                <div className="pc-ref-head">
                  <input className="input" value={c.name} maxLength={120} autoCapitalize="characters"
                         onChange={(e) => setCount(c.key, { name: e.target.value.toUpperCase() })}
                         placeholder="Ej. CAMISA HONDA ROJA" aria-label="Qué prenda es" />
                  <button type="button" className="rem-part-x" aria-label={`Quitar ${c.name || 'esta prenda'}`}
                          onClick={() => setCounts((cs) => cs.filter((x) => x.key !== c.key))}>
                    <Icon name="x" size={16} stroke={2.4} />
                  </button>
                </div>
                <div className="pc-sizes">
                  {c.rows.map((r) => (
                    <label key={r.size} className={`pc-size${r.qty ? ' on' : ''}`}>
                      <span>{r.size}</span>
                      <input type="number" inputMode="numeric" min="0" value={r.qty || ''} placeholder="0"
                             onChange={(e) => setQtyOf(c.key, r.size, e.target.value)} aria-label={`${c.name || 'Prenda'}, talla ${r.size}`} />
                    </label>
                  ))}
                </div>
                {addingSize === c.key ? (
                  <form className="rem-add" onSubmit={(e) => { e.preventDefault(); addSizeTo(c.key, e.currentTarget.elements.size.value) }}>
                    <input name="size" className="rem-code" placeholder="Talla, ej. XS o 32" autoFocus autoCapitalize="characters" />
                    <button className="btn btn-ink btn-sm">Agregar</button>
                  </form>
                ) : (
                  <div className="pc-ref-foot">
                    <button type="button" className="link-btn" onClick={() => setAddingSize(c.key)}><Icon name="plus" size={14} stroke={2.4} />Otra talla</button>
                    <b>{plural(total, 'prenda', 'prendas')}</b>
                  </div>
                )}
              </div>
            )
          })}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setCounts((cs) => [...cs, newCount()])}>
            <Icon name="plus" size={18} stroke={2.2} />{counts.length ? 'Otra prenda' : 'Contar prendas por talla'}
          </button>
          {counted > 0 && (
            <div className="pc-total">
              <span><b>{plural(counted, 'prenda', 'prendas')}</b> contadas · no es inventario</span>
              <button type="button" className="btn btn-ink btn-sm" disabled={pdfBusy} onClick={makePdf}>
                <Icon name="download" size={16} />{pdfBusy ? 'Armando…' : 'PDF del conteo'}
              </button>
            </div>
          )}
        </div>
      )}

      {!nota && (
        <div className="field">
          <span className="field-label">¿Dónde quedó?</span>
          <LocationPicker value={place} onChange={setPlace} ariaLabel="¿Dónde quedó?" fallbackLabel={parcel?.location_name || place}
                          groups={[{ label: 'De paso', options: [{ id: DISPATCH, name: 'Despacho (de paso)' }] }, ...groups]} />
          <span className="field-hint">No cuenta como inventario: queda en Resumen, en “Por despachar”, hasta que salga.</span>
        </div>
      )}
      {!nota && editing && showMap && known && (
        <button type="button" className="link-btn parcel-map" onClick={() => { close(); navigate(`/?loc=${encodeURIComponent(place)}`) }}>
          <Icon name="pin" size={14} stroke={2.2} />Ver {place} en la bodega
        </button>
      )}

      <div className="doc-footer">
        {problem && <p className="mode-hint">{problem}</p>}
        {editing ? (
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className="btn btn-ghost btn-lg" disabled={!!problem || busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn btn-ink btn-lg" onClick={leave}><Icon name="check" size={18} stroke={2.4} />{parcel.kind === 'nota' ? 'Listo' : 'Ya salió'}</button>
          </div>
        ) : (
          <button className="btn btn-lime btn-lg btn-block" disabled={!!problem || busy} onClick={save}>{busy ? 'Guardando…' : nota ? 'Anotar nota' : 'Anotar'}</button>
        )}
        {canDelete && (
          <button type="button" className="link-btn parcel-del" onClick={remove}>
            Borrar: lo anoté por error
          </button>
        )}
      </div>
    </>
  )
}

export default function ParcelSheet({ parcel = null, defaultLocation, defaultKind, showMap = true, onClose }) {
  return (
    <Sheet modal onClose={onClose} label={parcel ? parcelName(parcel) : defaultKind === 'nota' ? 'Anotar una nota' : 'Anotar algo de paso'}>
      <Form parcel={parcel} defaultLocation={defaultLocation} defaultKind={defaultKind} showMap={showMap} />
    </Sheet>
  )
}

// Lo que ya salio, con quien lo saco y cuando; "Volver" lo regresa a la lista.
function DoneList() {
  const showToast = useToast()
  const { data } = usePolling('/api/parcels?state=done&limit=60', { interval: 30000 })
  const back = async (p) => {
    try {
      await api.post(`/api/parcels/${p.id}/reopen`)
      showToast(`Volvió a la lista: ${parcelName(p)}`)
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo.', 'err')
    }
    revalidate('/api/parcels')
  }
  return (
    <>
      <SheetHeader title="Lo que ya salió" subtitle="Lo último que salió de paso: quién lo sacó y cuándo." />
      {!data ? <div className="skeleton" /> : data.length ? (
        <div className="card panel">
          {data.map((p) => (
            <div className="need parcel" key={p.id}>
              <span className="parcel-ico"><Icon name={parcelIcon(p)} size={20} /></span>
              <span className="need-t">
                <b>{p.kind === 'nota' ? p.notes : `${parcelName(p)}${p.owner ? ` · ${p.owner}` : ''}`}</b>
                {p.kind !== 'nota' && p.notes && <small className="note wrap">{p.notes}</small>}
                <small>{p.kind === 'nota' ? 'Lista' : 'Salió'} {fmtTime(p.done_at)} · {p.done_by}</small>
              </span>
              <button type="button" className="link-btn" onClick={() => back(p)}><Icon name="undo" size={14} stroke={2.2} />Volver</button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="check" title="Nada todavía">Lo que marques con “Ya salió” aparece aquí.</Empty>
      )}
    </>
  )
}

export function ParcelsDoneSheet({ onClose }) {
  return (
    <Sheet modal onClose={onClose} label="Lo que ya salió">
      <DoneList />
    </Sheet>
  )
}

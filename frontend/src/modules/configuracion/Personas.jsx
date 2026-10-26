import { useState } from 'react'
import { api, ApiError } from '../../core/api'
import { revalidate } from '../../core/useApi'
import { useAuth } from '../../core/AuthContext'
import { useToast } from '../../ui/ToastContext'
import { useConfirm } from '../../ui/ConfirmContext'
import Icon from '../../ui/Icon'
import Sheet, { SheetHeader } from '../../ui/Sheet'

// Configuracion > Equipo: las personas (rol y acceso) y el codigo para crear
// cuenta. Quitar el acceso no borra nada: su historial queda con su nombre.

const since = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')
  : '')

function Person({ p, me, busy, onChange }) {
  const admin = p.role === 'admin'
  return (
    <div className={`vl-row set-person${p.active ? '' : ' off'}`}>
      <div className="vl-head">
        <span className="vl-ico" aria-hidden="true">{(p.name || '?').charAt(0).toUpperCase()}</span>
        <span className="vl-t">
          <b>{p.name}{p.id === me && <span className="set-you">Tú</span>}</b>
          <small>{p.email}</small>
          <small>{admin ? 'Administrador' : 'Operador'}{p.created_at ? ` · desde ${since(p.created_at)}` : ''}</small>
        </span>
      </div>
      <div className="vl-actions">
        {p.active ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onChange(p, { role: admin ? 'operator' : 'admin' })}>
              {admin ? 'Quitar administrador' : 'Hacer administrador'}
            </button>
            {p.id !== me && (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => onChange(p, { active: false })}>
                Quitar acceso
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onChange(p, { active: true })}>
            Devolver acceso
          </button>
        )}
      </div>
    </div>
  )
}

const ASK = {
  admin: (p) => ({ title: `¿Hacer administrador a ${p.name}?`, body: 'Podrá cambiar la configuración, el equipo y borrar datos.', confirmLabel: 'Sí, hacerlo', danger: false }),
  operator: (p) => ({ title: `¿Quitarle lo de administrador a ${p.name}?`, body: 'Sigue entrando como operador: registra y consulta, pero no cambia la configuración.', confirmLabel: 'Sí, quitarlo' }),
  off: (p) => ({ title: `¿Quitarle el acceso a ${p.name}?`, body: 'No podrá entrar y su sesión se cierra. Lo que registró se queda en el historial con su nombre. Se puede devolver.', confirmLabel: 'Quitar acceso' }),
  on: (p) => ({ title: `¿Devolverle el acceso a ${p.name}?`, body: 'Vuelve a entrar con su correo y su contraseña de siempre.', confirmLabel: 'Devolver', danger: false }),
  self: () => ({ title: '¿Dejar de ser administrador?', body: 'Sigues entrando como operador. Para volver a serlo, otro administrador te lo devuelve.', confirmLabel: 'Sí, dejarlo' }),
}

const DONE = {
  admin: (p) => `${p.name} ahora es administrador`,
  operator: (p) => `${p.name} ahora es operador`,
  off: (p) => `${p.name} ya no tiene acceso`,
  on: (p) => `${p.name} tiene acceso otra vez`,
}

export default function PersonasSheet({ people, me, onPeople, onClose }) {
  const showToast = useToast()
  const confirm = useConfirm()
  const { user, updateUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const active = people.filter((p) => p.active)
  const off = people.filter((p) => !p.active)

  const change = async (p, cambio) => {
    const kind = cambio.role || (cambio.active ? 'on' : 'off')
    const self = p.id === me && kind === 'operator'
    if (!(await confirm(ASK[self ? 'self' : kind](p)))) return
    setBusy(true)
    try {
      const saved = await api.patch(`/api/users/${p.id}`, cambio)
      onPeople(people.map((x) => (x.id === saved.id ? saved : x)))
      if (self) {
        // ya no es administrador: Configuracion y el resto de la app cambian de una
        updateUser({ ...user, role: saved.role })
        showToast('Ahora eres operador')
        onClose()
        return
      }
      showToast(DONE[kind](p))
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo cambiar. Revisa la conexión.', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet modal onClose={onClose} label="Personas">
      <SheetHeader title="Personas" subtitle="Quién entra a la app y quién es administrador. Para sumar a alguien, compártele el código para unirse." />
      <div className="set-people">
        {active.map((p) => <Person key={p.id} p={p} me={me} busy={busy} onChange={change} />)}
      </div>
      {off.length > 0 && (
        <>
          <h3 className="set-sub">Sin acceso</h3>
          <div className="set-people">
            {off.map((p) => <Person key={p.id} p={p} me={me} busy={busy} onChange={change} />)}
          </div>
        </>
      )}
    </Sheet>
  )
}

export function CodigoSheet({ value, onClose }) {
  const showToast = useToast()
  const [code, setCode] = useState(value)
  const [busy, setBusy] = useState(false)
  const clean = code.trim()
  const ok = clean.length >= 4 && clean.length <= 40

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      showToast('Código copiado')
    } catch {
      showToast('No se pudo copiar. Escríbelo a mano.', 'err')
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/api/settings', { codigo_registro: clean })
      revalidate('/api/settings')
      showToast('Código cambiado: el de antes ya no sirve')
      onClose()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisa la conexión.', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet modal onClose={onClose} label="Código para unirse">
      <SheetHeader title="Código para unirse" subtitle="Lo pide la app al crear una cuenta nueva. Compártelo solo con quien vaya a trabajar en la bodega." />
      <div className="set-code">
        <span className="mono">{value}</span>
        <button type="button" className="btn btn-lime btn-sm" onClick={copy}><Icon name="copy" size={16} />Copiar</button>
      </div>
      <form onSubmit={save}>
        <label className="field">
          <span className="field-label">Cambiarlo por</span>
          <input className="input mono set-code-input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40}
                 autoCapitalize="off" autoComplete="off" spellCheck="false" />
          <span className="field-hint">De 4 a 40 letras o números. Al cambiarlo, el de antes deja de servir; las cuentas que ya existen siguen igual.</span>
        </label>
        <button type="submit" className="btn btn-lime btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || !ok || clean === value}>
          {busy ? 'Guardando…' : 'Cambiar código'}
        </button>
      </form>
    </Sheet>
  )
}

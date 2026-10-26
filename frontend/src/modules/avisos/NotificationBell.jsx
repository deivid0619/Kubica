import { useState } from 'react'
import { useNotificationPrefs } from './NotificationPrefsContext'
import { useAuth } from '../../core/AuthContext'
import { savePushPrefs } from './push'
import Icon from '../../ui/Icon'
import PushBox from './PushBox'
import { NoticesBell } from './Notices'

const OPTIONS = [
  { key: 'in', label: 'Entradas' },
  { key: 'out', label: 'Salidas' },
  { key: 'set', label: 'Conteos' },
  { key: 'low', label: 'Bajo mínimo' },
  { key: 'docs', label: 'Facturas y remisiones' },
]

// Que avisos quiere cada persona del equipo y si le llegan al celular. Lo usan
// la campana y Configuracion: es el mismo estado, no se pueden contradecir.
export function NotificationPrefs() {
  const { prefs, setPref } = useNotificationPrefs()
  const [push, setPush] = useState('checking')

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPref(key, next[key])
    if (push === 'on') savePushPrefs(next).catch(() => {})
  }

  return (
    <>
      {OPTIONS.map((o) => (
        <div key={o.key} className="menu-check">
          {o.label}
          <button
            className="switch"
            role="switch"
            aria-checked={!!prefs[o.key]}
            aria-label={`Avisar ${o.label.toLowerCase()}`}
            onClick={() => toggle(o.key)}
          />
        </div>
      ))}
      <p className="menu-note">No te avisa de lo que haces tú, salvo cuando algo queda bajo el mínimo.</p>
      <PushBox prefs={prefs} onState={setPush} />
    </>
  )
}

function TeamBell() {
  const [open, setOpen] = useState(false)
  const { prefs } = useNotificationPrefs()
  const anyOn = Object.values(prefs).some(Boolean)

  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Avisos" aria-expanded={open}>
        <Icon name="bell" />
        {anyOn && <span className="pip" />}
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="menu wide">
            <div className="menu-head">
              <b>Avisos</b>
              <span>Cuando otra persona registre:</span>
            </div>
            <NotificationPrefs />
          </div>
        </>
      )}
    </div>
  )
}

// El equipo elige que avisos quiere; la cuenta "solo ver" ve los que le mandan
export default function NotificationBell() {
  const { isViewer } = useAuth()
  return isViewer ? <NoticesBell /> : <TeamBell />
}

import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { WELCOME, useAuth } from './core/AuthContext'
import NavBar from './ui/NavBar'
import NotificationBell from './modules/avisos/NotificationBell'
import OfflineBar from './ui/OfflineBar'
import Icon, { BrandMark } from './ui/Icon'
import { datosMarca } from './core/marca'
import Boot from './ui/Boot'
import { useMovementNotifications } from './modules/avisos/useMovementNotifications'
import { useToast } from './ui/ToastContext'
import Login from './modules/auth/Login'
import Scan from './modules/escaneo/Scan'
import Inventory from './modules/inventario/Inventory'
import Reserve from './modules/reserva/Reserve'
import Summary from './modules/resumen/Summary'
import Count from './modules/conteo/Count'
import Reports from './modules/reportes/Reports'
import Settings from './modules/configuracion/Settings'

// el 3D (three.js) es lo mas pesado: se descarga aparte, asi el login y las
// demas pantallas abren rapido en el celular
const Warehouse = lazy(() => import('./modules/bodega/Warehouse'))

function RequireAuth({ children }) {
  const { token, ready } = useAuth()
  if (!ready) return <Boot /> // nunca en blanco: la marca y la barra mientras se conecta
  if (!token) return <Navigate to="/login" replace />
  return children
}

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'B'

function AccountMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="avatar" onClick={() => setOpen((o) => !o)} aria-label="Tu cuenta" aria-expanded={open}>
        {initials(user?.name)}
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="menu" role="menu">
            <div className="menu-head">
              <b>{user?.name}</b>
              <span>{user?.email} · {user?.role === 'admin' ? 'Administrador' : 'Operador'}</span>
            </div>
            {/* instalar, avisos y lo demas: en Configuracion */}
            <button className="menu-item" role="menuitem" onClick={() => go('/settings')}>
              <Icon name="pencil" size={20} /> Configuración
            </button>
            <button className="menu-item" role="menuitem" onClick={logout}>
              <Icon name="logout" size={20} /> Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Shell() {
  useMovementNotifications()
  const { isViewer, user } = useAuth()
  const showToast = useToast()
  // al entrar con el enlace para ver: "Hola, Gabriel" (una vez)
  useEffect(() => {
    let name = null
    try {
      name = sessionStorage.getItem(WELCOME)
      sessionStorage.removeItem(WELCOME)
    } catch { /* sin almacenamiento */ }
    if (name !== null && isViewer) showToast(`Hola${name ? `, ${name}` : ''}`)
  }, [isViewer, showToast])
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label={`${datosMarca().app}, inicio`}>
          <BrandMark size={26} />
          <span className="brand-word">{datosMarca().nombre}</span>
        </Link>
        <div className="topbar-actions">
          {isViewer && (
            <span className="view-chip" title="Puedes recorrer todo; los cambios no se guardan">
              {user?.name && user.name !== 'Solo ver' ? <><b>{user.name}</b> · solo ver</> : 'Solo ver'}
            </span>
          )}
          <NotificationBell />
          <AccountMenu />
        </div>
      </header>
      <OfflineBar />
      <main>
        <Routes>
          <Route path="/" element={<Suspense fallback={<div className="page full wh"><Boot variant="page" label="Cargando la bodega 3D…" /></div>}><Warehouse /></Suspense>} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/reserve" element={<Reserve />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/count" element={<Count />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/orders" element={<Navigate to="/summary" replace />} />
          <Route path="/history" element={<Navigate to="/summary" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
    </Routes>
  )
}

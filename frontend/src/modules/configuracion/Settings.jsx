import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../core/api'
import { useAuth } from '../../core/AuthContext'
import { useInstall } from '../../core/install'
import { datosMarca } from '../../core/marca'
import { downloadCsv } from '../../core/utils'
import { useToast } from '../../ui/ToastContext'
import { useConfirm } from '../../ui/ConfirmContext'
import Icon from '../../ui/Icon'
import Sheet, { SheetHeader } from '../../ui/Sheet'
import ResetSheet from '../resumen/ResetSheet'
import ViewLink from '../auth/ViewLink'
import { NotificationPrefs } from '../avisos/NotificationBell'
import { getTema, setTema } from '../../core/tema'
import { useAjustes } from '../../core/useApi'
import EmpresaSheet from './Empresa'
import PersonasSheet, { CodigoSheet } from './Personas'
import { tallasLabel, tiendaLabel } from './empresaParts'
import { sectionsFor } from './sections'
import './configuracion.css'

const stamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Una fila de Configuracion: icono, titulo, una linea y a la derecha su valor
// o una flecha. Con onClick es un boton; tone 'hi' (amarillo) o 'danger'.
export function SettingsRow({ icon, title, hint, value, tone, onClick, children }) {
  const body = (
    <>
      {icon && <span className={`set-ico${tone ? ` ${tone}` : ''}`}><Icon name={icon} size={20} /></span>}
      <span className={`set-t${tone === 'danger' ? ' danger' : ''}`}>
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {value != null && <span className="set-v">{value}</span>}
      {children}
      {onClick && !children && <Icon name="arrowRight" size={16} stroke={2.2} className="set-chev" />}
    </>
  )
  return onClick
    ? <button type="button" className="set-row" onClick={onClick}>{body}</button>
    : <div className="set-row">{body}</div>
}

function Section({ title, children }) {
  return (
    <section className="set-sec">
      <h2 className="h-sec">{title}</h2>
      <div className="set-card">{children}</div>
    </section>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const install = useInstall()
  const showToast = useToast()
  const confirm = useConfirm()
  const [sheet, setSheet] = useState(null) // reset | links | avisos | instalar | nombre | tallas | tienda | personas | codigo
  const [people, setPeople] = useState(null)
  const [demoOn, setDemoOn] = useState(null)
  const [tema, setTemaState] = useState(getTema)
  const { data: ajustes } = useAjustes()
  const sections = sectionsFor(user?.role)
  const has = (s) => sections.includes(s)

  useEffect(() => {
    if (has('datos')) api.get('/api/reports/demo').then((r) => setDemoOn(r.demo)).catch(() => {})
    if (has('equipo')) api.get('/api/users').then(setPeople).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  const toEditor = (soon) => {
    if (soon) showToast('Pronto podrás armarla con fotos. Por ahora, edítala a mano.')
    navigate('/?editar=1')
  }

  const backup = async () => {
    try {
      downloadCsv(await api.get('/api/reports/inventory.csv'), `respaldo-inventario-${stamp()}.csv`)
      downloadCsv(await api.get('/api/reports/movements.csv'), `respaldo-historial-${stamp()}.csv`)
      showToast('Respaldo descargado: inventario e historial')
    } catch {
      showToast('No se pudo descargar el respaldo.', 'err')
    }
  }

  const toggleDemo = async () => {
    const ok = await confirm(demoOn
      ? { title: '¿Quitar los datos de prueba?', body: 'Se borran las prendas y los movimientos de ejemplo. Lo que registraste tú no se toca.', confirmLabel: 'Sí, quitarlos' }
      : { title: '¿Cargar datos de prueba?', body: 'Se agregan prendas y movimientos de ejemplo para ver cómo se ve la app. Se quitan con el mismo interruptor.', confirmLabel: 'Cargar', danger: false })
    if (!ok) return
    try {
      const res = await api.post('/api/reports/demo')
      setDemoOn(res.demo)
      showToast(res.demo ? 'Datos de prueba cargados' : 'Datos de prueba quitados')
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo cambiar los datos de prueba.', 'err')
    }
  }

  const doInstall = async () => {
    if (install.canPrompt) {
      if (await install.prompt()) showToast(`${datosMarca().app} quedó instalada en este dispositivo`)
    } else {
      setSheet('instalar')
    }
  }

  return (
    <section className="page" aria-label="Configuración">
      <div className="page-inner">
        <div className="page-head">
          <h1 className="display">Configuración</h1>
          <p className="lede">Deja {datosMarca().app} a la medida de tu empresa.</p>
        </div>

        {has('apariencia') && (
          <Section title="Apariencia">
            <SettingsRow title="Modo oscuro" hint="Automático sigue el modo de tu celular." />
            <div className="set-seg" role="radiogroup" aria-label="Modo oscuro">
              {[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([t, label]) => (
                <button key={t} type="button" role="radio" aria-checked={tema === t} onClick={() => { setTema(t); setTemaState(t) }}>
                  {label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {has('bodega') && (
          <Section title="Tu bodega">
            <SettingsRow icon="camera" tone="hi" title="Armar la bodega con fotos" hint="Tomas fotos y la app arma el 3D. Si quedó mal, lo repites con mejor luz." onClick={() => toEditor(true)} />
            <SettingsRow icon="pencil" title="Editar a mano" hint="Mover, agregar o quitar muebles." onClick={() => toEditor(false)} />
            <SettingsRow icon="trash" tone="danger" title="Empezar de cero" hint="Deja la bodega vacía, con respaldo antes." onClick={() => setSheet('reset')} />
          </Section>
        )}

        {has('empresa') && (
          <Section title="Tu empresa">
            <SettingsRow icon="receipt" title="Nombre de la empresa" hint="Sale en los PDF, el Excel y los enlaces."
                         value={ajustes ? ajustes.empresa_nombre || 'Sin poner' : '…'} onClick={ajustes ? () => setSheet('nombre') : undefined} />
            <SettingsRow icon="hanger" title="Tallas que manejan" hint="Para contar por talla al recibir."
                         value={ajustes ? tallasLabel(ajustes.tallas) : '…'} onClick={ajustes ? () => setSheet('tallas') : undefined} />
            <SettingsRow icon="tag" title="Tienda en línea" hint="Llena nombre, foto y precio solos."
                         value={ajustes ? (ajustes.catalogo_url ? tiendaLabel(ajustes.catalogo_url) : 'Sin conectar') : '…'}
                         onClick={ajustes ? () => setSheet('tienda') : undefined} />
          </Section>
        )}

        {has('equipo') && (
          <Section title="Equipo">
            <SettingsRow icon="user" title="Personas" hint="Quién entra y quién es administrador."
                         value={people ? people.filter((p) => p.active).length : '…'} onClick={people ? () => setSheet('personas') : undefined} />
            <SettingsRow icon="plus" title="Código para unirse" hint="Lo que pide la app al crear cuenta."
                         value={ajustes?.codigo_registro ? <span className="mono">{ajustes.codigo_registro}</span> : '…'}
                         onClick={ajustes?.codigo_registro ? () => setSheet('codigo') : undefined} />
            <SettingsRow icon="search" title="Enlaces «solo ver»" hint="Para quien solo consulta: entra sin contraseña y no cambia nada." onClick={() => setSheet('links')} />
          </Section>
        )}

        {has('avisos') && (
          <Section title="Avisos">
            <SettingsRow icon="bell" title="Avisos al celular" hint="Entradas, salidas, conteos, bajo el mínimo…" onClick={() => setSheet('avisos')} />
          </Section>
        )}

        {has('datos') && (
          <Section title="Datos">
            <SettingsRow icon="download" title="Descargar respaldo" hint="Inventario e historial, en archivos para Excel." onClick={backup} />
            <SettingsRow title="Datos de prueba" hint="Para mostrar la app sin datos reales.">
              <button type="button" className="switch" role="switch" aria-checked={!!demoOn} aria-label="Datos de prueba" disabled={demoOn === null} onClick={toggleDemo} />
            </SettingsRow>
          </Section>
        )}

        {has('cuenta') && (
          <Section title="Cuenta">
            {!install.standalone && <SettingsRow icon="install" title="Instalar en este celular" onClick={doInstall} />}
            <SettingsRow icon="logout" title="Cerrar sesión" hint={user?.email} onClick={logout} />
          </Section>
        )}
      </div>

      {sheet === 'reset' && <ResetSheet onClose={() => setSheet(null)} />}
      {['nombre', 'tallas', 'tienda'].includes(sheet) && ajustes && <EmpresaSheet kind={sheet} ajustes={ajustes} onClose={() => setSheet(null)} />}
      {sheet === 'personas' && people && <PersonasSheet people={people} me={user?.id} onPeople={setPeople} onClose={() => setSheet(null)} />}
      {sheet === 'codigo' && ajustes?.codigo_registro && <CodigoSheet value={ajustes.codigo_registro} onClose={() => setSheet(null)} />}
      {sheet === 'links' && (
        <Sheet modal onClose={() => setSheet(null)} label="Enlaces solo ver">
          <SheetHeader title="Enlaces «solo ver»" subtitle="Uno por persona: ve todo en vivo y no puede cambiar nada." />
          <ViewLink />
        </Sheet>
      )}
      {sheet === 'avisos' && (
        <Sheet modal onClose={() => setSheet(null)} label="Avisos">
          <SheetHeader title="Avisos" subtitle="Cuando otra persona registre:" />
          <div className="set-prefs"><NotificationPrefs /></div>
        </Sheet>
      )}
      {sheet === 'instalar' && (
        <Sheet modal onClose={() => setSheet(null)} label="Instalar la app">
          <SheetHeader title={`Instalar ${datosMarca().app}`} subtitle="Queda como una app más, con su ícono y en pantalla completa." />
          {install.ios ? (
            <ol className="install-steps">
              <li>Toca el botón <b>Compartir</b> de Safari (el cuadro con la flecha hacia arriba).</li>
              <li>Elige <b>Agregar a pantalla de inicio</b>.</li>
              <li>Toca <b>Agregar</b>. El ícono de {datosMarca().app} aparece con tus apps.</li>
            </ol>
          ) : (
            <ol className="install-steps">
              <li>Abre el menú del navegador (los tres puntos).</li>
              <li>Elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</li>
              <li>Confirma. El ícono de {datosMarca().app} aparece con tus apps.</li>
            </ol>
          )}
        </Sheet>
      )}
    </section>
  )
}

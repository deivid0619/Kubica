// Lo comun de las dos paginas (espanol en index.html, ingles en en/index.html).
// Cada pagina define antes sus TEXTOS: saludo de WhatsApp, asunto del correo y
// lo que muestra la estanteria.

// ===== Contacto: cambiar solo aqui (sirve para los dos idiomas) =====
// whatsapp: el numero con indicativo, sin + ni espacios (ej.: 573001234567)
const CONTACTO = {
  whatsapp: '573196587105',
  correo: 'kubicacol@gmail.com',
}

// ===== La demo publica (render-demo.yaml en el repo): cambiar solo aqui =====
// app: donde se abre (entra sola como "solo ver"); api: su servidor
const DEMO = {
  app: 'https://kubica-demo.onrender.com/?ver=demo',
  api: 'https://kubica-demo-api.onrender.com',
}

;(function contacto() {
  document.querySelectorAll('[data-whatsapp]').forEach((a) => {
    if (!CONTACTO.whatsapp) return
    const texto = a.getAttribute('data-whatsapp') || TEXTOS.saludo
    a.href = `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`
    a.target = '_blank'
    a.rel = 'noopener'
  })
  document.querySelectorAll('[data-correo]').forEach((a) => {
    if (!CONTACTO.correo) { a.hidden = true; return }
    a.href = `mailto:${CONTACTO.correo}?subject=${encodeURIComponent(TEXTOS.asunto)}`
  })
  const via = document.querySelector('[data-via]')
  if (via) {
    const tel = CONTACTO.whatsapp.replace(/^57(\d{3})(\d{3})(\d{4})$/, '+57 $1 $2 $3')
    via.textContent = [tel, CONTACTO.correo].filter(Boolean).join(' · ')
  }
})()

// los botones "Ver la demo" la abren en otra pestana. Su servidor se duerme si
// nadie la usa y tarda en despertar: se le avisa con tiempo, una sola vez (a
// los pocos segundos de abrir la pagina o al acercarse a un boton)
;(function demo() {
  const links = document.querySelectorAll('[data-demo]')
  if (!links.length || !DEMO.app) return
  let woken = false
  const wake = () => {
    if (woken || !DEMO.api) return
    woken = true
    fetch(`${DEMO.api}/api/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
  }
  links.forEach((a) => {
    a.href = DEMO.app
    a.target = '_blank'
    a.rel = 'noopener'
    for (const ev of ['pointerenter', 'focus', 'touchstart']) a.addEventListener(ev, wake, { once: true, passive: true })
  })
  setTimeout(wake, 4000)
})()

// la barra de arriba muestra su borde al bajar
;(function barra() {
  const top = document.getElementById('top')
  const on = () => top.classList.toggle('scrolled', window.scrollY > 8)
  on()
  window.addEventListener('scroll', on, { passive: true })
})()

// la app por dentro: cada pestana cambia la captura (tambien con las flechas)
;(function capturas() {
  const viewer = document.querySelector('[data-shots]')
  if (!viewer) return
  const tabs = [...viewer.querySelectorAll('[role="tab"]')]
  const list = tabs[0].parentElement

  const select = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on
    }
    if (focus) tab.focus()
    // en celular la fila se desliza para que la pestana elegida se vea
    if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' })
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t))
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
      if (!step) return
      e.preventDefault()
      select(tabs[(i + step + tabs.length) % tabs.length], true)
    })
  })
  tabs.forEach((t, i) => { t.tabIndex = i ? -1 : 0 })

  // al acercarse a la seccion se cargan todas, para que el cambio de pestana sea inmediato
  new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting)) return
    viewer.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager' })
    obs.disconnect()
  }, { rootMargin: '400px' }).observe(viewer)
})()

// la estanteria: una canasta se enciende y la etiqueta dice que hay ahi
;(function buscador() {
  const ITEMS = TEXTOS.buscador
  const art = document.querySelector('.finder-art')
  const svg = art.querySelector('svg')
  const label = art.querySelector('.label')
  const lead = svg.querySelector('.lead')
  const halo = svg.querySelector('.lead-halo')
  const dot = svg.querySelector('.dot')
  const field = (f) => label.querySelector(`[data-f="${f}"]`)
  let i = 0

  // punto de la etiqueta (borde izquierdo, a la altura del codigo) en coordenadas del dibujo
  const labelPoint = () => {
    const s = svg.getBoundingClientRect()
    const l = label.getBoundingClientRect()
    const k = 600 / s.width
    return { x: (l.left - s.left) * k - 2, y: (l.top - s.top + l.height * 0.32) * k }
  }

  const draw = () => {
    const item = ITEMS[i]
    const a = svg.querySelector(`#bin-${item.code} .anchor`)
    const ax = +a.getAttribute('cx'), ay = +a.getAttribute('cy')
    const p = labelPoint()
    const elbow = Math.min(p.x - 16, 370)
    const d = `M ${ax} ${ay} H ${elbow} L ${p.x} ${p.y}`
    for (const el of [lead, halo]) {
      el.setAttribute('d', d)
      el.style.d = `path("${d}")`
    }
    dot.setAttribute('cx', ax); dot.setAttribute('cy', ay)
  }

  const show = () => {
    const item = ITEMS[i]
    svg.querySelectorAll('.bin.on').forEach((b) => b.classList.remove('on'))
    svg.querySelector(`#bin-${item.code}`).classList.add('on')
    field('code').textContent = item.code
    field('name').textContent = item.name
    field('meta').textContent = item.meta
    draw()
  }

  show()
  requestAnimationFrame(() => art.classList.add('ready'))
  window.addEventListener('resize', draw)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  setInterval(() => {
    if (document.hidden) return
    label.classList.add('swap')
    setTimeout(() => {
      i = (i + 1) % ITEMS.length
      show()
      label.classList.remove('swap')
    }, 200)
  }, 3400)
})()

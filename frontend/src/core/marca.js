// La marca de esta instalacion: 'kubica' (la propia: grafito y amarillo) o la
// de una empresa (hoy 'pigmalion'). index.html la pone en <html data-marca>
// antes de que cargue la app: VITE_MARCA al construir, o ?marca= en el navegador.
// Los colores de las pantallas estan en styles/global.css y styles/marcas.css;
// aqui solo lo que no es CSS: el nombre de la app, el de la empresa en PDFs y
// enlaces, y los colores del 3D y de los PDF (en RGB).

const MARCAS = {
  kubica: {
    nombre: 'kubica', // como se escribe en la barra (en mayusculas por CSS)
    app: 'Kubica',
    empresa: '',
    ink: [21, 23, 28],
    accent: [245, 183, 0],
    gray: [106, 100, 88],
    line: [229, 224, 213],
    soft: [246, 243, 236],
    onInk: [189, 184, 174], // texto suave sobre la barra oscura
  },
  pigmalion: {
    nombre: 'bodega',
    app: 'Bodega',
    empresa: 'Pigmalion',
    ink: [11, 11, 11],
    accent: [192, 255, 0],
    gray: [115, 118, 111],
    line: [222, 226, 218],
    soft: [243, 246, 239],
    onInk: [185, 189, 182],
  },
}

const PROPIA = 'kubica'

export function marca() {
  const id = typeof document !== 'undefined' ? document.documentElement.dataset.marca : ''
  return MARCAS[id] ? id : PROPIA
}

export function datosMarca() {
  return MARCAS[marca()]
}

// [r, g, b] -> 0xRRGGBB, para Three.js
export const hex = ([r, g, b]) => (r << 16) | (g << 8) | b

// "Kubica", o "Pigmalion · Bodega" en la instalacion de una empresa
export function nombreApp() {
  const { app, empresa } = datosMarca()
  return empresa ? `${empresa} · ${app}` : app
}

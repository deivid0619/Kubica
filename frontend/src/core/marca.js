// La marca de esta instalacion: 'bodega' (la propia, celeste) o la de una
// empresa (hoy 'pigmalion'). index.html la pone en <html data-marca> antes de
// que cargue la app: VITE_MARCA al construir, o ?marca= en el navegador.
// Los colores de las pantallas estan en styles/global.css y styles/marcas.css;
// aqui solo lo que no es CSS: el nombre en PDFs y enlaces, y los colores del
// 3D y de los PDF (en RGB).

const MARCAS = {
  bodega: {
    empresa: '',
    ink: [11, 18, 32],
    accent: [56, 182, 255],
    gray: [98, 107, 124],
    line: [221, 226, 233],
    soft: [242, 245, 249],
    onInk: [181, 187, 197], // texto suave sobre la barra oscura
  },
  pigmalion: {
    empresa: 'Pigmalion',
    ink: [11, 11, 11],
    accent: [192, 255, 0],
    gray: [115, 118, 111],
    line: [222, 226, 218],
    soft: [243, 246, 239],
    onInk: [185, 189, 182],
  },
}

export function marca() {
  const id = typeof document !== 'undefined' ? document.documentElement.dataset.marca : ''
  return MARCAS[id] ? id : 'bodega'
}

export function datosMarca() {
  return MARCAS[marca()]
}

// [r, g, b] -> 0xRRGGBB, para Three.js
export const hex = ([r, g, b]) => (r << 16) | (g << 8) | b

// "Pigmalion · Bodega" o solo "Bodega"
export function nombreApp() {
  const { empresa } = datosMarca()
  return empresa ? `${empresa} · Bodega` : 'Bodega'
}

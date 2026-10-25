import { existsSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// La marca de esta instalacion (ver src/core/marca.js). VITE_MARCA=pigmalion
// deja los colores, el logo y los iconos de Pigmalion; sin nada, la marca
// propia de Bodega. Los iconos de una marca son public/<icono>-<marca>.<ext>.
function marca(id) {
  const icono = (file) => {
    const own = file.replace(/(\.\w+)$/, `-${id}$1`)
    return id !== 'bodega' && existsSync(new URL(`./public${own}`, import.meta.url)) ? own : file
  }
  return {
    name: 'bodega-marca',
    transformIndexHtml: (html) => ['/favicon.svg', '/favicon-32.png', '/manifest.json', '/apple-touch-icon.png']
      .reduce((h, file) => h.replace(`"${file}"`, `"${icono(file)}"`), html)
      .replaceAll('__MARCA__', id),
  }
}

// Bodega tiene puertos propios: pagina 5190 y servidor 8090. Turify, el otro
// proyecto de esta maquina, usa 5173, 5180, 8000 y 8001; compartir puerto
// mezclaria la sesion y los datos de los dos en el navegador. strictPort: si
// el puerto esta ocupado, Vite falla en vez de saltar a otro.
export default defineConfig(({ mode }) => ({
  plugins: [react(), marca(loadEnv(mode, process.cwd(), '').VITE_MARCA || 'bodega')],
  server: {
    port: 5190,
    strictPort: true,
    // en todas las direcciones: "localhost" aqui es solo IPv6 (::1) y asi no
    // abria en 127.0.0.1 ni desde el celular en el mismo wifi
    host: true,
    proxy: {
      '/api': {
        // 127.0.0.1 explicito, no "localhost": en esta maquina a veces resuelve
        // a ::1 (IPv6) y el backend solo escucha en IPv4, lo que daba 502.
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },
  // la version de produccion instala el service worker: tampoco en el 4173 de todos
  preview: {
    port: 4190,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
  },
}))

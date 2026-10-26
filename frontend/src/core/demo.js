// La demo publica (otra copia en Render con una bodega de ejemplo, ver
// render-demo.yaml): quien abre la direccion entra solo como "Solo ver" con
// esta llave, y una barra arriba dice como pedirla por WhatsApp. Vacias en
// cualquier instalacion de verdad: nada de esto aparece.
export const DEMO_KEY = import.meta.env.VITE_DEMO_KEY || ''
// el numero con indicativo, sin + ni espacios (ej.: 573001234567)
const WHATSAPP = import.meta.env.VITE_DEMO_WHATSAPP || ''

export const demoWhatsapp = () => WHATSAPP
  ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, vi la demo de Kubica y quiero saber más para mi bodega.')}`
  : ''

// Que secciones de Configuracion ve cada quien: el administrador todas; el
// operador lo suyo (apariencia, avisos, cuenta); la cuenta "solo ver" solo
// apariencia y su cuenta. El orden es el de la pantalla.
const ALL = ['apariencia', 'bodega', 'empresa', 'equipo', 'avisos', 'datos', 'cuenta']
const BY_ROLE = {
  admin: ALL,
  operator: ['apariencia', 'avisos', 'cuenta'],
  viewer: ['apariencia', 'cuenta'],
}

export function sectionsFor(role) {
  return BY_ROLE[role] || BY_ROLE.viewer
}

// El PDF de un conteo de lo que esta de paso: que prendas venian, cuantas de
// cada talla y el total, con de quien es y que hacer. Son prendas que no son
// del inventario (se cuentan y se envian). Se arma en el celular en el
// momento; no se guarda. jsPDF se carga solo al pedirlo.
import { groupItems, itemsTotal } from './parcelParts'
import { sizeRank } from '../../core/utils'

const INK = [11, 11, 11]
const LIME = [192, 255, 0]
const GRAY = [115, 118, 111]
const LINE = [222, 226, 218]
const SOFT = [243, 246, 239]

// data: { title, owner, notes, place, by, when, items: [{ name, size, qty }] }
export async function parcelPdf({ title, owner, notes, place, by, when, items }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 14
  const groups = groupItems(items)
  const total = itemsTotal(items)
  const sizes = [...new Set((items || []).map((it) => it.size || ''))].sort((a, b) => sizeRank(a) - sizeRank(b))

  const text = (s, x, yy, { size = 10, bold = false, color = INK, align } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.text(String(s), x, yy, align ? { align } : undefined)
  }

  // encabezado: la marca y el titulo
  pdf.setFillColor(...INK)
  pdf.rect(0, 0, W, 24, 'F')
  pdf.setFillColor(...LIME)
  pdf.rect(0, 24, W, 1.2, 'F')
  text('Pigmalion · Bodega · de paso', M, 9, { size: 9, color: [185, 189, 182] })
  text(title, M, 18, { size: 17, bold: true, color: [255, 255, 255] })
  let y = 33

  const info = [owner && `De / para: ${owner}`, place && `Dónde: ${place}`, by && `Contó: ${by}`, when && `Fecha: ${when}`].filter(Boolean)
  if (info.length) {
    const lines = pdf.setFont('helvetica', 'normal').setFontSize(9.5).splitTextToSize(info.join('   ·   '), W - 2 * M)
    text(lines.join('\n'), M, y, { size: 9.5, color: GRAY })
    y += lines.length * 4.4 + 1.5
  }
  if (notes) {
    const lines = pdf.setFont('helvetica', 'normal').setFontSize(9.5).splitTextToSize(`Qué hacer: ${notes}`, W - 2 * M)
    text(lines.join('\n'), M, y, { size: 9.5 })
    y += lines.length * 4.4 + 1.5
  }

  // los totales, grandes
  const box = (label, value, x) => {
    pdf.setFillColor(...SOFT)
    pdf.roundedRect(x, y, 56, 17, 2.5, 2.5, 'F')
    text(label, x + 4, y + 6, { size: 8.5, color: GRAY })
    text(value, x + 4, y + 14, { size: 15, bold: true })
  }
  box('Prendas contadas', `${total}`, M)
  box('Referencias', `${groups.length}`, M + 60)
  y += 24

  // la tabla: una fila por prenda y una columna por talla (si son muchas tallas, una fila por talla)
  const matrix = sizes.length <= 9
  const nameW = matrix ? 64 : 110
  const totalW = 20
  const cols = matrix
    ? [{ label: 'Prenda', w: nameW }, ...sizes.map((s) => ({ label: s || 'Única', w: (W - 2 * M - nameW - totalW) / sizes.length, right: true })), { label: 'Total', w: totalW, right: true }]
    : [{ label: 'Prenda', w: nameW }, { label: 'Talla', w: W - 2 * M - nameW - totalW }, { label: 'Cantidad', w: totalW, right: true }]
  const head = () => {
    pdf.setFillColor(...INK)
    pdf.rect(M, y, W - 2 * M, 7.5, 'F')
    let x = M
    for (const c of cols) {
      text(c.label, c.right ? x + c.w - 2 : x + 2, y + 5, { size: 8.5, bold: true, color: [255, 255, 255], align: c.right ? 'right' : undefined })
      x += c.w
    }
    y += 7.5
  }
  const row = (cells, { h = 7, shade = false, bold = false } = {}) => {
    if (y + h > H - 18) {
      pdf.addPage()
      y = M
      head()
    }
    if (shade) {
      pdf.setFillColor(...SOFT)
      pdf.rect(M, y, W - 2 * M, h, 'F')
    }
    let x = M
    cells.forEach((c, i) => {
      const col = cols[i]
      text(c, col.right ? x + col.w - 2 : x + 2, y + h / 2 + 1.4, { size: 9, bold: bold || i === 0 || i === cells.length - 1, align: col.right ? 'right' : undefined })
      x += col.w
    })
    y += h
    pdf.setDrawColor(...LINE)
    pdf.setLineWidth(0.2)
    pdf.line(M, y, W - M, y)
  }
  head()
  groups.forEach((g, gi) => {
    const name = pdf.setFont('helvetica', 'bold').setFontSize(9).splitTextToSize(g.name, nameW - 4)
    const h = Math.max(7, 2.6 + name.length * 4)
    if (matrix) {
      const by = new Map(g.rows.map((r) => [r.size, r.qty]))
      row([name.join('\n'), ...sizes.map((s) => by.get(s) || '—'), g.total], { h, shade: gi % 2 === 1 })
    } else {
      g.rows.forEach((r, i) => row([i === 0 ? name.join('\n') : '', r.size || 'Única', r.qty], { h: i === 0 ? h : 7, shade: gi % 2 === 1 }))
    }
  })
  // la fila del total
  if (matrix) {
    const per = sizes.map((s) => (items || []).filter((it) => (it.size || '') === s).reduce((t, it) => t + it.qty, 0))
    pdf.setFillColor(...LIME)
    if (y + 8 <= H - 18) pdf.rect(M, y, W - 2 * M, 8, 'F')
    row(['Total', ...per, total], { h: 8, bold: true })
  } else {
    row(['Total', '', total], { h: 8, bold: true })
  }

  // al pie de cada hoja: cuando se genero y la pagina
  const now = new Date().toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    text(`Generado el ${now} · no es inventario de la bodega: se contó para enviarlo`, M, H - 8, { size: 7.5, color: GRAY })
    text(`Página ${p} de ${pages}`, W - M, H - 8, { size: 7.5, color: GRAY, align: 'right' })
  }
  return pdf.output('blob')
}

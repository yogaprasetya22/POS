import type { Product } from '@shared/types/contracts'
import type { Barcode, Ingredient, Recipe } from './data'

/*
 * Template & import Excel untuk Stok bahan. exceljs (besar) hanya dimuat saat tombol Excel dipakai.
 * Baris yang kolom pertamanya diawali "Contoh" dilewati saat import.
 */

const BAHAN = 'Bahan'
const RESEP = 'Resep'
const BAHAN_COLS = ['Nama bahan', 'Satuan', 'Batas minimum', 'Harga per satuan (Rp)', 'Satuan beli', 'Isi per satuan beli', 'Barcode', 'Stok awal (khusus bahan baru)'] as const
const RESEP_COLS = ['Nama menu', 'Nama bahan', 'Takaran per porsi', 'Satuan (info saja)'] as const

const loadExcel = async () => (await import('exceljs')).default

/** Unduh template berisi data toko saat ini, siap diedit lalu di-import kembali. */
export async function downloadTemplate(storeName: string, items: Ingredient[], recipes: Recipe[], barcodes: Barcode[], products: Product[]) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = storeName

  const help = wb.addWorksheet('Petunjuk')
  help.columns = [{ width: 110 }]
  ;[
    'CARA MENGISI TEMPLATE INVENTORY STOCK',
    '',
    '1. Sheet "Bahan": satu baris = satu bahan. Nama bahan harus unik.',
    '   - Satuan: satuan yang dipakai di resep, mis. gram, ml, pcs. Satuan bahan yang sudah ada tidak bisa diubah lewat import.',
    '   - Batas minimum: di bawah angka ini muncul peringatan "hampir habis".',
    '   - Harga per satuan: harga beli per satuan pakai (mis. per gram). Dipakai untuk menghitung modal per porsi.',
    '   - Satuan beli & Isi per satuan beli (opsional): mis. "kg" dan 1000 bila dibeli per kg tapi dipakai dalam gram.',
    '   - Barcode (opsional): boleh lebih dari satu, pisahkan dengan koma.',
    '   - Stok awal: HANYA dipakai untuk bahan baru. Stok bahan yang sudah ada diubah lewat Barang masuk atau Hitung stok.',
    '2. Sheet "Resep": satu baris = satu bahan dalam satu menu. Nama menu harus sama persis dengan menu di aplikasi.',
    '   - Takaran per porsi memakai satuan bahan tersebut.',
    '3. Baris yang diawali "Contoh" (abu-abu) akan dilewati. Boleh dihapus.',
    '4. Bahan atau resep yang tidak ada di file ini TIDAK dihapus dari aplikasi.',
    '5. Simpan file, lalu buka Stok bahan → Import Excel. Periksa pratinjau sebelum menekan Simpan.',
  ].forEach((t, i) => {
    const row = help.addRow([t])
    if (i === 0) row.font = { bold: true, size: 14 }
  })

  const header = (ws: import('exceljs').Worksheet) => {
    const r = ws.getRow(1)
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5FD6' } }
    r.height = 22
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const example = (ws: import('exceljs').Worksheet, values: (string | number)[]) => {
    const r = ws.addRow(values)
    r.font = { italic: true, color: { argb: 'FF8A8F9C' } }
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F8' } }
  }

  const bahan = wb.addWorksheet(BAHAN)
  bahan.columns = BAHAN_COLS.map((h, i) => ({ header: h, width: [24, 10, 15, 20, 13, 18, 30, 28][i] }))
  bahan.getColumn(7).numFmt = '@' // barcode sebagai teks, supaya angka panjang tidak berubah
  header(bahan)
  example(bahan, ['Contoh: Gula pasir', 'gram', 1000, 17, 'kg', 1000, '8991234567890', 5000])
  for (const i of items.filter((x) => x.is_active)) {
    bahan.addRow([i.name, i.unit, i.min_stock, i.cost, i.purchase_unit, i.purchase_factor, barcodes.filter((b) => b.ingredient_id === i.id).map((b) => b.code).join(', '), ''])
  }

  const resep = wb.addWorksheet(RESEP)
  resep.columns = RESEP_COLS.map((h, i) => ({ header: h, width: [26, 24, 18, 18][i] }))
  header(resep)
  example(resep, ['Contoh: Nasi Goreng', 'Telur', 1, 'pcs'])
  const pName = new Map(products.map((p) => [p.id, p.name]))
  const iById = new Map(items.map((i) => [i.id, i]))
  for (const r of [...recipes].sort((a, b) => (pName.get(a.product_id) ?? '').localeCompare(pName.get(b.product_id) ?? ''))) {
    const i = iById.get(r.ingredient_id)
    if (pName.get(r.product_id) && i) resep.addRow([pName.get(r.product_id), i.name, r.qty, i.unit])
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `template-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ImportIngredient = { name: string; unit: string; min_stock: number | null; cost: number | null; purchase_unit: string | null; purchase_factor: number | null; barcodes: string[]; initial_stock: number }
export type ImportRecipe = { product: string; ingredient: string; qty: number }
export type ImportIssue = { sheet: string; row: number; message: string }
export type ImportResult = { ingredients: ImportIngredient[]; recipes: ImportRecipe[]; issues: ImportIssue[]; isNew: (name: string) => boolean }

/** Isi sel sebagai teks (exceljs bisa memberi angka, rich text, atau hasil rumus). */
const text = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (o.richText) return o.richText.map((t) => t.text).join('').trim()
    if (o.result !== undefined) return text(o.result)
    if (o.text !== undefined) return String(o.text).trim()
  }
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v)
  return String(v).trim()
}
/** Angka dari sel; menerima "1.000,5" (format Indonesia) dan "1000.5". Kosong = null. */
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  const t = text(v).replace(/\s|rp/gi, '')
  if (!t) return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

/** Baca file Excel dan periksa setiap baris. Tidak menyimpan apa pun. */
export async function parseWorkbook(file: File, items: Ingredient[], products: Product[]): Promise<ImportResult> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const issues: ImportIssue[] = []
  const existing = new Map(items.map((i) => [i.name.toLowerCase(), i]))
  const ingredients: ImportIngredient[] = []
  const recipes: ImportRecipe[] = []

  const bahan = wb.getWorksheet(BAHAN)
  const resep = wb.getWorksheet(RESEP)
  if (!bahan && !resep) {
    issues.push({ sheet: '-', row: 0, message: 'Sheet "Bahan" dan "Resep" tidak ditemukan. Pakai template dari tombol "Unduh template Excel".' })
    return { ingredients, recipes, issues, isNew: () => false }
  }

  const seen = new Set<string>()
  bahan?.eachRow((row, n) => {
    if (n === 1) return
    const name = text(row.getCell(1).value)
    if (!name || /^contoh/i.test(name)) return
    const key = name.toLowerCase()
    const add = (message: string) => issues.push({ sheet: BAHAN, row: n, message })
    if (seen.has(key)) return add(`"${name}" ditulis lebih dari sekali. Hapus salah satu barisnya.`)
    seen.add(key)
    const unit = text(row.getCell(2).value)
    const old = existing.get(key)
    if (!old && !unit) return add(`Satuan "${name}" belum diisi. Isi gram, ml, atau pcs.`)
    if (old && unit && unit.toLowerCase() !== old.unit.toLowerCase()) return add(`Satuan "${name}" di file (${unit}) beda dengan di aplikasi (${old.unit}). Kembalikan ke "${old.unit}".`)
    const nums = [3, 4, 6, 8].map((c) => num(row.getCell(c).value))
    const labels = ['Batas minimum', 'Harga per satuan', 'Isi per satuan beli', 'Stok awal']
    for (let k = 0; k < nums.length; k++) {
      if (Number.isNaN(nums[k])) return add(`${labels[k]} "${name}" bukan angka. Isi angka saja, mis. 1000.`)
      if ((nums[k] ?? 0) < 0) return add(`${labels[k]} "${name}" tidak boleh minus.`)
    }
    if (nums[2] === 0) return add(`Isi per satuan beli "${name}" tidak boleh 0. Kosongkan atau isi mis. 1000.`)
    const pu = text(row.getCell(5).value)
    ingredients.push({
      name,
      unit: unit || old?.unit || '',
      min_stock: nums[0],
      cost: nums[1],
      purchase_unit: pu || (old ? null : ''),
      purchase_factor: nums[2],
      barcodes: text(row.getCell(7).value).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
      initial_stock: old ? 0 : nums[3] ?? 0,
    })
  })

  const productNames = new Map(products.map((p) => [p.name.toLowerCase(), p.name]))
  const known = (name: string) => existing.has(name.toLowerCase()) || seen.has(name.toLowerCase())
  resep?.eachRow((row, n) => {
    if (n === 1) return
    const product = text(row.getCell(1).value)
    if (!product || /^contoh/i.test(product)) return
    const ingredient = text(row.getCell(2).value)
    const qty = num(row.getCell(3).value)
    const add = (message: string) => issues.push({ sheet: RESEP, row: n, message })
    if (!productNames.has(product.toLowerCase())) return add(`Menu "${product}" tidak ada di aplikasi. Samakan dengan nama menu di halaman Menu.`)
    if (!ingredient) return add(`Nama bahan untuk "${product}" belum diisi.`)
    if (!known(ingredient)) return add(`Bahan "${ingredient}" belum ada. Tambahkan dulu di sheet Bahan.`)
    if (qty === null || Number.isNaN(qty) || qty <= 0) return add(`Takaran ${ingredient} untuk ${product} harus angka lebih dari 0.`)
    recipes.push({ product: productNames.get(product.toLowerCase())!, ingredient, qty })
  })

  return { ingredients, recipes, issues, isNew: (name) => !existing.has(name.toLowerCase()) }
}

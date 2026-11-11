// Strip scripts, styles and inline handlers from stored or imported HTML.
export function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) =>
    [...el.attributes].forEach((a) => {
      if (a.name.startsWith('on') || /^\s*(javascript|vbscript):/i.test(a.value)) el.removeAttribute(a.name)
    }),
  )
  return doc.body.innerHTML
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function download(name: string, type: string, data: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function pickFile(accept: string, onFile: (f: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => input.files?.[0] && onFile(input.files[0])
  input.click()
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
export function ago(sqlDate: string) {
  const s = (new Date(sqlDate.replace(' ', 'T') + 'Z').getTime() - Date.now()) / 1000
  for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]] as const)
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit)
  return 'just now'
}

export function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Plain text from the first chunk of HTML, for previews.
export const plainText = (html: string, max = 240) =>
  html.replace(/<(br|\/p|\/h\d|\/li|\/div|\/td)>/gi, ' ').replace(/<[^>]*>?/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export const safeJson = <T,>(s: string, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback } catch { return fallback }
}

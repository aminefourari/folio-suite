// PBKDF2-SHA256 via WebCrypto (native on Workers and Node). Better Auth's default scrypt is pure JS and too
// CPU-heavy for Workers. Format: pbkdf2$<iterations>$<salt b64>$<hash b64>, so the cost can be raised later.
const ITERATIONS = 100_000 // Workers caps PBKDF2 at 100k
const enc = new TextEncoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: BufferSource, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const [scheme, iter, salt, expected] = hash.split('$')
  const iterations = Number(iter)
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS || !salt || !expected) return false
  const actual = await derive(password, unb64(salt), iterations)
  const want = unb64(expected)
  // Constant-time comparison.
  let diff = actual.length ^ want.length
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ (want[i] ?? 0)
  return diff === 0
}

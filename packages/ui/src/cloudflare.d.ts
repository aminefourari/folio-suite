// Minimal Workers types used by server.ts. The full @cloudflare/workers-types package redeclares DOM globals
// (Element, Response...) and clashes with the browser types these apps also need.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>
}
interface D1Result<T> { results: T[]; meta: { changes: number } }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = unknown>(): Promise<D1Result<T>>
  first<T = unknown>(column?: string): Promise<T | null>
  run(): Promise<D1Result<unknown>>
}
interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

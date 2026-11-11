// Starts every app against one shared local D1 (needed for single sign-on across apps).
// Starts are staggered: workerd processes opening the same SQLite state at once fail with SQLITE_BUSY.
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const APPS = [['landing', 3000], ['write', 3001], ['grid', 3002], ['stage', 3003]]
const COLORS = { landing: 90, write: 35, grid: 36, stage: 31 }

for (const [app] of APPS) {
  if (!existsSync(`apps/${app}/.dev.vars`)) {
    console.error(`apps/${app}/.dev.vars is missing. Copy .dev.vars.example into each app (same secret in all four).`)
    process.exit(1)
  }
}

execSync('pnpm run db:migrate:local', { stdio: 'inherit' })

const children = []
const stop = () => { for (const c of children) c.kill('SIGTERM'); process.exit() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

for (const [app, port] of APPS) {
  const child = spawn('pnpm', ['--filter', `@folio/${app}`, 'dev'], { stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  const tag = `\x1b[${COLORS[app]}m${app.padEnd(7)}\x1b[0m │ `
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (d) => process.stdout.write(d.toString().split('\n').filter(Boolean).map((l) => tag + l).join('\n') + '\n'))
  child.on('exit', (code) => { if (code) { console.error(`${app} exited with ${code}`); stop() } })
  // Wait until this app answers before starting the next one.
  for (let i = 0; i < 120; i++) {
    try { await fetch(`http://localhost:${port}/`, { redirect: 'manual' }); break } catch { await sleep(250) }
  }
}
console.log('\nFolio is running: http://localhost:3000 (sign in here), write :3001, grid :3002, stage :3003\n')

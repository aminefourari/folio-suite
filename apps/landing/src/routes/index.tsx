import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Cloud, Keyboard, Lock, MoonStar } from 'lucide-react'
import type { CSSProperties } from 'react'
import { APPS, Mark, SUITE, urlFor } from '@folio/ui/apps.tsx'

export const Route = createFileRoute('/')({ component: Landing })

const FEATURES = [
  { icon: Cloud, title: 'Saves as you type', text: 'Every change is stored within a second. No save button to forget.' },
  { icon: Lock, title: 'Private by default', text: 'Your files belong to this browser. No sign-up, no tracking.' },
  { icon: Keyboard, title: 'Keyboard friendly', text: 'Familiar shortcuts for formatting, navigation and saving.' },
  { icon: MoonStar, title: 'Light and dark', text: 'Follows your system appearance, down to the toolbars.' },
]

function Landing() {
  return (
    <div className="landing">
      <header className="l-nav">
        <span className="l-brand"><Mark color={SUITE.color} icon={SUITE.icon} size={32} /> Folio</span>
        <nav aria-label="Apps">
          {APPS.map((a) => <a key={a.id} href={urlFor(a.id)}>{a.short}</a>)}
        </nav>
      </header>

      <section className="l-hero">
        <p className="l-eyebrow">A calm little office suite</p>
        <h1>Write, calculate and present, <span>without the clutter.</span></h1>
        <p className="l-lede">Folio is three focused apps that open instantly in your browser and keep your work saved automatically.</p>
      </section>

      <section className="l-apps" aria-label="Folio apps">
        {APPS.map((a, i) => (
          <a key={a.id} href={urlFor(a.id)} className="l-app" style={{ '--app': a.color, '--i': i } as CSSProperties}>
            <div className="l-app-art" aria-hidden>
              {a.id === 'write' && <WriteArt />}
              {a.id === 'grid' && <GridArt />}
              {a.id === 'stage' && <StageArt />}
            </div>
            <div className="l-app-body">
              <Mark color={a.color} icon={a.icon} size={40} />
              <div>
                <h2>{a.name}</h2>
                <p>{a.tagline}</p>
              </div>
              <ArrowUpRight className="l-arrow" size={20} />
            </div>
          </a>
        ))}
      </section>

      <section className="l-features" aria-label="Why Folio">
        {FEATURES.map((f) => (
          <div key={f.title} className="l-feature">
            <f.icon size={20} />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="l-foot">
        <span>Folio · an independent open-source project</span>
        <a href="https://github.com/aminefourari/folio-suite">Source on GitHub</a>
      </footer>
    </div>
  )
}

function WriteArt() {
  return (
    <div className="art-paper">
      <b>Launch notes</b>
      <i style={{ width: '92%' }} /><i style={{ width: '84%' }} /><i style={{ width: '60%' }} />
      <em /><i style={{ width: '88%' }} /><i style={{ width: '72%' }} />
    </div>
  )
}

function GridArt() {
  const rows = [['Q1', '1,240', '18%'], ['Q2', '1,580', '27%'], ['Q3', '1,910', '21%'], ['Total', '4,730', '']]
  return (
    <div className="art-sheet">
      {rows.map((r, i) => (
        <div key={i} className={i === 3 ? 'total' : undefined}>{r.map((c, j) => <span key={j}>{c}</span>)}</div>
      ))}
      <div className="bars">{[38, 52, 64, 46, 72, 84].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
    </div>
  )
}

function StageArt() {
  return (
    <div className="art-deck">
      <div className="back" />
      <div className="front"><span className="bar" /><b>Roadmap 2027</b><small>What we’ll ship next</small></div>
    </div>
  )
}

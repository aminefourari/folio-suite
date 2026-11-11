import type { Template } from '@folio/ui/chrome.tsx'
import { SlideView, previewDeck, type Deck, type Layout, type Slide, type ThemeId } from './deck.tsx'

export function SlideThumb({ prefix }: { prefix: string }) {
  const { theme, slide } = previewDeck(prefix)
  return <div className="slide-thumb"><SlideView slide={slide} theme={theme} placeholders={false} /></div>
}

// Fixed ids: templates are built at import time, and Workers forbid random values outside a request.
// Ids only need to be unique within a deck; new and duplicated slides still get random ones.
let n = 0
const s = (layout: Layout, title: string, body = '', body2 = '', notes = ''): Slide => ({ id: `tpl${++n}`, layout, title, body, body2, notes })
const ul = (...items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`

const t = (name: string, blurb: string, theme: ThemeId, slides: Deck['slides']): Template => {
  const content = JSON.stringify({ theme, slides } satisfies Deck)
  return { name, blurb, title: name, content, preview: <SlideThumb prefix={content} /> }
}

export const TEMPLATES: Template[] = [
  t('Pitch deck', 'Problem, solution, market, ask', 'midnight', [
    s('title', 'Your company', 'One line that says what you do and for whom'),
    s('content', 'The problem', ul('Who feels the pain', 'How they solve it today', 'Why that falls short'), '', 'Tell one customer story.'),
    s('content', 'Our solution', ul('What it does in one sentence', 'The moment it clicks for users', 'Why now')),
    s('two', 'Market', ul('Total market', 'Who we start with'), ul('Competitors', 'Why we win')),
    s('section', 'The ask', 'How much, and what it gets us to'),
  ]),
  t('Project update', 'Progress, risks, next steps', 'paper', [
    s('title', 'Project update', 'Week of …'),
    s('content', 'Progress', ul('Shipped: …', 'In review: …', 'Metrics: …')),
    s('two', 'Risks and mitigations', ul('Risk one', 'Risk two'), ul('What we are doing about it', 'Help we need')),
    s('content', 'Next steps', ul('By next week', 'By end of month')),
  ]),
  t('Workshop', 'Agenda, exercises, wrap-up', 'ocean', [
    s('title', 'Workshop title', 'Facilitator · date'),
    s('content', 'Agenda', `<ol><li>Warm-up (10 min)</li><li>Exercise (30 min)</li><li>Share-back (15 min)</li><li>Wrap-up (5 min)</li></ol>`),
    s('section', 'Exercise', 'Instructions for the group'),
    s('content', 'Wrap-up', ul('What we learned', 'What happens next')),
  ]),
]

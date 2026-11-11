import type { Template } from '@folio/ui/chrome.tsx'
import { plainText } from '@folio/ui/util.ts'

export function PaperThumb({ title, html }: { title: string; html: string }) {
  return (
    <div className="paper-thumb">
      {title && <b>{title}</b>}
      <p>{plainText(html) || <span className="muted">Empty document</span>}</p>
    </div>
  )
}

// Templates are module-level and render on the server too, so dates are filled in at creation time
// (in the browser, in the user's time zone) instead of at import. See `fillTemplate`.
const TODAY = '{{today}}'
export const fillTemplate = (content: string) =>
  content.replaceAll(TODAY, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))

const t = (name: string, blurb: string, title: string, content: string): Template =>
  ({ name, blurb, title, content, preview: <PaperThumb title={title} html={content.replaceAll(TODAY, 'Today')} /> })

export const TEMPLATES: Template[] = [
  t('Meeting notes', 'Agenda, notes and action items', 'Meeting notes', `
<h1>Team sync</h1>
<p><b>Date:</b> ${TODAY} · <b>Attendees:</b> </p>
<h2>Agenda</h2><ul><li>Updates since last week</li><li>Blockers</li><li>Decisions needed</li></ul>
<h2>Notes</h2><p>Write the main points of the discussion here.</p>
<h2>Action items</h2><ol><li><b>Owner</b>: what happens next, by when</li></ol>`),
  t('Project brief', 'Problem, goals, scope, timeline', 'Project brief', `
<h1>Project brief</h1>
<p>One paragraph that explains what this project is and why it matters now.</p>
<h2>Problem</h2><p>Who is affected, and what does it cost them today?</p>
<h2>Goals</h2><ul><li>A measurable outcome</li><li>Another measurable outcome</li></ul>
<h2>Out of scope</h2><ul><li>What we are deliberately not doing</li></ul>
<h2>Timeline</h2>
<table><tr><td><b>Milestone</b></td><td><b>Date</b></td><td><b>Owner</b></td></tr><tr><td>Kick-off</td><td></td><td></td></tr><tr><td>First release</td><td></td><td></td></tr></table>`),
  t('Letter', 'A clean, formal letter', 'Letter', `
<p style="text-align: right;">Your name<br>Street address<br>City, postcode</p>
<p>${TODAY}</p>
<p>Recipient name<br>Organisation<br>Address</p>
<p>Dear Recipient,</p>
<p>Start with the reason you are writing. Keep each paragraph to one idea.</p>
<p>Add the details, and finish with what you would like to happen next.</p>
<p>Kind regards,</p><p>Your name</p>`),
]

import { useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowRight, Check, Copy, FileCode2, LogIn, Terminal, Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import instructions from '../docs/gymdesk-csv.md?raw'
import script from '../gymdesk-scrape.js?raw'

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => part.startsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function InstructionsPage() {
  const [copyStatus, setCopyStatus] = useState('')
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopyStatus('Script copied. Paste it into your Gymdesk console.')
    } catch {
      setCopyStatus('Copy was unavailable. Select the script below and copy it, or download the script file.')
    }
  }

  return <section className="instructions-page">
    <section className="instructions-quickstart" aria-labelledby="quickstart-title">
      <div className="instructions-quickstart-heading"><span className="instructions-eyebrow">GYMDESK → MAT METRICS</span><h2 id="quickstart-title">Your training journey, in 3 steps</h2><p>Export your attendance and belt history, then bring it into your dashboard.</p></div>
      <ol className="instructions-steps">
        <li><Card className="instructions-step"><CardHeader><span className="instructions-step-number">01</span><LogIn className="instructions-step-icon" size={24} aria-hidden="true" /></CardHeader><CardContent><CardTitle>Open your training history</CardTitle><CardDescription>Sign in to your gym’s Gymdesk website and open your attendance page. Select All trainings or All ranks if available.</CardDescription><div className="instructions-step-hint"><span>Gymdesk</span><ArrowRight size={14} aria-hidden="true" /><span>Attendance</span></div></CardContent></Card></li>
        <li><Card className="instructions-step"><CardHeader><span className="instructions-step-number">02</span><Terminal className="instructions-step-icon" size={24} aria-hidden="true" /></CardHeader><CardContent><CardTitle>Run the export script</CardTitle><CardDescription>Open your browser’s Developer Tools and select Console. Paste the script, press Enter, and keep the tab open until your CSV downloads.</CardDescription><button className="button button-primary" onClick={copyScript}>{copyStatus.startsWith('Script copied') ? <Check size={15} /> : <Copy size={15} />} Copy script</button><span className="instructions-step-shortcut">Console: Ctrl + Shift + J · Mac: ⌘ + ⌥ + J</span></CardContent></Card></li>
        <li><Card className="instructions-step"><CardHeader><span className="instructions-step-number">03</span><Upload className="instructions-step-icon" size={24} aria-hidden="true" /></CardHeader><CardContent><CardTitle>Import and explore</CardTitle><CardDescription>Return to Mat Metrics and click Import CSV, or drag your downloaded file onto the app. Your training charts and belt milestones will update.</CardDescription><div className="instructions-step-hint"><Check size={15} aria-hidden="true" /><span>Saved locally in your browser</span></div></CardContent></Card></li>
      </ol>
      <p className="instructions-quickstart-status" role="status">{copyStatus}</p>
      <a className="instructions-details-link" href="#full-instructions">Full instructions & troubleshooting <ArrowDownToLine size={14} aria-hidden="true" /></a>
    </section>
    <article id="full-instructions" className="instructions-guide panel">{instructions.trim().split(/\r?\n\s*\r?\n/).map((block, index) => {
      if (block.startsWith('# ')) return <h2 key={index}>{inlineMarkdown(block.slice(2))}</h2>
      if (block.startsWith('## ')) return <h3 key={index}>{inlineMarkdown(block.slice(3))}</h3>
      return <p key={index}>{inlineMarkdown(block)}</p>
    })}<button className="button button-outline" onClick={() => download(instructions, 'gymdesk-csv-instructions.md', 'text/markdown')}><ArrowDownToLine size={16} /> Download instructions</button></article>
    <section className="instructions-script panel"><div className="instructions-script-heading"><div><h2><FileCode2 size={20} /> Gymdesk export script</h2><p>Copy the whole script and run it in your Gymdesk attendance tab.</p></div><div className="instructions-script-actions"><button className="button button-outline" onClick={() => download(script, 'gymdesk-scrape.js', 'text/javascript')}><ArrowDownToLine size={15} /> Download script</button><button className="button button-primary" onClick={copyScript}>{copyStatus.startsWith('Script copied') ? <Check size={15} /> : <Copy size={15} />} Copy script</button></div></div><p className="instructions-copy-status" role="status">{copyStatus}</p><details><summary>View the script</summary><pre tabIndex={0}><code>{script}</code></pre></details></section>
  </section>
}

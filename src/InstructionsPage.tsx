import { useState, type ReactNode } from 'react'
import { ArrowDownToLine, Check, Copy, FileCode2 } from 'lucide-react'
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
    <article className="instructions-guide panel">{instructions.trim().split(/\r?\n\s*\r?\n/).map((block, index) => {
      if (block.startsWith('# ')) return <h2 key={index}>{inlineMarkdown(block.slice(2))}</h2>
      if (block.startsWith('## ')) return <h3 key={index}>{inlineMarkdown(block.slice(3))}</h3>
      return <p key={index}>{inlineMarkdown(block)}</p>
    })}<button className="button button-outline" onClick={() => download(instructions, 'gymdesk-csv-instructions.md', 'text/markdown')}><ArrowDownToLine size={16} /> Download instructions</button></article>
    <section className="instructions-script panel"><div className="instructions-script-heading"><div><h2><FileCode2 size={20} /> Gymdesk export script</h2><p>Copy the whole script and run it in your Gymdesk attendance tab.</p></div><div className="instructions-script-actions"><button className="button button-outline" onClick={() => download(script, 'gymdesk-scrape.js', 'text/javascript')}><ArrowDownToLine size={15} /> Download script</button><button className="button button-primary" onClick={copyScript}>{copyStatus.startsWith('Script copied') ? <Check size={15} /> : <Copy size={15} />} Copy script</button></div></div><p className="instructions-copy-status" role="status">{copyStatus}</p><details><summary>View the script</summary><pre tabIndex={0}><code>{script}</code></pre></details></section>
  </section>
}

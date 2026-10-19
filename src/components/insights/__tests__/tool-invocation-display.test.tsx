import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ToolInvocationDisplay } from '../tool-invocation-display'

function render(toolName: string, output: unknown) {
  return renderToStaticMarkup(
    <ToolInvocationDisplay toolName={toolName} state="output-available" input={{}} output={output} />
  )
}

describe('ToolInvocationDisplay next-to-test errors', () => {
  it('shows a list_next_to_test read error instead of "List is empty."', () => {
    const html = render('list_next_to_test', { error: 'db down' })
    expect(html).toContain('db down')
    expect(html).not.toContain('List is empty')
  })

  it('still shows "List is empty." for a real empty list', () => {
    expect(render('list_next_to_test', { entries: [] })).toContain('List is empty')
  })

  it('shows an add_many_to_next_to_test error instead of "Added 0"', () => {
    const html = render('add_many_to_next_to_test', {
      error: 'Could not read the test catalogue, nothing was saved: db down',
    })
    expect(html).toContain('nothing was saved: db down')
    expect(html).not.toContain('Added')
  })
})

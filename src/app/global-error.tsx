'use client'

import './globals.css'

/**
 * Last-resort screen when the root layout itself fails. It replaces the whole
 * document, so it renders its own <html> and <body> and avoids app providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The app could not load. Please try again in a moment.
          </p>
          {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

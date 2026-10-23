'use client'

// The iPhone Shortcut logs meals to /api/nutrition/log with a
// personal token, but there was no place in the app to see or renew it.

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { getOrCreateLogToken, regenerateLogToken } from '@/actions/nutrition-settings'
import { shortcutSetup } from '@/lib/nutrition/shortcut-setup'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Setup = ReturnType<typeof shortcutSetup>

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export function ShortcutTokenCard() {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [isLoading, startLoading] = useTransition()
  const [isRenewing, startRenewing] = useTransition()

  function show() {
    startLoading(async () => {
      const { token, error } = await getOrCreateLogToken()
      if (!token) {
        toast.error(error ?? 'Could not load your token.')
        return
      }
      setSetup(shortcutSetup(window.location.origin, token))
    })
  }

  function renew() {
    startRenewing(async () => {
      const { token, error } = await regenerateLogToken()
      if (!token) {
        toast.error(error ?? 'Could not create a new token.')
        return
      }
      setSetup(shortcutSetup(window.location.origin, token))
      toast.success('New token created. Paste it into your Shortcut.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" />
          iPhone Shortcut
        </CardTitle>
        <CardDescription>
          Log meals by voice or text from an iPhone Shortcut. The Shortcut sends
          your personal token with each request; keep it private.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {setup ? (
          <>
            <CopyRow label="URL" value={setup.url} />
            <CopyRow label="Authorization header" value={setup.headerValue} />
            <p className="text-xs text-muted-foreground">
              In the Shortcut&apos;s &ldquo;Get contents of URL&rdquo; action: method POST, the
              URL above, and a header named <code className="font-mono">Authorization</code>{' '}
              with the value above. Request body: JSON with a{' '}
              <code className="font-mono">food</code> field holding the dictated or typed meal
              (optional: <code className="font-mono">meal</code> &mdash; breakfast, lunch, dinner
              or snack &mdash; and <code className="font-mono">date</code> as YYYY-MM-DD).
            </p>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={show} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Show token
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="ghost" disabled={isRenewing}>
              {isRenewing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              New token
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create a new token?</AlertDialogTitle>
              <AlertDialogDescription>
                Your current Shortcut stops working until you paste the new token
                into it. Do this if the old token may have leaked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={renew}>Create new token</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

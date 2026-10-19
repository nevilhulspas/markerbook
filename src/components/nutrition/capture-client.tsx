'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, Mic, Square, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'
import { logFood } from '@/actions/nutrition-logging'
import {
  getVoiceMode,
  startDictation,
  startRecording,
  transcribeRecording,
} from '@/lib/nutrition/voice'

type Phase = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'done'

/** Pending parser follow-up: the original meal text plus the question. */
interface Clarify {
  question: string
  original: string
}

/** Human-readable hint for the getUserMedia failures we expect on iOS. */
function micErrorHint(name: string): string {
  switch (name) {
    case 'NotAllowedError':
      return 'Microphone access was denied — allow it in Settings, or tap the button to try again.'
    case 'NotFoundError':
      return 'No microphone found on this device.'
    case 'NoAudioCaptured':
      return 'No audio was captured — tap the button and speak into the mic.'
    default:
      return 'The microphone could not be started — tap the button to try again.'
  }
}

/**
 * Distraction-free food capture: one big record button, a text fallback, an
 * inline follow-up question (answerable by voice OR text — no popup), and a
 * confirmation state. Opened by the native "Log Food → Record" intent (deep
 * link → `/capture?autostart=<ts>`), and usable directly.
 */
export function CaptureClient({
  autoStartToken,
  prefill = '',
}: {
  autoStartToken: string | null
  prefill?: string
}) {
  const router = useRouter()
  const mounted = useMounted()
  const mode = mounted ? getVoiceMode() : 'unsupported'

  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState(prefill)
  const [micError, setMicError] = useState<string | null>(null)
  const [clarify, setClarify] = useState<Clarify | null>(null)
  const [summary, setSummary] = useState('')

  const stopRef = useRef<null | (() => void)>(null)
  // Mirror for callbacks armed before the question arrived (recording onStop).
  const clarifyRef = useRef<Clarify | null>(null)

  function setClarifyState(value: Clarify | null) {
    clarifyRef.current = value
    setClarify(value)
  }

  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  async function submit(value: string, clarification?: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setPhase('analyzing')

    const res = await logFood(trimmed, { clarification: clarification ?? null })

    if (!res.ok) {
      toast.error(res.error)
      setPhase('idle')
      return
    }
    if ('question' in res) {
      // Clear the textarea: it becomes the answer box for the follow-up.
      setClarifyState({ question: res.question, original: trimmed })
      setText('')
      setPhase('idle')
      return
    }

    setClarifyState(null)
    setText('')
    if ('undone' in res) {
      setSummary(res.message ?? 'Removed last meal')
    } else if ('saved' in res) {
      setSummary(`Saved meal: ${res.name}`)
    } else {
      const { foodName, items, totals } = res.logged
      const details: string[] = []
      if (items.length > 1) details.push(`${items.length} items`)
      if (totals.kcal > 0) details.push(`${Math.round(totals.kcal)} kcal`)
      setSummary(`Logged: ${foodName}${details.length > 0 ? ` — ${details.join(', ')}` : ''}`)
    }
    setPhase('done')
  }

  /** Route a finished transcript or typed text to the right submission: the
   *  follow-up answer when a question is pending, a fresh meal otherwise. */
  function submitInput(value: string) {
    const pending = clarifyRef.current
    if (pending) {
      void submit(pending.original, value)
    } else {
      void submit(value)
    }
  }

  function startCapture() {
    if (phase !== 'idle' || stopRef.current !== null) return
    setMicError(null)

    if (mode === 'recording') {
      setPhase('recording')
      stopRef.current = startRecording({
        onStop: (blob, errorName) => {
          stopRef.current = null
          if (!blob) {
            setPhase('idle')
            setMicError(errorName ?? 'NoAudioCaptured')
            return
          }
          setPhase('transcribing')
          void transcribeRecording(blob).then((t) => {
            if (!t) {
              setPhase('idle')
              toast.error('Could not transcribe the recording — try again')
              return
            }
            setText(t)
            submitInput(t)
          })
        },
      })
      return
    }

    if (mode === 'dictation') {
      setPhase('recording')
      stopRef.current = startDictation({
        onText: setText,
        onEnd: () => {
          stopRef.current = null
          setPhase('idle')
        },
      })
    }
  }

  function toggleCapture() {
    if (phase === 'recording') {
      const stop = stopRef.current
      if (mode === 'dictation') {
        // The dictation stopper suppresses its own onEnd; reset the UI here.
        stopRef.current = null
        setPhase('idle')
      }
      stop?.()
      return
    }
    startCapture()
  }

  // Auto-start a recording when the native intent deep-links in. Best effort:
  // WKWebView may refuse getUserMedia without a user gesture, in which case
  // the error shows on screen and the big button (a real gesture) is one tap
  // away. The sessionStorage guard keeps reloads from re-arming the mic.
  useEffect(() => {
    if (!autoStartToken || !mounted || mode !== 'recording') return
    const key = `capture-autostart:${autoStartToken}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const timer = setTimeout(() => startCapture(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on a new token; the deferred startCapture() uses the props of the render that armed it
  }, [autoStartToken, mounted, mode])

  const recording = phase === 'recording'
  const busy = phase === 'transcribing' || phase === 'analyzing'

  const statusText =
    phase === 'recording'
      ? 'Listening… tap to stop'
      : phase === 'transcribing'
        ? 'Transcribing…'
        : phase === 'analyzing'
          ? 'Analyzing your meal…'
          : mode === 'unsupported'
            ? clarify
              ? 'Type your answer below.'
              : 'Voice input is not available here — type your meal below.'
            : clarify
              ? mode === 'dictation'
                ? 'Dictate your answer, then tap Log'
                : 'Tap to answer by voice'
              : mode === 'dictation'
                ? 'Tap to dictate'
                : 'Tap to record'

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Log food</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => router.push('/nutrition')}
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {phase === 'done' ? (
          <>
            <div className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-full">
              <Check className="size-10" />
            </div>
            <p className="px-4 text-center text-base font-medium">{summary}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/nutrition')}>
                View
              </Button>
              <Button onClick={() => setPhase('idle')}>Log more</Button>
            </div>
          </>
        ) : (
          <>
            {clarify && (
              <p className="px-6 text-center text-base font-medium">{clarify.question}</p>
            )}
            {mode !== 'unsupported' && (
              <button
                type="button"
                onClick={toggleCapture}
                disabled={busy}
                aria-label={recording ? 'Stop recording' : 'Start recording'}
                className={cn(
                  'flex size-28 items-center justify-center rounded-full transition-colors disabled:opacity-60',
                  recording
                    ? 'bg-destructive text-white animate-pulse'
                    : 'bg-primary text-primary-foreground'
                )}
              >
                {busy ? (
                  <Loader2 className="size-10 animate-spin" />
                ) : recording ? (
                  <Square className="size-9" />
                ) : (
                  <Mic className="size-10" />
                )}
              </button>
            )}
            <p className="text-muted-foreground text-sm">{statusText}</p>
            {clarify && !busy && !recording && (
              <div className="flex gap-4">
                <Button
                  variant="link"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => void submit(clarify.original, 'assume typical portions')}
                >
                  Skip
                </Button>
                <Button
                  variant="link"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => {
                    // Back out of the question: restore the meal for editing.
                    setText(clarify.original)
                    setClarifyState(null)
                  }}
                >
                  Edit meal
                </Button>
              </div>
            )}
            {micError && (
              <p className="text-destructive px-6 text-center text-sm">
                {micErrorHint(micError)}
                <span className="text-muted-foreground mt-1 block font-mono text-xs">
                  ({micError})
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {phase !== 'done' && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            placeholder={
              clarify ? 'Type your answer…' : '…or type it: e.g. 200g chicken with rice'
            }
            rows={2}
            onChange={(e) => setText(e.target.value)}
            disabled={busy || recording}
          />
          <Button onClick={() => submitInput(text)} disabled={busy || recording || !text.trim()}>
            {phase === 'analyzing' ? <Loader2 className="size-4 animate-spin" /> : 'Log'}
          </Button>
        </div>
      )}
    </>
  )
}

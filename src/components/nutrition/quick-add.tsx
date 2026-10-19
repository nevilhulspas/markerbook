'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mic, Camera } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { logFood } from '@/actions/nutrition-logging'
import type { MealType, Recipe } from '@/lib/database.types'
import { MealSlotChips } from './meal-slot-chips'
import { ClarifyDialog } from './clarify-dialog'
import { RecipeChips } from './recipe-chips'
import type { LibrarySuggestion } from './suggestion-dropdown'
import { SuggestionDropdown } from './suggestion-dropdown'

interface QuickAddProps {
  defaultDate?: string | null
  compact?: boolean
  recipes?: (Recipe & { useCount: number })[]
  librarySuggestions?: LibrarySuggestion[]
}

export function QuickAdd({
  defaultDate,
  compact,
  recipes = [],
  librarySuggestions = [],
}: QuickAddProps) {
  const [text, setText] = useState('')
  const [meal, setMeal] = useState<MealType | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [originalText, setOriginalText] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(opts?: { clarification?: string }) {
    const value = (opts?.clarification ? originalText : text).trim()
    if (!value) return

    // Close the quick-pick for every submit path. The onBlur fallback can't be
    // relied on: the voice flow fills the input without ever focusing it, so no
    // blur fires and a stale open state would resurface once isPending clears.
    setShowSuggestions(false)

    startTransition(async () => {
      const res = await logFood(value, {
        meal,
        date: defaultDate ?? null,
        clarification: opts?.clarification ?? null,
      })

      if (!res.ok) {
        toast.error(res.error)
        return
      }

      if ('undone' in res) {
        toast.success(res.message ?? 'Removed last meal')
        setText('')
        setPendingQuestion(null)
        router.refresh()
        return
      }

      if ('saved' in res) {
        toast.success(`Saved meal: ${res.name}`)
        setText('')
        setPendingQuestion(null)
        router.refresh()
        return
      }

      if ('question' in res) {
        // Don't clear text; open the clarify dialog.
        setOriginalText(value)
        setPendingQuestion(res.question)
        return
      }

      if ('logged' in res) {
        const { foodName, items } = res.logged
        const s = items.length !== 1 ? 's' : ''
        toast.success(`Logged: ${foodName} (${items.length} item${s})`)
        setText('')
        setPendingQuestion(null)
        router.refresh()
        return
      }
    })
  }

  function handleAnswer(answer: string) {
    submit({ clarification: answer })
  }

  function handleSkip() {
    submit({ clarification: 'assume typical portions' })
  }

  function handleCancelClarify() {
    // Close the dialog, keep the typed text so the user can edit and resubmit.
    setPendingQuestion(null)
  }

  function handleTextChange(value: string) {
    setText(value)
    // Show suggestions for ≥2 chars unless it looks like an undo/save command.
    const trimmed = value.trim().toLowerCase()
    const isCommand = trimmed === 'undo' || trimmed.startsWith('save ')
    setShowSuggestions(value.trim().length >= 2 && !isCommand)
  }

  function handleSuggestionLogged() {
    setText('')
    setShowSuggestions(false)
    router.refresh()
  }

  // Track focus across the input + chips + popover so the quick-pick panel stays
  // open while the user moves between them. Radix renders the Popover into a portal,
  // so a naive `onBlur` would hide the panel the moment a chip is clicked. We poll
  // `activeElement` after the microtask flush; if focus landed inside this container
  // (or the popover, which marks itself with `data-radix-popper-content-wrapper` in
  // the DOM) we stay open.
  const containerRef = useRef<HTMLDivElement>(null)

  function handleBlur() {
    setTimeout(() => {
      const el = document.activeElement
      if (!el) {
        setIsFocused(false)
        return
      }
      // Still inside the quick-add container.
      if (containerRef.current?.contains(el)) {
        setIsFocused(true)
        return
      }
      // Radix Popover content renders in a portal; treat it as "ours".
      if (el.closest('[data-radix-popper-content-wrapper]')) {
        setIsFocused(true)
        return
      }
      setIsFocused(false)
      setShowSuggestions(false)
    }, 0)
  }

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      onBlur={handleBlur}
    >
      {isFocused && <MealSlotChips value={meal} onChange={setMeal} />}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            value={text}
            placeholder="What did you eat? e.g. 200g chicken with rice"
            onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSuggestions(false)
                return
              }
              // Enter submits free text — do NOT hijack for suggestions.
              if (e.key === 'Enter') submit()
            }}
            // Delay so a suggestion's onClick still fires before the dropdown hides.
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            disabled={isPending}
          />
          {showSuggestions && !isPending && (
            <SuggestionDropdown
              query={text}
              suggestions={librarySuggestions}
              meal={meal}
              defaultDate={defaultDate}
              onLogged={handleSuggestionLogged}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </div>
        {/* Voice capture lives on the dedicated full-screen page */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() =>
            router.push(
              text.trim() ? `/capture?prefill=${encodeURIComponent(text.trim())}` : '/capture'
            )
          }
          disabled={isPending}
          aria-label="Open voice recorder"
        >
          <Mic className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => router.push('/capture/photo')}
          disabled={isPending}
          aria-label="Log a meal from a photo"
        >
          <Camera className="size-4" />
        </Button>
        <Button onClick={() => submit()} disabled={isPending || !text.trim()}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Log'
          )}
        </Button>
      </div>

      {/* Inline "Analyzing…" status while the AI call is in flight */}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Analyzing your meal…</span>
        </div>
      )}

      {/* key on the question resets the dialog's answer field on each new question */}
      <ClarifyDialog
        key={pendingQuestion ?? '__closed__'}
        question={pendingQuestion}
        pending={isPending}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        onCancel={handleCancelClarify}
      />

      {isFocused && !compact && recipes.length > 0 && (
        <RecipeChips recipes={recipes} defaultDate={defaultDate} meal={meal} />
      )}
    </div>
  )
}

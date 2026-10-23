'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Loader2, Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { scaleTo, type Macros100 } from '@/lib/nutrition/macros'
import type { MealType } from '@/lib/database.types'
import { MealSlotChips } from './meal-slot-chips'
import { downscaleImage } from '@/lib/nutrition/downscale'
import { isNativePlatform } from '@/lib/capacitor'

interface AnalyzedItem {
  query: string
  grams: number
  per100: Macros100
  match_source: string
  match_ref: string | null
  recipe_id: string | null
  custom_food_id: string | null
}
interface PhotoAnalysis {
  food_name: string
  meal_time: MealType | null
  is_food: boolean
  question: string | null
  items: AnalyzedItem[]
}
interface ReviewItem extends AnalyzedItem {
  weightEstimated: boolean
  originalGrams: number // AI vision estimate, frozen at analyze time
}

type Phase = 'capturing' | 'analyzing' | 'clarifying' | 'reviewing' | 'logging'

export function PhotoCaptureClient({ captureToken }: { captureToken: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  // Guards against the auto-open effect firing more than once per deep-link
  // arrival (React StrictMode double-invokes effects in dev, and a token
  // change would otherwise re-arm). Reset by clearing the stored token.
  const openedTokenRef = useRef<string | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  // The Add flow gets its own in-flight controller + loading flag so it can run
  // fully independently of a Change search — sharing them let an aborted swap's
  // `finally` clear the add spinner mid-flight.
  const addAbortRef = useRef<AbortController | null>(null)
  const [phase, setPhase] = useState<Phase>('capturing')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [foodName, setFoodName] = useState('')
  const [meal, setMeal] = useState<MealType | null>(null)
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [changingIdx, setChangingIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addSearching, setAddSearching] = useState(false)

  // Open the native camera (zero-tap from a deep link) or, on web, fall back
  // to the HTML file picker which the user must tap themselves. iOS WKWebView
  // blocks a programmatic `<input type="file">.click()` unless it stems from a
  // user gesture inside the webview — the Apple Shortcut tap is native and
  // doesn't count. The Capacitor Camera plugin calls
  // `UIImagePickerController` directly from Swift, bypassing that gate.
  async function openCamera() {
    if (isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
        const photo = await Camera.getPhoto({
          source: CameraSource.Camera,
          resultType: CameraResultType.DataUrl,
          quality: 90,
          saveToGallery: false,
          correctOrientation: true,
        })
        if (!photo.dataUrl) {
          throw new Error('Camera returned no image data')
        }
        const fetched = await fetch(photo.dataUrl)
        const blob = await fetched.blob()
        // The downstream pipeline (`downscaleImage`) expects a `File`.
        const file = new File([blob], 'meal.jpg', { type: blob.type || 'image/jpeg' })
        void onFile(file)
      } catch (err) {
        // "User cancelled" comes back as a generic Error with a message
        // beginning "User cancelled". Anything else is a real failure we want
        // surfaced — without this, a misconfigured plugin / missing permission
        // looks identical to "nothing happens".
        const msg = err instanceof Error ? err.message : String(err)
        const cancelled = /cancel/i.test(msg)
        if (!cancelled) {
          console.error('[openCamera] Camera.getPhoto failed:', err)
          toast.error(`Camera error: ${msg}`)
        }
      }
      return
    }
    // Web / desktop dev fallback — needs a real click on the input.
    fileRef.current?.click()
  }

  // Auto-open the camera on deep-link arrival (?capture=<ts>).
  useEffect(() => {
    if (!captureToken) return
    if (openedTokenRef.current === captureToken) return
    openedTokenRef.current = captureToken
    void openCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureToken])

  async function onFile(file: File) {
    const small = await downscaleImage(file)
    setBlob(small)
    await analyze(small, null)
  }

  async function analyze(image: Blob, clarification: string | null) {
    setPhase('analyzing')
    const fd = new FormData()
    fd.set('image', image, 'meal.jpg')
    if (clarification) fd.set('clarification', clarification)
    const res = await fetch('/api/nutrition/photo/analyze', { method: 'POST', body: fd })
    if (!res.ok) {
      toast.error('Could not analyze that photo. Try again.')
      setPhase('capturing')
      return
    }
    const data: PhotoAnalysis = await res.json()
    setFoodName(data.food_name)
    setMeal(data.meal_time)
    if (!data.is_food) {
      toast.error(data.question ?? "That doesn't look like food — try another photo.")
      setPhase('capturing')
      return
    }
    if (data.question) {
      setQuestion(data.question)
      setPhase('clarifying')
      return
    }
    setItems(data.items.map((it) => ({ ...it, weightEstimated: true, originalGrams: it.grams })))
    setPhase('reviewing')
  }

  function setGrams(idx: number, grams: number, estimated: boolean) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, grams, weightEstimated: estimated } : it)))
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
    setChangingIdx(null)
  }

  /** Search for a food by name and swap the ingredient at `idx` with the match. */
  async function swapIngredient(idx: number, query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    // Abort any previous in-flight search so cancelling mid-flight doesn't
    // silently apply a stale result.
    searchAbortRef.current?.abort()
    const ac = new AbortController()
    searchAbortRef.current = ac
    setSearching(true)
    try {
      const res = await fetch('/api/nutrition/photo/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: ac.signal,
      })
      if (!res.ok) {
        toast.error('Could not find that food. Try another name.')
        return
      }
      const data: AnalyzedItem = await res.json()
      // Guard: the user may have cancelled while we were waiting.
      if (changingIdx !== idx) return
      setItems((prev) => prev.map((it, i) =>
        i === idx
          ? { ...it, query: data.query, per100: data.per100, match_source: data.match_source, match_ref: data.match_ref, recipe_id: data.recipe_id, custom_food_id: data.custom_food_id, weightEstimated: false }
          : it
      ))
      setChangingIdx(null)
      setSearchQuery('')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Search failed. Try again.')
      }
    } finally {
      if (searchAbortRef.current === ac) searchAbortRef.current = null
      setSearching(false)
    }
  }

  /** Search for a food by name and append it as a new ingredient the AI missed. */
  async function addIngredient(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    // Abort any previous in-flight add so cancelling mid-flight doesn't silently
    // append a stale result. Uses its own ref/flag — independent of swap.
    addAbortRef.current?.abort()
    const ac = new AbortController()
    addAbortRef.current = ac
    setAddSearching(true)
    try {
      const res = await fetch('/api/nutrition/photo/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: ac.signal,
      })
      if (!res.ok) {
        toast.error('Could not find that food. Try another name.')
        return
      }
      const data: AnalyzedItem = await res.json()
      // No weight comes back from a name-only match, so seed a 100g default and
      // flag it estimated — the amber badge nudges the user to set the real amount.
      setItems((prev) => [
        ...prev,
        {
          query: data.query,
          grams: 100,
          per100: data.per100,
          match_source: data.match_source,
          match_ref: data.match_ref,
          recipe_id: data.recipe_id,
          custom_food_id: data.custom_food_id,
          weightEstimated: true,
          originalGrams: 100,
        },
      ])
      setAdding(false)
      setAddQuery('')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Search failed. Try again.')
      }
    } finally {
      if (addAbortRef.current === ac) addAbortRef.current = null
      setAddSearching(false)
    }
  }

  async function log() {
    if (!blob || items.length === 0) return
    setPhase('logging')
    const fd = new FormData()
    fd.set('image', blob, 'meal.jpg')
    fd.set('payload', JSON.stringify({
      food_name: foodName || 'Meal',
      notes: null,
      meal,
      date: null,
      items: items.map((it) => ({
        query: it.query, grams: it.grams, per100: it.per100, weightEstimated: it.weightEstimated,
        matchSource: it.match_source, matchRef: it.match_ref, recipeId: it.recipe_id, customFoodId: it.custom_food_id,
      })),
    }))
    const res = await fetch('/api/nutrition/photo/log', { method: 'POST', body: fd })
    if (!res.ok) {
      toast.error('Could not log that meal. Try again.')
      setPhase('reviewing')
      return
    }
    const data = await res.json()
    toast.success(`Logged: ${data.food_name} (${data.items.length} item${data.items.length === 1 ? '' : 's'})`, { duration: 2000 })
    router.push('/nutrition')
  }

  // Web-only fallback input; native uses `Camera.getPhoto()` instead.
  const hidden = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) void onFile(f)
      }}
    />
  )

  if (phase === 'analyzing' || phase === 'logging') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        {hidden}
        <Loader2 className="size-6 animate-spin" />
        <span>{phase === 'analyzing' ? 'Reading your plate…' : 'Logging…'}</span>
      </div>
    )
  }

  if (phase === 'clarifying') {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4">
        {hidden}
        <p className="text-base font-medium">{question}</p>
        <Input value={answer} placeholder="Type your answer" onChange={(e) => setAnswer(e.target.value)} autoFocus />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!answer.trim()} onClick={() => blob && analyze(blob, answer.trim())}>
            Continue
          </Button>
          <Button variant="outline" onClick={() => blob && analyze(blob, 'use your best guess')}>
            Skip
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'reviewing') {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
        {hidden}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold">{foodName || 'Your meal'}</h1>
          {/* Same exit as the camera step: leave the scanner without logging. */}
          <button
            aria-label="Close"
            onClick={() => router.push('/nutrition')}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <MealSlotChips value={meal} onChange={setMeal} />
        <ul className="space-y-3">
          {items.map((it, idx) => {
            const m = scaleTo(it.per100, it.grams)
            const isChanging = changingIdx === idx
            return (
              <li key={idx} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  {isChanging ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={searchQuery}
                        autoFocus
                        placeholder="Type the correct food…"
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) void swapIngredient(idx, searchQuery) }}
                        disabled={searching}
                        className="font-medium"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={searching || !searchQuery.trim()}
                        onClick={() => void swapIngredient(idx, searchQuery)}
                      >
                        {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      </Button>
                      <button
                        aria-label="Cancel"
                        onClick={() => { searchAbortRef.current?.abort(); setChangingIdx(null); setSearchQuery('') }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{it.query}</span>
                      <div className="flex items-center gap-2">
                        <button
                          aria-label="Change ingredient"
                          onClick={() => { addAbortRef.current?.abort(); setChangingIdx(idx); setSearchQuery(''); setAdding(false); setAddQuery('') }}
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          Change
                        </button>
                        <button
                          aria-label="Remove item"
                          onClick={() => removeItem(idx)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {!isChanging && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={it.grams === 0 ? '' : String(Math.round(it.grams))}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') { setGrams(idx, 0, false); return }
                          const n = Number(raw)
                          if (!isNaN(n) && n >= 0) setGrams(idx, n, false)
                        }}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          if (!n || n < 1) setGrams(idx, it.originalGrams || 1, true)
                        }}
                        className="w-24"
                        aria-label={`Weight in grams for ${it.query}`}
                      />
                      <span className="text-sm text-muted-foreground">g</span>
                      {/* While the AI's estimate is in effect the badge says so; once
                          the user types their own weight, offer a reset back to it. */}
                      {it.weightEstimated ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">AI estimate</span>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setGrams(idx, it.originalGrams, true)}>
                          Use AI estimate
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.round(m.kcal)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f
                    </p>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {adding ? (
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Input
              value={addQuery}
              autoFocus
              placeholder="Type a food to add…"
              onChange={(e) => setAddQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && addQuery.trim()) void addIngredient(addQuery) }}
              disabled={addSearching}
              className="font-medium"
            />
            <Button
              type="button"
              size="sm"
              disabled={addSearching || !addQuery.trim()}
              onClick={() => void addIngredient(addQuery)}
            >
              {addSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
            <button
              aria-label="Cancel"
              onClick={() => { addAbortRef.current?.abort(); setAdding(false); setAddQuery('') }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => { searchAbortRef.current?.abort(); setAdding(true); setAddQuery(''); setChangingIdx(null); setSearchQuery('') }}
          >
            <Plus className="mr-2 size-4" /> Add ingredient
          </Button>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="outline" onClick={() => { setItems([]); setPhase('capturing'); void openCamera() }}>Retake</Button>
          <Button className="flex-1" disabled={items.length === 0 || items.some((it) => it.grams < 1) || searching || addSearching} onClick={() => void log()}>Log meal</Button>
        </div>
      </div>
    )
  }

  // capturing
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {hidden}
      <button
        aria-label="Close"
        onClick={() => router.push('/nutrition')}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] text-muted-foreground hover:text-foreground"
      >
        <X className="size-6" />
      </button>
      <Camera className="size-10 text-muted-foreground" />
      <p className="text-center text-muted-foreground">Take a photo of your meal and we&apos;ll log it.</p>
      <Button onClick={() => void openCamera()}>
        <Camera className="mr-2 size-4" /> Take photo
      </Button>
    </div>
  )
}

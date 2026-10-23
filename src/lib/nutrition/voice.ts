// Minimal Web Speech API typing (not in the default TS DOM lib for webkit).
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [i: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: (e: SpeechRecognitionEventLike) => void
  onerror: (e: { error?: string }) => void
  onend: () => void
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w: Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  } = window
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

import { isNativePlatform } from '@/lib/capacitor'

export type VoiceMode = 'dictation' | 'recording' | 'unsupported'

/** Picks the voice input strategy for this browser.
 *
 *  - `dictation`: live Web Speech API transcript (Safari, Chrome).
 *  - `recording`: record with MediaRecorder and transcribe server-side via
 *    `/api/nutrition/transcribe` (Whisper) — Firefox and the native shell.
 *
 *  The native shell ALWAYS records: modern WKWebView exposes
 *  `webkitSpeechRecognition`, so a pure feature check picks dictation, which
 *  then dies silently (WebKit speech has no Capacitor permission plumbing and
 *  surfaces no error we can toast on) — and only recording mode powers the
 *  deep-link auto-submit.
 */
export function getVoiceMode(): VoiceMode {
  const canRecord =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  if (isNativePlatform()) return canRecord ? 'recording' : 'unsupported'
  if (getCtor() !== null) return 'dictation'
  return canRecord ? 'recording' : 'unsupported'
}

/** Fatal errors: the browser can't or won't provide audio (or the locale is
 *  unsupported). Auto-restart won't help — without these the restart loop would
 *  spin forever on the same failure. */
const FATAL_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported',
])

/** Starts dictation; calls onText with the running transcript. Returns a stopper.
 *
 * Sticky mode: continuous=true + auto-restart on silence so the mic stays hot
 * until the user explicitly taps Stop or the caller invokes the returned stopper.
 * Final transcripts accumulate across restarts so words spoken across a pause
 * all appear in one cohesive string. */
export function startDictation(opts: { onText: (t: string) => void; onEnd: () => void }): () => void {
  const Ctor = getCtor()
  if (!Ctor) {
    opts.onEnd()
    return () => {}
  }

  let stopped = false
  let finalText = ''
  // Mutable handle: WebKit/Safari throws InvalidStateError when start() is
  // called on an already-ended recognizer, so every restart builds a FRESH
  // instance and the stopper always targets the current one.
  let rec: SpeechRecognitionLike

  function makeRec(): SpeechRecognitionLike {
    const r = new Ctor!()
    r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
    r.interimResults = true
    r.continuous = true

    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interim += res[0].transcript
      }
      opts.onText((finalText + interim).trim())
    }

    r.onerror = (e) => {
      if (FATAL_ERRORS.has(e.error ?? '')) {
        stopped = true
        opts.onEnd()
      }
      // Non-fatal (no-speech, aborted, …): let onend's auto-restart handle it.
    }

    r.onend = () => {
      if (stopped) return
      // Auto-restart with a fresh instance: keeps the mic hot after a silent
      // pause on all engines (Safari can't restart an ended instance).
      try {
        rec = makeRec()
        rec.start()
      } catch {
        opts.onEnd()
      }
    }

    return r
  }

  rec = makeRec()
  rec.start()

  return () => {
    stopped = true
    rec.stop()
  }
}

/** Records mic audio until the returned stopper is called, then hands the
 *  encoded clip to `onStop` (Safari/WKWebView encode audio/mp4). `onStop`
 *  receives null when the mic was unavailable, permission was denied, or no
 *  audio was captured — it always fires exactly once, with the DOMException
 *  name (e.g. NotAllowedError) when getUserMedia is what failed. */
export function startRecording(opts: {
  onStop: (blob: Blob | null, errorName?: string) => void
}): () => void {
  let recorder: MediaRecorder | null = null
  let stopped = false
  const chunks: Blob[] = []

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (stopped) {
        // Stopper ran before the permission prompt resolved — discard.
        stream.getTracks().forEach((t) => t.stop())
        opts.onStop(null)
        return
      }
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = recorder?.mimeType || 'audio/mp4'
        opts.onStop(chunks.length > 0 ? new Blob(chunks, { type }) : null)
      }
      recorder.start()
    })
    .catch((err: unknown) => {
      opts.onStop(null, err instanceof DOMException ? err.name : 'UnknownError')
    })

  return () => {
    stopped = true
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }
}

/** Sends a recorded clip to the server Whisper proxy. Returns the transcript,
 *  or null on any failure. Auth rides on the logged-in session cookie. */
export async function transcribeRecording(blob: Blob): Promise<string | null> {
  // Extension must be one Whisper accepts; Firefox emits audio/ogg;codecs=opus,
  // and webm is the safest fallback for anything unrecognized.
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('file', blob, `recording.${ext}`)
  try {
    const res = await fetch('/api/nutrition/transcribe', { method: 'POST', body: form })
    if (!res.ok) return null
    const data = (await res.json()) as { text?: string }
    const text = (data.text ?? '').trim()
    return text.length > 0 ? text : null
  } catch {
    return null
  }
}

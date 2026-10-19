/**
 * Make text safe for jsPDF's built-in (WinAnsi / Latin-1) font: normalize common
 * unicode punctuation to ASCII and drop anything outside Latin-1 (a stray "→" or
 * emoji otherwise wrecks autoTable's line wrapping). Shared by every client-side
 * PDF exporter (lab lists, next-to-test, …) so the normalization stays in one place.
 */
export function pdfSafe(s: string): string {
  return s
    .replace(/[→⇒➝➔➙➡]/g, '->')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^ -ÿ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The characters jsPDF's built-in Helvetica can draw: Latin-1 plus the WinAnsi
// extras in 0x80–0x9F.
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

// Spelled out rather than dropped: in a supplement name the letter carries
// meaning (β-Alanine, α-lipoic acid, Ω-3).
const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', κ: 'kappa',
  λ: 'lambda', μ: 'µ', ω: 'omega', Ω: 'Omega',
}

const SUB_SUPER_DIGITS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

/**
 * Like `pdfSafe`, but keeps everything the built-in font CAN draw (— µ ² “ ”…)
 * and marks what it can't with "?" instead of silently dropping it. jsPDF
 * otherwise re-encodes a whole string with one unsupported character as UTF-16,
 * which garbles every letter of it. For user text whose wording must survive.
 */
export function winAnsiSafe(s: string): string {
  let out = ''
  for (const ch of s.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0
    // A non-breaking space (pasted from web pages) is Latin-1, but jsPDF will
    // not wrap a line at it.
    if (ch === '\u00a0') {
      out += ' '
    } else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(ch)) {
      out += ch
    } else if (GREEK[ch] !== undefined) {
      out += GREEK[ch]
    } else if (SUB_SUPER_DIGITS[ch] !== undefined) {
      out += SUB_SUPER_DIGITS[ch]
    } else if (/\s/.test(ch)) {
      out += ' '
    } else {
      out += '?'
    }
  }
  return out
}

import * as cheerio from 'cheerio'
import type { ParsedMayoRange, MayoParseResult } from './types'

/**
 * Parse a range string like "70-100", ">40", "<200", "0.4-4.0"
 * into numeric low/high bounds.
 */
export function parseRangeString(text: string): { low: number | null; high: number | null } {
  const trimmed = text.trim()

  // Handle "X-Y" or "X–Y" (en-dash) format
  const dashMatch = trimmed.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/)
  if (dashMatch) {
    return { low: parseFloat(dashMatch[1]), high: parseFloat(dashMatch[2]) }
  }

  // Handle ">X" or ">=X" or "≥X"
  const gtMatch = trimmed.match(/^[>≥]=?\s*([\d.]+)$/)
  if (gtMatch) {
    return { low: parseFloat(gtMatch[1]), high: null }
  }

  // Handle "<X" or "<=X" or "≤X"
  const ltMatch = trimmed.match(/^[<≤]=?\s*([\d.]+)$/)
  if (ltMatch) {
    return { low: null, high: parseFloat(ltMatch[1]) }
  }

  return { low: null, high: null }
}

/**
 * Parse pasted Mayo Clinic test catalog HTML to extract reference ranges.
 * Uses cheerio for reliable DOM traversal.
 */
export function parseMayoHtml(html: string): MayoParseResult {
  if (!html.trim()) {
    return {
      ranges: [],
      testName: null,
      error: 'No HTML content provided. Paste the full page source from a Mayo Clinic test catalog page.',
    }
  }

  const $ = cheerio.load(html)
  const testName =
    $('h1').first().text().trim() ||
    $('title').first().text().trim().split(' - ')[0] ||
    null

  const ranges: ParsedMayoRange[] = []

  $('table').each((_, table) => {
    const headers: string[] = []
    $(table)
      .find('thead tr th, thead tr td, tr:first-child th, tr:first-child td')
      .each((_, cell) => {
        headers.push($(cell).text().trim().toLowerCase())
      })

    // Look for tables that have reference-range-like headers
    const hasRangeHeader = headers.some(
      (h) =>
        h.includes('reference') ||
        h.includes('range') ||
        h.includes('interval') ||
        h.includes('value')
    )

    if (!hasRangeHeader && headers.length > 0) return

    const rows = $(table).find('tbody tr, tr').slice(headers.length > 0 ? 0 : 1)
    rows.each((_, row) => {
      const cells: string[] = []
      $(row)
        .find('td')
        .each((_, cell) => {
          cells.push($(cell).text().trim())
        })
      if (cells.length < 2) return

      // Determine sex from row content
      let sex: 'male' | 'female' | 'general' = 'general'
      const rowText = cells.join(' ').toLowerCase()
      if (rowText.includes('male') && !rowText.includes('female')) sex = 'male'
      else if (rowText.includes('female')) sex = 'female'

      // Find unit and range values from cells
      let unit = ''
      let rangeText = ''
      let component = ''

      for (let i = 0; i < cells.length; i++) {
        const headerLabel = headers[i] || ''
        if (headerLabel.includes('unit')) {
          unit = cells[i]
        } else if (
          headerLabel.includes('reference') ||
          headerLabel.includes('range') ||
          headerLabel.includes('interval') ||
          headerLabel.includes('value')
        ) {
          rangeText = cells[i]
        } else if (
          headerLabel.includes('test') ||
          headerLabel.includes('component') ||
          headerLabel.includes('name') ||
          i === 0
        ) {
          if (!component) component = cells[i]
        }
      }

      // If no header matched for range, try last cell with numeric content
      if (!rangeText) {
        for (let i = cells.length - 1; i >= 0; i--) {
          if (
            /[\d]/.test(cells[i]) &&
            (cells[i].includes('-') || cells[i].includes('>') || cells[i].includes('<'))
          ) {
            rangeText = cells[i]
            break
          }
        }
      }

      if (!rangeText) return

      const { low, high } = parseRangeString(rangeText)
      if (low === null && high === null) return

      ranges.push({
        component: component || testName || 'Unknown',
        unit,
        range_low: low,
        range_high: high,
        sex,
      })
    })
  })

  if (ranges.length === 0) {
    return {
      ranges: [],
      testName,
      error:
        'Could not find reference values in the pasted HTML. Make sure you copied the full page source of a Mayo Clinic test catalog page.',
    }
  }

  return { ranges, testName, error: null }
}

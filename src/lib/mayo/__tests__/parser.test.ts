import { describe, it, expect } from 'vitest'
import { parseMayoHtml, parseRangeString } from '../parser'

describe('parseRangeString', () => {
  it('parses "70-100" format', () => {
    expect(parseRangeString('70-100')).toEqual({ low: 70, high: 100 })
  })

  it('parses "0.4-4.0" format', () => {
    expect(parseRangeString('0.4-4.0')).toEqual({ low: 0.4, high: 4.0 })
  })

  it('parses ">40" format', () => {
    expect(parseRangeString('>40')).toEqual({ low: 40, high: null })
  })

  it('parses ">=40" format', () => {
    expect(parseRangeString('>=40')).toEqual({ low: 40, high: null })
  })

  it('parses "<200" format', () => {
    expect(parseRangeString('<200')).toEqual({ low: null, high: 200 })
  })

  it('parses "<=200" format', () => {
    expect(parseRangeString('<=200')).toEqual({ low: null, high: 200 })
  })

  it('returns null/null for unparseable input', () => {
    expect(parseRangeString('N/A')).toEqual({ low: null, high: null })
  })
})

describe('parseMayoHtml', () => {
  it('extracts ranges from valid HTML table', () => {
    const html = `
      <html><head><title>Glucose - Clinical and Interpretive</title></head>
      <body><h1>Glucose</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>Glucose</td><td>mg/dL</td><td>70-100</td></tr></tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.error).toBeNull()
    expect(result.testName).toBe('Glucose')
    expect(result.ranges.length).toBeGreaterThan(0)
    expect(result.ranges[0]).toMatchObject({
      component: 'Glucose',
      unit: 'mg/dL',
      range_low: 70,
      range_high: 100,
      sex: 'general',
    })
  })

  it('returns error for empty string', () => {
    const result = parseMayoHtml('')

    expect(result.ranges).toEqual([])
    expect(result.testName).toBeNull()
    expect(result.error).toContain('No HTML content provided')
  })

  it('returns error for whitespace-only string', () => {
    const result = parseMayoHtml('   ')

    expect(result.ranges).toEqual([])
    expect(result.error).toContain('No HTML content provided')
  })

  it('returns error when no tables found', () => {
    const html = '<html><body><h1>Glucose</h1><p>No table here</p></body></html>'
    const result = parseMayoHtml(html)

    expect(result.ranges).toEqual([])
    expect(result.error).toContain('Could not find reference values')
  })

  it('extracts sex-specific ranges from Male/Female rows', () => {
    const html = `
      <html><body><h1>Hemoglobin</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody>
          <tr><td>Male</td><td>g/dL</td><td>13.5-17.5</td></tr>
          <tr><td>Female</td><td>g/dL</td><td>12.0-16.0</td></tr>
        </tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.error).toBeNull()
    expect(result.ranges.length).toBe(2)

    const maleRange = result.ranges.find((r) => r.sex === 'male')
    expect(maleRange).toMatchObject({
      unit: 'g/dL',
      range_low: 13.5,
      range_high: 17.5,
      sex: 'male',
    })

    const femaleRange = result.ranges.find((r) => r.sex === 'female')
    expect(femaleRange).toMatchObject({
      unit: 'g/dL',
      range_low: 12.0,
      range_high: 16.0,
      sex: 'female',
    })
  })

  it('extracts unit from table header or cell', () => {
    const html = `
      <html><body><h1>TSH</h1>
      <table>
        <thead><tr><th>Component</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>TSH</td><td>mIU/L</td><td>0.4-4.0</td></tr></tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.error).toBeNull()
    expect(result.ranges[0]).toMatchObject({
      unit: 'mIU/L',
      range_low: 0.4,
      range_high: 4.0,
    })
  })

  it('handles greater-than range format', () => {
    const html = `
      <html><body><h1>HDL Cholesterol</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>HDL</td><td>mg/dL</td><td>>40</td></tr></tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.error).toBeNull()
    expect(result.ranges[0]).toMatchObject({
      range_low: 40,
      range_high: null,
    })
  })

  it('handles less-than range format', () => {
    const html = `
      <html><body><h1>LDL Cholesterol</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>LDL</td><td>mg/dL</td><td><200</td></tr></tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.error).toBeNull()
    expect(result.ranges[0]).toMatchObject({
      range_low: null,
      range_high: 200,
    })
  })

  it('uses test name from h1 or title', () => {
    const html = `
      <html><head><title>Vitamin D, 25-Hydroxy - Clinical Info</title></head>
      <body><h1>Vitamin D, 25-Hydroxy</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>Vitamin D</td><td>ng/mL</td><td>30-100</td></tr></tbody>
      </table></body></html>
    `
    const result = parseMayoHtml(html)

    expect(result.testName).toBe('Vitamin D, 25-Hydroxy')
  })
})

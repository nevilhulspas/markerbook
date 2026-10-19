import { describe, it, expect, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { rangeFromReport, estimateRange, estimateRangeByName } from '../ranges'

// ---------------------------------------------------------------------------
// Part 1: rangeFromReport
// ---------------------------------------------------------------------------

describe('rangeFromReport', () => {
  it('returns a report range when both low and high are numbers', () => {
    const result = rangeFromReport({ ref_range_low: 0.8, ref_range_high: 1.8 })
    expect(result).toEqual({ low: 0.8, high: 1.8, source: 'report' })
  })

  it('returns a report range when only low is provided', () => {
    const result = rangeFromReport({ ref_range_low: 0.5, ref_range_high: null })
    expect(result).toEqual({ low: 0.5, high: null, source: 'report' })
  })

  it('returns a report range when only high is provided', () => {
    const result = rangeFromReport({ ref_range_low: null, ref_range_high: 10.0 })
    expect(result).toEqual({ low: null, high: 10.0, source: 'report' })
  })

  it('returns null when both are null', () => {
    const result = rangeFromReport({ ref_range_low: null, ref_range_high: null })
    expect(result).toBeNull()
  })

  it('returns null when the object has no ref_range fields', () => {
    const result = rangeFromReport({})
    expect(result).toBeNull()
  })

  it('returns null when both are undefined', () => {
    const result = rangeFromReport({ ref_range_low: undefined, ref_range_high: undefined })
    expect(result).toBeNull()
  })

  it('returns a report range when low is 0 (falsy but valid)', () => {
    const result = rangeFromReport({ ref_range_low: 0, ref_range_high: 100 })
    expect(result).toEqual({ low: 0, high: 100, source: 'report' })
  })
})

// ---------------------------------------------------------------------------
// Part 2: estimateRange (mocked Anthropic)
// ---------------------------------------------------------------------------

describe('estimateRangeByName', () => {
  it('returns an ai_estimated range from a name + unit (no LOINC code)', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":30,"high":90,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRangeByName('DGLA', 'mg/l', mockAi)

    expect(result).toEqual({
      low: 30,
      high: 90,
      lowMale: null,
      highMale: null,
      lowFemale: null,
      highFemale: null,
      source: 'ai_estimated',
    })
    expect(mockAi.messages.create).toHaveBeenCalledOnce()
  })

  it('returns null when the model has no confident range', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":null,"high":null,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
        }),
      },
    } as unknown as Anthropic

    expect(await estimateRangeByName('Mystery analyte', 'arb', mockAi)).toBeNull()
  })
})

describe('estimateRange', () => {
  it('returns ai_estimated range when model returns low and high', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":0.8,"high":1.8,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toEqual({
      low: 0.8,
      high: 1.8,
      lowMale: null,
      highMale: null,
      lowFemale: null,
      highFemale: null,
      source: 'ai_estimated',
    })
    expect(mockAi.messages.create).toHaveBeenCalledOnce()
  })

  it('returns ai_estimated range with sex-specific values for ferritin', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '{"low":12,"high":300,"low_male":30,"high_male":400,"low_female":12,"high_female":150}',
            },
          ],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toEqual({
      low: 12,
      high: 300,
      lowMale: 30,
      highMale: 400,
      lowFemale: 12,
      highFemale: 150,
      source: 'ai_estimated',
    })
  })

  it('derives the overall range from the sex-specific bounds when the model leaves it empty', async () => {
    // Haiku 5.5 reads the prompt literally: for ferritin it fills only the
    // male/female bounds. The overall range spans both.
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":null,"high":null,"low_male":24,"high_male":336,"low_female":11,"high_female":307}' }],
        }),
      },
    } as unknown as Anthropic

    expect(await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)).toEqual({
      low: 11,
      high: 336,
      lowMale: 24,
      highMale: 336,
      lowFemale: 11,
      highFemale: 307,
      source: 'ai_estimated',
    })
    expect(await estimateRangeByName('Ferritin', 'ng/mL', mockAi)).toMatchObject({ low: 11, high: 336 })
  })

  it('does not turn a one-sex range into the overall range', async () => {
    const oneSex = (text: string) =>
      ({ messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }) } }) as unknown as Anthropic
    // Men only (e.g. testosterone): a woman must not get this as her range.
    expect(
      await estimateRange('2986-8', 'Testosterone', 'nmol/L', oneSex('{"low":null,"high":null,"low_male":8.6,"high_male":29,"low_female":null,"high_female":null}'))
    ).toBeNull()
    // Mixed pair (male low, female high) is not a range either.
    expect(
      await estimateRange('2986-8', 'Testosterone', 'nmol/L', oneSex('{"low":null,"high":null,"low_male":8.6,"high_male":null,"low_female":null,"high_female":2.4}'))
    ).toBeNull()
  })

  it('still returns null when every bound is empty', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":null,"high":null,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
        }),
      },
    } as unknown as Anthropic
    expect(await estimateRange('0000-0', 'Unknown', 'U/L', mockAi)).toBeNull()
  })

  it('returns null when model returns all-null range (no confident data)', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":null,"high":null,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('99999-9', 'Unknown Analyte', 'arb_unit', mockAi)

    expect(result).toBeNull()
  })

  it('returns null when model returns the string "null"', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'null' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('99999-9', 'Unknown Analyte', 'arb_unit', mockAi)

    expect(result).toBeNull()
  })

  it('returns null when model output has no parseable JSON', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'I cannot determine a reference range for this analyte.' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('99999-9', 'Unknown Analyte', 'arb_unit', mockAi)

    expect(result).toBeNull()
  })

  it('returns null when content array has no text block', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toBeNull()
  })

  it('calls the fast Haiku model without thinking and passes the prompt via system param', async () => {
    const createFn = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"low":4,"high":11,"low_male":null,"high_male":null,"low_female":null,"high_female":null}' }],
    })
    const mockAi = { messages: { create: createFn } } as unknown as Anthropic

    await estimateRange('6690-2', 'Leukocytes', '10*3/uL', mockAi)

    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-5-5',
        thinking: { type: 'disabled' },
        system: expect.stringContaining('reference-range'),
      }),
    )
  })

  it('returns null when low is a string (non-finite-number) — never flows to numeric insert', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":"12","high":18}' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toBeNull()
  })

  it('returns null when high is the string "N/A"', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"low":12,"high":"N/A"}' }],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toBeNull()
  })

  it('coerces an invalid sex-specific bound to null instead of failing the whole range', async () => {
    const mockAi = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '{"low":12,"high":300,"low_male":"thirty","high_male":400,"low_female":12,"high_female":150}',
            },
          ],
        }),
      },
    } as unknown as Anthropic

    const result = await estimateRange('2276-4', 'Ferritin', 'ng/mL', mockAi)

    expect(result).toEqual({
      low: 12,
      high: 300,
      lowMale: null, // invalid "thirty" coerced to null
      highMale: 400,
      lowFemale: 12,
      highFemale: 150,
      source: 'ai_estimated',
    })
  })
})

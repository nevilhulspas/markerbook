import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GridData } from '@/lib/grid/grid-types'
import type { Biomarker } from '@/lib/database.types'

// Mock jsPDF and autoTable before importing the module under test
const mockSave = vi.fn()
const mockText = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetFont = vi.fn()
const mockGetTextWidth = vi.fn(() => 50)

const mockJsPDFInstance = {
  save: mockSave,
  text: mockText,
  setFontSize: mockSetFontSize,
  setTextColor: mockSetTextColor,
  setFont: mockSetFont,
  getTextWidth: mockGetTextWidth,
  internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
  lastAutoTable: { finalY: 150 },
}

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockJsPDFInstance)
    return this
  }),
}))

const mockAutoTable = vi.fn()
vi.mock('jspdf-autotable', () => ({
  default: vi.fn((doc: unknown, opts: unknown) => {
    mockAutoTable(doc, opts)
    // Simulate autoTable setting lastAutoTable
    ;(doc as Record<string, unknown>).lastAutoTable = { finalY: 150 }
  }),
}))

function makeBiomarker(overrides: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-1',
    name: 'Hemoglobin',
    short_name: 'Hgb',
    unit: 'g/dL',
    category: 'Hematology',
    description: null,
    aliases: null,
    sample_type: 'blood',
    ref_range_low: 12,
    ref_range_high: 17,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    created_at: '',
    parent_id: null,
    display_order: null,
    panel_id: null,
    is_parent: false,
    ...overrides,
  } as Biomarker
}

function makeGridData(): GridData {
  return {
    rows: [
      {
        biomarker: makeBiomarker(),
        category: 'Hematology',
        values: {
          'test-1': { value: 14.5, unit: 'g/dL', resultId: 'r1' },
        },
        referenceRanges: [
          {
            id: 'rr-1',
            biomarker_id: 'bm-1',
            unit: 'g/dL',
            sex: 'general',
            age_min: null,
            age_max: null,
            range_low: 12,
            range_high: 17,
            range_type: 'normal',
            source: 'test',
            source_url: null,
            verified_at: null,
            verified_by: null,
            phase: null,
            created_at: '',
          },
        ],
      },
    ],
    testDates: [
      { id: 'test-1', date: '2025-01-15', name: 'Blood Test Jan' },
    ],
  }
}

describe('exportGridAsPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a jsPDF instance in landscape orientation', async () => {
    const { jsPDF } = await import('jspdf')
    const { exportGridAsPdf } = await import('./export-pdf')

    exportGridAsPdf(makeGridData())

    expect(jsPDF).toHaveBeenCalledWith({ orientation: 'landscape' })
  })

  it('calls autoTable with headers including test date columns', async () => {
    const { exportGridAsPdf } = await import('./export-pdf')

    exportGridAsPdf(makeGridData())

    expect(mockAutoTable).toHaveBeenCalledTimes(1)
    const [, opts] = mockAutoTable.mock.calls[0] as [unknown, { head: string[][]; body: string[][] }]
    const headers = opts.head[0]
    expect(headers).toContain('Marker')
    expect(headers).toContain('Unit')
    expect(headers).toContain('Ref. Range')
    expect(headers).toContain('2025-01-15')
  })

  it('calls doc.save with a filename containing the current date', async () => {
    const { exportGridAsPdf } = await import('./export-pdf')

    exportGridAsPdf(makeGridData())

    expect(mockSave).toHaveBeenCalledTimes(1)
    const filename = mockSave.mock.calls[0][0] as string
    expect(filename).toMatch(/^markerbook-report-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})

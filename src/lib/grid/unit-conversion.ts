import type { BiomarkerUnit } from '@/lib/database.types'

/**
 * Normalize a unit string for comparison.
 * Handles case differences and Unicode variants (µ vs u).
 */
export function normalizeUnit(unit: string): string {
  return unit
    .toLowerCase()
    .replace(/µ/g, 'u')  // Unicode micro sign → ASCII u
    .replace(/μ/g, 'u')  // Greek mu → ASCII u
}

function findUnit(units: BiomarkerUnit[], unit: string): BiomarkerUnit | undefined {
  const normalized = normalizeUnit(unit)
  return units.find((u) => normalizeUnit(u.unit) === normalized)
}

/**
 * Convert a value from one unit to another using biomarker unit conversion factors.
 * Convention: conversion_factor converts FROM this unit TO the default unit.
 * To convert between two units: value * fromFactor / toFactor
 *
 * Returns `null` when the conversion is NOT possible — either unit missing a
 * catalog factor (e.g. a lab reported mmol/L but the catalog only knows g/dL
 * and g/L). Callers MUST keep the original value+unit in that case: silently
 * returning the input relabelled as the target unit mislabels the number
 * (10.4 mmol/L Hgb is ~168 g/L, not "10.4 g/L").
 */
export function convertValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  units: BiomarkerUnit[]
): number | null {
  if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return value
  const fromInfo = findUnit(units, fromUnit)
  const toInfo = findUnit(units, toUnit)
  if (!fromInfo || !toInfo) return null // conversion not possible
  return (value * fromInfo.conversion_factor) / toInfo.conversion_factor
}

/**
 * Get the default unit for a biomarker from its units list.
 */
export function getDefaultUnit(units: BiomarkerUnit[]): string | null {
  return units.find((u) => u.is_default)?.unit ?? units[0]?.unit ?? null
}

/**
 * Format a converted value with appropriate precision.
 */
export function formatConverted(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

/** Map of biomarker_id -> preferred unit string */
export type UnitPreferenceMap = Map<string, string>

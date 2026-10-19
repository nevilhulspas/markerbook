import type { Lab, LabStatus } from '@/lib/database.types'

export const STATUS_OPTIONS: LabStatus[] = ['pending', 'approved', 'rejected']

// Shared by the lab form's status field and the table row's inline status select.
export const selectClassName =
  'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none'

export interface LabFormValues {
  name: string
  country: string
  city: string
  website: string
  description: string
  status: LabStatus
}

// Empty fields (status 'approved') for a new lab, or the lab's own values with
// nulls shown as empty strings when editing.
export function labFormInitialValues(lab: Lab | null): LabFormValues {
  if (!lab) {
    return {
      name: '',
      country: '',
      city: '',
      website: '',
      description: '',
      status: 'approved',
    }
  }
  return {
    name: lab.name,
    country: lab.country ?? '',
    city: lab.city ?? '',
    website: lab.website ?? '',
    description: lab.description ?? '',
    status: lab.status,
  }
}

export function validateLabForm(values: LabFormValues): string | null {
  return values.name.trim() ? null : 'Lab name is required.'
}

// Trimmed details with blank optional fields sent as null.
function toLabDetails(values: LabFormValues) {
  return {
    name: values.name.trim(),
    country: values.country.trim() || null,
    city: values.city.trim() || null,
    website: values.website.trim() || null,
    description: values.description.trim() || null,
  }
}

// `adminCreateLab` input — the only path that sets a status.
export function toCreateLabInput(values: LabFormValues) {
  return { ...toLabDetails(values), status: values.status }
}

// `adminUpdateLab` patch — status is changed from the table row, never here.
export function toUpdateLabPatch(values: LabFormValues) {
  return toLabDetails(values)
}

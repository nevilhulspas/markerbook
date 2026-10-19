'use client'

import { useCallback, useRef, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  gridFiltersSchema,
  type GridFilters,
} from '@/lib/validations/grid-filters'

function parseFiltersFromParams(
  searchParams: URLSearchParams
): GridFilters {
  const raw: Record<string, unknown> = {}

  const search = searchParams.get('search')
  if (search) raw.search = search

  const categories = searchParams.get('categories')
  if (categories) raw.categories = categories.split(',')

  const status = searchParams.get('status')
  if (status) raw.status = status.split(',')

  const dateFrom = searchParams.get('dateFrom')
  if (dateFrom) raw.dateFrom = dateFrom

  const dateTo = searchParams.get('dateTo')
  if (dateTo) raw.dateTo = dateTo

  const result = gridFiltersSchema.safeParse(raw)
  return result.success ? result.data : {}
}

function filtersToParams(
  filters: GridFilters,
  base: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams(base)

  // Remove all filter params first
  params.delete('search')
  params.delete('categories')
  params.delete('status')
  params.delete('dateFrom')
  params.delete('dateTo')

  // Set active filters
  if (filters.search) params.set('search', filters.search)
  if (filters.categories?.length)
    params.set('categories', filters.categories.join(','))
  if (filters.status?.length)
    params.set('status', filters.status.join(','))
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)

  return params
}

export function useGridFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams]
  )

  const updateURL = useCallback(
    (newFilters: GridFilters) => {
      const params = filtersToParams(newFilters, searchParams)
      const queryString = params.toString()
      const url = queryString ? `${pathname}?${queryString}` : pathname
      router.replace(url, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  const setSearch = useCallback(
    (term: string) => {
      // Debounce search input -- 300ms
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
      searchTimerRef.current = setTimeout(() => {
        const newFilters = { ...parseFiltersFromParams(searchParams) }
        if (term) {
          newFilters.search = term
        } else {
          delete newFilters.search
        }
        updateURL(newFilters)
      }, 300)
    },
    [searchParams, updateURL]
  )

  const setCategories = useCallback(
    (cats: string[]) => {
      const newFilters = { ...parseFiltersFromParams(searchParams) }
      if (cats.length > 0) {
        newFilters.categories = cats
      } else {
        delete newFilters.categories
      }
      updateURL(newFilters)
    },
    [searchParams, updateURL]
  )

  const setStatus = useCallback(
    (statuses: GridFilters['status']) => {
      const newFilters = { ...parseFiltersFromParams(searchParams) }
      if (statuses && statuses.length > 0) {
        newFilters.status = statuses
      } else {
        delete newFilters.status
      }
      updateURL(newFilters)
    },
    [searchParams, updateURL]
  )

  const setDateRange = useCallback(
    (from?: string, to?: string) => {
      const newFilters = { ...parseFiltersFromParams(searchParams) }
      if (from) {
        newFilters.dateFrom = from
      } else {
        delete newFilters.dateFrom
      }
      if (to) {
        newFilters.dateTo = to
      } else {
        delete newFilters.dateTo
      }
      updateURL(newFilters)
    },
    [searchParams, updateURL]
  )

  const clearFilters = useCallback(() => {
    updateURL({})
  }, [updateURL])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.categories?.length) count++
    if (filters.status?.length) count++
    if (filters.dateFrom || filters.dateTo) count++
    return count
  }, [filters])

  return {
    filters,
    setSearch,
    setCategories,
    setStatus,
    setDateRange,
    clearFilters,
    activeFilterCount,
  }
}

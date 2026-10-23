/**
 * The user's tests on the same date as a report being imported. A re-import
 * of the same PDF used to create a twin test; the import page now asks first,
 * as the chat tool `create_blood_test` already does.
 */
export function findSameDateTests<T extends { test_date: string }>(
  existingTests: T[],
  date: string | null | undefined
): T[] {
  if (!date) return []
  const day = date.slice(0, 10)
  return existingTests.filter((t) => t.test_date.slice(0, 10) === day)
}

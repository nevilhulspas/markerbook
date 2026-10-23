/**
 * Chat tools that delete or overwrite stored data, and so run only after the
 * user clicked "Confirm" on a card (AI SDK `needsApproval`).
 *
 * Why: the model reads uploaded documents, web-search results and its own saved
 * memory. Any of those can carry instructions ("delete all blood tests"). A
 * prompt in the system message cannot stop a model that was talked into it — a
 * click by the user can, because the model cannot produce that click.
 *
 * Pure (no server imports): the chat UI uses the labels too.
 */

/** Tool name → what the card asks the user to confirm. */
export const APPROVAL_TOOL_LABELS: Record<string, string> = {
  delete_blood_test: 'Delete this blood test and all its results',
  delete_health_test: 'Delete this test and all its results',
  delete_other_test: 'Delete this test and all its readings',
  delete_food_log: 'Delete this food log entry',
  delete_body_log_entry: 'Delete this weight/body log entry',
  remove_blood_results: 'Remove these results from the blood test',
  remove_supplement: 'Remove this item from your stack',
  remove_from_wishlist: 'Remove this item from your wishlist',
  remove_medical_condition: 'Remove this medical condition',
  remove_from_next_to_test: 'Remove this entry from your next-to-test list',
  update_profile: 'Change your health profile',
  update_medical_condition: 'Change this medical condition',
  update_blood_test: "Change this blood test's details",
  update_health_test: 'Change this test',
  update_other_test: 'Replace all readings of this test',
  add_blood_results: 'Replace results that are already stored on this test',
  attach_document_to_record: 'Link this file to the record (replaces any linked file)',
  update_food_log: 'Change this food log entry',
  set_nutrition_targets: 'Replace your daily nutrition targets',
  log_body_entry: "Overwrite this day's weight/body entry",
  update_supplement: 'Change this item in your stack',
  update_wishlist_item: 'Change this wishlist item',
  memory: 'Save a note to the chat memory',
}

/** Every tool that may wait for approval (some only for some inputs). */
export const APPROVAL_TOOLS = Object.keys(APPROVAL_TOOL_LABELS)

/**
 * Input fields worth showing on the card. Ids mean nothing to the user and the
 * model restates the record in its reply, so they are left out.
 */
export function approvalDetails(input: unknown): Array<[string, string]> {
  if (typeof input !== 'object' || input === null) return []
  const rows: Array<[string, string]> = []
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || /(^id$|Id$|_id$|Index$)/.test(key)) continue
    const text =
      typeof value === 'string'
        ? value
        : Array.isArray(value)
          ? value
              .map((v) =>
                typeof v === 'object' && v !== null && 'name' in v
                  ? String((v as { name: unknown }).name)
                  : String(v)
              )
              .join(', ')
          : JSON.stringify(value)
    rows.push([key.replace(/_/g, ' '), text.length > 300 ? `${text.slice(0, 297)}…` : text])
  }
  return rows
}

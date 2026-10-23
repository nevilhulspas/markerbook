import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { createSupplementSchema, intakesSchema } from '@/lib/validations/supplement'
import { deriveFrequency, normalizeTime } from '@/lib/supplements/intake'
import { replaceSupplementIntakes } from '@/lib/supplements/replace-intakes'
import { wishlistItemSchema, wishlistSourceSchema } from '@/lib/validations/wishlist'
import { omitUndefined } from '@/lib/object/omit-undefined'
import { appTodayISO } from '@/lib/dates/today'

const today = () => appTodayISO()

/**
 * Intake moments as the model supplies them. Sent whole: providing the array
 * replaces every moment, omitting it leaves them untouched — the same contract
 * as the other optional fields on these tools.
 */
const intakesParam = z
  .array(
    z.object({
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .describe('24-hour wall-clock time, e.g. "08:00"'),
      amount: z
        .string()
        .optional()
        .describe('How much is taken at this time, e.g. "1 capsule"'),
    })
  )
  .max(12)
  .optional()
  .describe(
    'The times of day this is taken, each with its amount. Provide the COMPLETE list — it replaces any existing moments. Two entries express a split intake (1 capsule at 08:00, 2 at 22:00). Omit to leave the existing moments alone.'
  )

type IntakeInput = { time: string; amount?: string }

/**
 * Insights-chat tools to CRUD the user's stack (supplements — active, upcoming
 * and stopped) and wishlist.
 * `supabase` is a service-role client; every query filters by `userId`.
 * WRITE only on explicit user intent; never silently. Disambiguate with ask_user.
 */
export function createStackTools(supabase: TypedSupabaseClient, userId: string) {
  /**
   * Validate and write a supplement's intake moments. The dedup refine lives in
   * `intakesSchema`; the tools build their payloads by hand, so it has to be
   * applied here or two moments at the same time reach the UNIQUE constraint.
   */
  async function writeIntakes(
    supplementId: string,
    rows: IntakeInput[]
  ): Promise<string | null> {
    const parsed = intakesSchema.safeParse(rows)
    if (!parsed.success) {
      return parsed.error.issues[0]?.message ?? 'Invalid intake moments'
    }

    const { data: owned } = await supabase
      .from('supplements')
      .select('id')
      .eq('id', supplementId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!owned) return 'Supplement not found.'

    return replaceSupplementIntakes(supabase, supplementId, userId, rows)
  }

  return {
    list_stack: tool({
      description:
        "Read the user's FULL supplement/med stack — EVERY entry across all stack lists, each tagged with a `status`: `active` (taking now), `upcoming` (a future `start_date`, scheduled but not started yet), or `stopped` (has an `end_date`). Use this — not just the active list — whenever checking whether the user already takes/has something. Each entry carries its intake moments (`intakes`: time + amount); `frequency` is DERIVED from those moments. NOTE: the wishlist (things they want to buy or try) is a SEPARATE list — also call list_wishlist when answering \"do I already have/take this\". Freely callable.",
      inputSchema: z.object({}),
      execute: async () => {
        // Cap the rows sent to the model: newest-first + limit keeps all active
        // and upcoming entries plus recent stopped ones, while dropping a long
        // tail of old stopped entries that would bloat the LLM context.
        const { data } = await supabase
          .from('supplements')
          .select('id, name, dose, frequency, notes, start_date, end_date, intakes:supplement_intakes(time_of_day, amount)')
          .eq('user_id', userId)
          .order('start_date', { ascending: false })
          .limit(200)
        const t = today()
        // Status mirrors matchesSupplementMode (src/lib/supplements/mode.ts) so the
        // chat and the Stack tabs classify each entry identically.
        const supplements = (data ?? []).map((s) => {
          const row = s as typeof s & {
            intakes?: { time_of_day: string; amount: string | null }[] | null
          }
          const intakes = (row.intakes ?? [])
            .map((i) => ({ time: normalizeTime(i.time_of_day), amount: i.amount }))
            .sort((a, b) => a.time.localeCompare(b.time))
          return {
            ...row,
            intakes,
            frequency: deriveFrequency(intakes, s.frequency, s.end_date),
            status: s.end_date ? 'stopped' : s.start_date > t ? 'upcoming' : 'active',
          }
        })
        return { supplements }
      },
    }),

    add_supplement: tool({
      description:
        "Add a supplement/med to the user's stack. Use ONLY when the user explicitly says they take/started something or asks to add it. Defaults to starting today; pass `start_date` (YYYY-MM-DD) to SCHEDULE a future start (or backdate). A future start_date plans it ahead — no need to delete-and-re-add. Use `intakes` to say WHEN it is taken, e.g. [{\"time\":\"08:00\",\"amount\":\"1 capsule\"},{\"time\":\"22:00\",\"amount\":\"2 capsules\"}]. Pass `end_date` to add something that is already finished, or that is planned to stop on a known date.",
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        dose: z.string().optional(),
        intakes: intakesParam,
        notes: z.string().optional(),
        start_date: z.string().date().optional(),
        end_date: z.string().date().optional(),
      }),
      execute: async (input) => {
        const parsed = createSupplementSchema.safeParse({ ...input, start_date: input.start_date ?? today() })
        if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid supplement' }
        const { data, error } = await supabase
          .from('supplements')
          .insert({
            user_id: userId,
            name: parsed.data.name,
            dose: parsed.data.dose ?? null,
            start_date: parsed.data.start_date,
            end_date: parsed.data.end_date ?? null,
            notes: parsed.data.notes ?? null,
          })
          .select('id, name')
          .single()
        if (error || !data) return { error: error?.message ?? 'Failed to add supplement' }
        if (input.intakes && input.intakes.length > 0) {
          const intakeError = await writeIntakes((data as { id: string }).id, input.intakes)
          if (intakeError) return { error: `Supplement added but intake times failed: ${intakeError}` }
        }
        return { added: data, intakes: input.intakes ?? [] }
      },
    }),

    update_supplement: tool({
      description:
        "Update a supplement by its id (get ids from list_stack). Only the provided fields change. Pass `name` to rename it (correcting a typo or brand). Use `start_date` (YYYY-MM-DD) to reschedule, `end_date` to stop it on a date (a future end_date schedules a pause without deleting), or `end_date: null` to reactivate. Use `intakes` to set WHEN it is taken, e.g. [{\"time\":\"08:00\",\"amount\":\"1 capsule\"},{\"time\":\"22:00\",\"amount\":\"2 capsules\"}]; the array replaces every existing moment, and [] clears them.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        dose: z.string().optional(),
        intakes: intakesParam,
        notes: z.string().optional(),
        start_date: z.string().date().optional(),
        end_date: z.string().date().nullable().optional(),
      }),
      needsApproval: true,
      execute: async ({ id, intakes, ...patch }) => {
        const clean = omitUndefined(patch)
        if (Object.keys(clean).length === 0 && intakes === undefined) {
          return { error: 'No fields to update.' }
        }
        if (Object.keys(clean).length > 0) {
          const { error } = await supabase.from('supplements').update(clean).eq('id', id).eq('user_id', userId)
          if (error) return { error: error.message }
        }
        if (intakes !== undefined) {
          const intakeError = await writeIntakes(id, intakes)
          if (intakeError) return { error: intakeError }
        }
        return { updated: id, intakes }
      },
    }),

    remove_supplement: tool({
      description: "Remove a supplement from the stack by its id (anything returned by list_stack — active, upcoming/scheduled OR stopped). Use only when the user asks to delete/cancel it.",
      inputSchema: z.object({ id: z.string() }),
      needsApproval: true,
      execute: async ({ id }) => {
        const { error } = await supabase.from('supplements').delete().eq('id', id).eq('user_id', userId)
        return error ? { error: error.message } : { removed: id }
      },
    }),

    list_wishlist: tool({
      description: "Read the user's wishlist (supplements/meds they want to buy or try) with each item's buy-sources. Freely callable.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .from('wishlist_items')
          .select('id, name, priority, notes, sources:wishlist_sources(id, brand, url, price, currency)')
          .eq('user_id', userId)
        return { items: data ?? [] }
      },
    }),

    add_to_wishlist: tool({
      description:
        "Add a supplement/med to the user's WISHLIST. Use ONLY when the user explicitly asks to add/remember it. Optionally include buy-sources (brand/url/price).",
      inputSchema: z.object({
        name: z.string(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        notes: z.string().optional(),
        sources: z
          .array(z.object({
            brand: z.string().optional(),
            url: z.string().optional(),
            price: z.number().optional(),
            currency: z.string().optional(),
          }))
          .optional(),
      }),
      execute: async ({ name, priority, notes, sources }) => {
        const parsed = wishlistItemSchema.safeParse({ name, priority, notes })
        if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid item' }
        const { data: item, error } = await supabase
          .from('wishlist_items')
          .insert({ user_id: userId, name: parsed.data.name, priority: parsed.data.priority ?? null, notes: parsed.data.notes ?? null })
          .select('id, name')
          .single()
        if (error || !item) return { error: error?.message ?? 'Failed to add to wishlist' }
        if (sources && sources.length > 0) {
          const rows = sources
            .map((s) => wishlistSourceSchema.safeParse(s))
            .filter((r): r is Extract<typeof r, { success: true }> => r.success)
            .map((r) => ({
              item_id: (item as { id: string }).id,
              user_id: userId,
              brand: r.data.brand ?? null,
              url: r.data.url ?? null,
              price: r.data.price ?? null,
              currency: r.data.currency ?? 'EUR',
            }))
          if (rows.length > 0) {
            const { error: srcErr } = await supabase.from('wishlist_sources').insert(rows)
            if (srcErr) {
              // Roll back the item so we don't leave one with no sources.
              await supabase.from('wishlist_items').delete().eq('id', (item as { id: string }).id).eq('user_id', userId)
              return { error: `Item created but failed to save sources: ${srcErr.message}` }
            }
          }
        }
        return { added: item }
      },
    }),

    update_wishlist_item: tool({
      description: "Update a wishlist item by its id (get ids from list_wishlist). Only the provided fields change.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
        notes: z.string().optional(),
      }),
      needsApproval: true,
      execute: async ({ id, ...patch }) => {
        const clean = omitUndefined(patch)
        if (Object.keys(clean).length === 0) return { error: 'No fields to update.' }
        const { error } = await supabase.from('wishlist_items').update(clean).eq('id', id).eq('user_id', userId)
        return error ? { error: error.message } : { updated: id }
      },
    }),

    remove_from_wishlist: tool({
      description: "Remove a wishlist item (and its sources) by its id. Use only when the user asks to delete it.",
      inputSchema: z.object({ id: z.string() }),
      needsApproval: true,
      execute: async ({ id }) => {
        const { error } = await supabase.from('wishlist_items').delete().eq('id', id).eq('user_id', userId)
        return error ? { error: error.message } : { removed: id }
      },
    }),

    add_wishlist_source: tool({
      description: "Add a buy-source (brand/url/price) to an existing wishlist item by its id.",
      inputSchema: z.object({
        itemId: z.string(),
        brand: z.string().optional(),
        url: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
      }),
      execute: async ({ itemId, ...src }) => {
        const parsed = wishlistSourceSchema.safeParse(src)
        if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid source' }
        const { data: item } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('id', itemId)
          .eq('user_id', userId)
          .maybeSingle()
        if (!item) return { error: 'Wishlist item not found.' }
        const { error } = await supabase.from('wishlist_sources').insert({
          item_id: itemId,
          user_id: userId,
          brand: parsed.data.brand ?? null,
          url: parsed.data.url ?? null,
          price: parsed.data.price ?? null,
          currency: parsed.data.currency ?? 'EUR',
        })
        return error ? { error: error.message } : { added: true }
      },
    }),

    move_wishlist_to_stack: tool({
      description:
        "Move a wishlist item into the stack (the user started taking it). Creates a supplement and removes the wishlist item. Defaults to starting today; pass `start_date` (YYYY-MM-DD) to schedule a future start. Use `intakes` to say WHEN it is taken. Use only on explicit intent.",
      inputSchema: z.object({
        itemId: z.string(),
        dose: z.string().optional(),
        intakes: intakesParam,
        start_date: z.string().date().optional(),
      }),
      execute: async ({ itemId, dose, intakes, start_date }) => {
        const { data: item } = await supabase
          .from('wishlist_items')
          .select('id, name')
          .eq('id', itemId)
          .eq('user_id', userId)
          .maybeSingle()
        if (!item) return { error: 'Wishlist item not found.' }
        const { data: created, error: insErr } = await supabase
          .from('supplements')
          .insert({
            user_id: userId,
            name: (item as { name: string }).name,
            dose: dose ?? null,
            start_date: start_date ?? today(),
          })
          .select('id')
          .single()
        if (insErr || !created) return { error: insErr?.message ?? 'Failed to add supplement' }
        // Do NOT return early on an intake failure: the supplement row already
        // exists, so bailing here would leave the item on the Wishlist too and
        // report it twice. Carry the warning through the wishlist delete instead.
        let intakeWarning: string | null = null
        if (intakes && intakes.length > 0) {
          intakeWarning = await writeIntakes((created as { id: string }).id, intakes)
        }
        const { error: delErr } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', userId)
        if (delErr) return { error: `Supplement added but failed to remove wishlist item: ${delErr.message}` }
        if (intakeWarning) {
          return { moved: (item as { name: string }).name, warning: `Moved, but the intake times were not saved: ${intakeWarning}` }
        }
        return { moved: (item as { name: string }).name }
      },
    }),
  }
}

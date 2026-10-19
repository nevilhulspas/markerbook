import {
  streamText,
  consumeStream,
  convertToModelMessages,
  isStepCount,
  toUIMessageStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FilePart,
  type ImagePart,
  type UIMessage,
  type UserContent,
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildInsightsChatSystemPrompt } from '@/lib/insights/insights-chat-prompt'
import { createMemoryTool, loadMemoryForPrompt } from '@/lib/insights/memory-tool'
import { createLabTestTools } from '@/lib/labs/lab-test-tools'
import { createStackTools } from '@/lib/insights/stack-tools'
import { createDocumentIndexTools } from '@/lib/insights/document-index-tools'
import { createHealthRecordTools } from '@/lib/insights/health-record-tools'
import { createProfileTools } from '@/lib/insights/profile-tools'
import { createOtherTestTools } from '@/lib/insights/other-test-tools'
import { createDocumentReadTools } from '@/lib/insights/document-read-tools'
import { sanitizeUiMessages } from '@/lib/insights/sanitize-ui-messages'
import { shouldContinueTurn } from '@/lib/insights/turn-continuation'
import { beginRun, endRun } from '@/lib/insights/run-registry'
import { buildClassifierGuidance } from '@/lib/health-documents/registry'
import { gramsToKg } from '@/lib/body/metrics'
import type {
  DutchContext,
  MicrobiomeTestContext,
  OtherTestContext,
  DexaContext,
  RmrContext,
} from '@/lib/insights/insights-chat-prompt'
import type {
  MarkerHistoryEntry,
  ProfileContext,
  SupplementContext,
} from '@/lib/interpretation/types'
import type { SnpVariant } from '@/lib/database.types'
import { REASONING_MODEL } from '@/lib/ai/models'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'
import { readJsonBody } from '@/lib/http/read-json'

const LAB_TEST_TOOLS_GUIDANCE = `

# Building lab test lists
You can help the user decide which tests to order and from which labs, then give them a downloadable list per lab.
- For a broad or comprehensive request (e.g. "a general health check", "everything relevant at Bodimed and Lina"), call \`list_lab_tests\` ONCE per lab to load that lab's ENTIRE catalogue, then pick from what it returns. Do NOT make many narrow \`lab_test_finder\` calls per biomarker or area — that is slow and misses tests; load the whole catalogue once and reason over it.
- Use \`lab_test_finder\` only for a targeted lookup (e.g. "which of these labs offers HbA1c?"), filtering by a name query and/or specific catalogue biomarker names.
- ALWAYS pick test names from what \`list_lab_tests\`/\`lab_test_finder\` actually returned — never claim a lab offers a test you haven't seen in a tool result.
- Each test row may include a \`provider\` field — the analyzing reference lab when the listing lab outsources it (e.g. Genomic Center Bulgaria routes its specialty catalogue to "Biovis Diagnostik MVZ GmbH"). Use your own knowledge of those reference labs to weight the test's value: a commodity test (e.g. 25-OH-Vitamin D) routed through a reference lab has no extra value over a cheaper in-house equivalent elsewhere. When the analysing lab matters for a specialty test, briefly say so in the reason.
- If the request is ambiguous (which focus areas, how many tests, budget, detail level), call \`ask_user\` with 2–6 concise options and wait for the answer instead of guessing.
- When the lists are final, call \`build_lab_test_lists\` with one entry per lab and the chosen tests, using the EXACT test names returned by the lookup tools. Add a short \`reason\` grounded in the user's own data when useful. The user then gets a downloadable PDF/TXT per lab.
- If the user specifies how the PDF/list should look — only certain columns (e.g. just name + cost), a sort order (by name or cost), or hiding tests the lab doesn't offer — set the \`format\` option on \`build_lab_test_lists\` (\`columns\`, \`sort\`, \`hideUnavailable\`). They can also fine-tune this on the download card afterwards.
- Put ONLY the plain test name in \`testName\` — never append notes, arrows ("→"), or "NOT AVAILABLE"/availability text to it. Tests the lab does not offer are tracked separately on each entry's \`found\` flag (the user can choose to hide them via the \`hideUnavailable\` format option). If a requested test isn't offered by a lab, mention that in your chat reply.
Base recommendations on the user's marker history and goals already in your context; only include tests that actually exist at the named labs.`

const MAX_WEB_SEARCH_USES = 5

const WEB_SEARCH_GUIDANCE = `

# Web search
You have a \`web_search\` tool. Use it when you need information that:
- is newer than your training cutoff,
- requires a specific study, guideline, or supplement-evidence lookup,
- or is otherwise outside the user's own marker history / supplements / lab catalogue (those are already in your context — do NOT search for them).
Cite every claim you draw from a search result; only cite URLs the search actually returned. Prefer reputable medical sources (PubMed, NIH, peer-reviewed journals, established medical organisations) when relevant, but no hard restriction. Never fabricate citations.`

const NEXT_TO_TEST_GUIDANCE = `

# Next-to-test list
The user has personal "next to test" lists for tests they want to remember to order. Tools: \`list_next_to_test_lists\` (read the lists themselves), \`list_next_to_test\` (read entries), \`add_to_next_to_test\` (single write), \`add_many_to_next_to_test\` (batch write), \`remove_from_next_to_test\` (write), \`mark_next_to_test_done\` (write).

When to use each:
- Read with \`list_next_to_test\` when they ask "what was I going to test?", "what's on my list?", or before building a per-lab order list (you can fold saved items in).
- Add with \`add_to_next_to_test\` ONLY when the user explicitly says "remember this", "add X to my list", "log X as next to test", or similar. Never silently.
- **Choosing WHICH list — never silently create a new one.** BEFORE any add, call \`list_next_to_test_lists\` to see the user's existing lists. Then:
  - If the user named a list ("add to my SIBO list") → use that \`listName\`.
  - If the user did NOT name a list and one or more lists exist → \`ask_user\` which list to add to, offering each existing list name plus a final "Create a new list" option. Only after they choose do you add. If they pick "Create a new list", ask for its name, then pass it as \`listName\`.
  - If the user has NO lists yet → just add (a default list is fine); no need to ask.
  - If \`list_next_to_test_lists\` returns \`{ error }\`, do NOT treat it as "no lists" and do NOT create one — tell the user you couldn't read their lists and stop.
  Passing a \`listName\` that doesn't exist CREATES it — so do not invent a name; only use a name the user gave or chose.
- **For more than 2 items, ALWAYS use \`add_many_to_next_to_test\`** with the full items array in ONE call — not a loop of single \`add_to_next_to_test\` calls. The batch tool returns per-item \`status\` ('added' | 'duplicate' | 'ambiguous' | 'error') plus a \`summary\` (where \`added\` includes \`added_custom\`, the subset saved as free-text custom entries because they weren't in the catalogue). After it returns, briefly report the counts to the user (e.g. "Added 18 (3 saved as custom), 2 already on the list, 1 needs you to pick the exact match") and ask once how they'd like to handle any ambiguous items — do NOT loop with single-adds to retry yourself.
- When adding: DEFAULT to the biomarker form (just biomarkerName). Save the test lab-agnostically so the user can choose a lab when they actually order it. Only pin to a specific lab (labName + testName) when the user EXPLICITLY named the lab in their message. If you're unsure — for instance the user said "log PTH" with no lab — call \`ask_user\` to choose between "Save lab-agnostically (decide later)" and one option per lab that offers the test. Never pick a lab on the user's behalf.
- **Pass \`sampleType\`** when the catalogue has variants by sample. Default to \`'blood'\` for routine markers (cortisol, DHEA-S, glucose, lipids, vitamins, hormones), \`'urine'\`/\`'stool'\`/\`'saliva'\`/\`'hair'\` when the user implies so or it's a method-specific marker (DUTCH cortisol = saliva, GI-MAP = stool, HTMA = hair, etc.). Without sampleType, "Cortisol" and "DHEA-S" routinely hit ambiguous because the catalogue holds blood + saliva + urine variants — adding \`sampleType: 'blood'\` resolves it cleanly.
- Mark done with \`mark_next_to_test_done\` ONLY when the user explicitly confirms they have tested it.
- Remove or swap with \`remove_from_next_to_test\`. If the user says "I'd prefer Lina, not BODIMED" about a saved entry, REMOVE the old entry (by its id from \`list_next_to_test\`) then add the new one. Do NOT reach for \`build_lab_test_lists\` for list management — that tool is only for finalising a downloadable per-lab order document.

- **Uncatalogued / specialty tests are still savable.** Tests not in our catalogue (e.g. SIBO breath test, Cyrex Array, EMA IgA, Anti-tTG IgA) are saved automatically as free-text custom entries — \`add_to_next_to_test\` returns \`{ added, entry: { kind: 'custom' } }\`. NEVER tell the user a test "can't be added because it's not in the catalogue" or that "there's no free-text option" — there is, and it's automatic. Just confirm you saved it (and that it's a custom entry).

**Handling errors — do not narrate frustration**: If \`add_to_next_to_test\` returns \`{ error: 'ambiguous', candidates }\`, surface those candidates to the user with \`ask_user\` ONCE so they can pick the exact one — then STOP. Do not retry the same item with a different wording, do not say things like "the system is fighting me" or "let me try a different approach", and do not apologise for catalogue ambiguity. The user just needs to know what to pick.`

const HEALTH_RECORDS_GUIDANCE = `

# Managing health records (tests, nutrition, weight)
You can read AND edit the user's stored records: blood tests (incl. individual marker results), DEXA scans, microbiome tests, DUTCH tests, RMR tests, food logs, nutrition targets, and the weight/body log.

Blood tests:
- Read freely with \`list_blood_tests\` / \`get_blood_test\`; always get the test id from \`list_blood_tests\` first.
- "I have the remaining results from <date>" / "X was actually 5.2" → find the existing test for that date and call \`add_blood_results\`: markers already on the test get their value REPLACED, new markers are added, duplicates are impossible. This is the default path for completing or correcting a test.
- Only \`create_blood_test\` when NO test exists for that date (it refuses same-date duplicates unless the user explicitly wants a separate test — then pass \`allowDuplicateDate: true\`).
- Markers are passed by NAME; matching is automatic — a marker is matched to the catalog, or (if not in it) resolved to its LOINC code and auto-added, so specialty markers are captured rather than skipped. Only names that can't be matched OR confidently resolved to a LOINC code come back in \`unmatched\` — tell the user about those and ask how to proceed; never silently drop them.
- Values can come from the user's message OR from an attached report: you can read attachments directly, so for adding results to an EXISTING test, read the file and call \`add_blood_results\`. Use the \`extract_health_document\` → confirm-card flow only for logging a NEW report wholesale.
- \`update_blood_test\` fixes metadata (name/date/sample type/notes) without touching results; \`remove_blood_results\` deletes specific markers from a test; \`delete_blood_test\` removes the whole test.
- **Fuller/corrected version of an already-logged report uploaded**: do NOT create a new test. Ask the user (via \`ask_user\`) whether to (a) add the missing results to the existing test, (b) replace the linked source document, or (c) both — "both" is the usual answer. Then use \`add_blood_results\` for the results and \`attach_document_to_record\` to swap the stored file. \`attach_document_to_record\` works for every record type (blood/dexa/microbiome/dutch/rmr), replaces any previously linked file, and never changes results. If a record already has a linked document, confirm before replacing it.

DEXA / microbiome / DUTCH / RMR:
- Read with \`list_health_tests\` / \`get_health_test\` (freely callable).
- \`update_health_test\` fixes metadata (name, date, notes, provider/lab) and numeric values (DEXA body comp fields, RMR kcal/RER, DUTCH cycle day/phase).
- NEW tests of these types are logged via the upload flow (\`extract_health_document\` → confirm card) — there is no manual create; if the user wants to log one without a file, ask them to upload the report.
- \`delete_health_test\` removes a test with all its results/regions.

Nutrition: \`list_food_logs\` (read, get ids), \`log_food_entry\` (manual entry with explicit macros), \`update_food_log\` (rename / fix macros / change meal or date), \`delete_food_log\`. Daily targets: \`get_nutrition_targets\` / \`set_nutrition_targets\`.

Weight & body: \`list_body_log\`, \`log_body_entry\` (weight / body-fat % / waist for a date; logging the same date again updates that day's entry instead of duplicating), \`delete_body_log_entry\`.

Safety rules for ALL record writes:
- WRITE only on explicit user intent; never silently.
- DELETE is irreversible (except food logs). Before \`delete_blood_test\` / \`delete_health_test\`, restate exactly what will be deleted (type, name, date) and get a clear confirmation in this conversation — use \`ask_user\` if there is any ambiguity about which record is meant.
- Prefer correcting over delete-and-recreate: \`add_blood_results\` replaces wrong values; \`update_*\` fixes metadata.
- After any write, briefly confirm what changed (markers added/replaced, counts, dates).`

const STACK_GUIDANCE = `

# Stack & wishlist
The user has an ACTIVE stack (supplements/meds they take) and a WISHLIST (things to buy or try, each with buy-sources). Tools: \`list_stack\`/\`add_supplement\`/\`update_supplement\`/\`remove_supplement\`; \`list_wishlist\`/\`add_to_wishlist\`/\`update_wishlist_item\`/\`remove_from_wishlist\`/\`add_wishlist_source\`/\`move_wishlist_to_stack\`.
- Read freely with \`list_stack\`/\`list_wishlist\`. Get ids from those before any update/remove/move.
- WRITE only on explicit intent: "add X to my stack/wishlist", "I started taking Y" (→ add_supplement or move_wishlist_to_stack), "remove Z". Never add or delete silently.
- SCHEDULE with dates instead of deleting: pass a future start_date (YYYY-MM-DD) to add_supplement/move_wishlist_to_stack to plan a start ahead of time; set end_date via update_supplement to stop/pause a supplement on a date (a future end_date schedules a pause), and end_date: null to reactivate. To pause until a date, set end_date — do NOT delete-and-re-add.
- If a name matches more than one item, call \`ask_user\` to pick the exact one instead of guessing.`

const PROFILE_GUIDANCE = `

# Health profile & medical history
The user's profile holds personal info (name, date of birth, sex, height, weight, activity level) and health context (smoking, alcohol/week, diet pattern, pregnancy status, born-via-c-section, breastfed, known allergies, family history, extra notes), plus a medical-conditions list. Tools: \`get_profile\`; \`update_profile\`; \`add_medical_condition\`/\`update_medical_condition\`/\`remove_medical_condition\`.
- Read with \`get_profile\` before editing so you patch only the intended fields (update_profile leaves unpassed fields untouched).
- WRITE only on explicit intent ("I'm 82 kg now", "add sleep apnea to my history", "I stopped smoking"). Never edit silently.
- For born_via_csection / breastfed_as_infant, null means "unknown". Clear a free-text field by passing an empty string.
- \`remove_medical_condition\` is irreversible — restate the condition name and confirm first.

# Other tests
"Other tests" are miscellaneous results that aren't blood/DEXA/microbiome/DUTCH/RMR — SIBO breath tests, STI/infection screens, sleep studies, intolerance panels. Tools: \`list_other_tests\`/\`get_other_test\`/\`create_other_test\`/\`update_other_test\`/\`delete_other_test\`.
- Read freely; get ids from \`list_other_tests\` before update/delete.
- \`create_other_test\` is for dictated results; if the user has a document, prefer uploading it (the indexer extracts readings automatically).
- \`update_other_test\` with \`readings\` REPLACES all readings — omit \`readings\` to change only metadata.
- \`delete_other_test\` is irreversible — restate name + date and confirm first.

# Reading a test's original document
Many tests keep the original uploaded report (PDF or image). \`read_test_document(type, id)\` returns that document so you can look at it directly — use it to catch nuances the structured readings miss: handwritten notes, free-text sections, charts/diagrams (e.g. a dental chart), footnotes, reference-range fine print, or to double-check a value. Works for every type: blood, dexa, microbiome, dutch, rmr, other. Get the id from the matching list tool first. It returns a friendly error when a test has no stored document (many manually-typed entries don't) — don't retry, just tell the user there's no scan to read.`

/** Load the user's latest DEXA scans + goals for the chat context (RLS-scoped). */
async function loadDexaContext(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DexaContext | undefined> {
  const { data: scans } = await supabase
    .from('dexa_scans')
    .select(
      'scan_date, body_fat_pct, lean_mass_g, total_mass_kg, visceral_fat_g, ffmi, almi, bone_t_score, android_gynoid_ratio'
    )
    .order('scan_date', { ascending: false })
    .limit(4)

  const { data: log } = await supabase
    .from('body_log_entries')
    .select('logged_on, weight_kg, body_fat_pct, waist_cm')
    .order('logged_on', { ascending: false })
    .limit(1)
  const latestLog = (log?.[0] as DexaContext['latestLog']) ?? null

  // Nothing to add to the chat if there's neither a scan nor a logged measurement.
  if ((!scans || scans.length === 0) && !latestLog) return undefined

  const { data: goals } = await supabase
    .from('body_goals')
    .select('metric, target_value')

  type Row = Record<string, number | string | null>
  return {
    latestLog,
    scans: ((scans ?? []) as Row[]).map((s) => ({
      scan_date: String(s.scan_date),
      body_fat_pct: s.body_fat_pct as number | null,
      lean_mass_kg:
        s.lean_mass_g == null ? null : Number(gramsToKg(s.lean_mass_g as number).toFixed(1)),
      total_mass_kg: s.total_mass_kg as number | null,
      visceral_fat_g: s.visceral_fat_g as number | null,
      ffmi: s.ffmi as number | null,
      almi: s.almi as number | null,
      bone_t_score: s.bone_t_score as number | null,
      android_gynoid_ratio: s.android_gynoid_ratio as number | null,
    })),
    goals: ((goals ?? []) as { metric: string; target_value: number }[]).map((g) => ({
      metric: g.metric,
      target: g.target_value,
    })),
  }
}

/** Prompt-cache token counts for one turn, for the turn-end log. */
async function cacheUsage(result: { totalUsage?: PromiseLike<{ inputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number } }> }) {
  const total = await result.totalUsage
  return {
    inputTokens: total?.inputTokens,
    cacheReadTokens: total?.inputTokenDetails?.cacheReadTokens,
    cacheWriteTokens: total?.inputTokenDetails?.cacheWriteTokens,
  }
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const read = await readJsonBody<Record<string, unknown>>(request, 4_000_000)
  if (!read.ok) return read.response
  const body = read.value

  const {
    threadId,
    messages: uiMessages,
    markerHistory,
    profile,
    supplements,
    geneticSnps,
    dutchContext,
    microbiomeTests,
    otherTests,
    rmrContext,
  } = body as {
    threadId: string
    messages: UIMessage[]
    markerHistory: MarkerHistoryEntry[]
    profile: ProfileContext
    supplements: SupplementContext[]
    geneticSnps?: SnpVariant[]
    dutchContext?: DutchContext
    microbiomeTests?: MicrobiomeTestContext[]
    otherTests?: OtherTestContext[]
    rmrContext?: RmrContext | null
  }

  if (!uiMessages || uiMessages.length === 0) {
    return new Response('Messages required', { status: 400 })
  }

  // Convert UIMessage[] to ModelMessage[] for streamText. Sanitize first to
  // drop any unfinished tool parts the client may have retained from an
  // interrupted prior stream — without this, replaying them surfaces as
  // "messages.N: `tool_use` ids were found without `tool_result` blocks"
  // from Anthropic and locks the whole thread on the next submit.
  const messages = await convertToModelMessages(sanitizeUiMessages(uiMessages))

  // Verify thread belongs to user
  const { data: thread } = await supabaseAdmin
    .from('chat_threads')
    .select('id, user_id')
    .eq('id', threadId)
    .single()

  if (!thread || thread.user_id !== user.id) {
    return new Response('Thread not found', { status: 404 })
  }

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  // Extract text from last UI message for DB persistence
  const lastUiMessage = uiMessages[uiMessages.length - 1]
  const lastMessageText = lastUiMessage.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')

  type AttachmentRef = { storagePath: string; mediaType: string; filename: string; parts?: string[] }
  // Attachments travel on the request body (reliably forwarded by the transport's
  // prepareSendMessagesRequest); message.metadata is kept as a fallback.
  const attachments =
    (((body as { attachments?: AttachmentRef[] }).attachments as AttachmentRef[] | undefined) ??
      ((lastUiMessage as { metadata?: { attachments?: AttachmentRef[] } }).metadata
        ?.attachments as AttachmentRef[] | undefined)) ??
    []

  if (lastUiMessage.role === 'user') {
    const { error: userInsertError } = await supabaseAdmin.from('chat_messages').insert({
      thread_id: threadId,
      role: 'user',
      content: lastMessageText,
      attachments: attachments.length > 0 ? attachments : null,
    })
    // Stop before running the model: an answer to a question the thread does
    // not hold could not be recovered from the database (recoverThread).
    if (userInsertError) {
      console.error('[insights-chat] could not save the user message', {
        threadId,
        error: userInsertError.message,
      })
      return new Response('Could not save your message. Please try again.', { status: 500 })
    }
  }

  // Make the model SEE uploaded files — AND keep recent ones visible on later
  // turns so it can re-read them (e.g. reconcile a list against an uploaded
  // invoice). We can't rely on the client FileList → SDK file-parts path
  // surviving serialization, so we inject the bytes server-side from storage,
  // onto each user message that carried an attachment. Bounded to the most
  // recent N file blocks (recency-first) to cap tokens + stay under Anthropic's
  // per-request image cap; older uploads drop out of context.
  const MAX_ATTACHMENT_BLOCKS = 20

  // Attachments per user message, aligned by order. metadata.attachments is the
  // per-message record (kept across reloads); body.attachments is authoritative
  // for the current turn (the last user message).
  const userMsgAttachments: AttachmentRef[][] = uiMessages
    .filter((m) => m.role === 'user')
    .map(
      (m) =>
        ((m as { metadata?: { attachments?: AttachmentRef[] } }).metadata?.attachments ?? [])
    )
  if (attachments.length > 0 && userMsgAttachments.length > 0) {
    userMsgAttachments[userMsgAttachments.length - 1] = attachments
  }

  if (userMsgAttachments.some((a) => a.length > 0)) {
    // The k-th user MODEL message corresponds to the k-th user UI message
    // (convertToModelMessages keeps user messages 1:1 and in order).
    const userModelIdx = messages.flatMap((m, i) => (m.role === 'user' ? [i] : []))

    type Candidate = { modelIndex: number; path: string; mediaType: string; filename: string }
    const candidates: Candidate[] = []
    for (let k = 0; k < userMsgAttachments.length && k < userModelIdx.length; k++) {
      for (const att of userMsgAttachments[k]) {
        const paths = att.parts && att.parts.length > 0 ? att.parts : [att.storagePath]
        for (const path of paths) {
          candidates.push({ modelIndex: userModelIdx[k], path, mediaType: att.mediaType, filename: att.filename })
        }
      }
    }
    // Keep only the most recent N (recency-first).
    const kept = candidates.slice(-MAX_ATTACHMENT_BLOCKS)

    const blocksByIndex = new Map<number, Array<ImagePart | FilePart>>()
    for (const c of kept) {
      // Only the owner's own files — same guard the extract tool uses.
      if (!c.path?.startsWith(`${user.id}/`)) continue
      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('lab-pdfs').download(c.path)
      if (dlErr || !blob) continue
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const block: ImagePart | FilePart | null = c.mediaType?.startsWith('image/')
        ? { type: 'image', image: bytes, mediaType: c.mediaType }
        : c.mediaType === 'application/pdf'
          ? { type: 'file', data: bytes, mediaType: 'application/pdf', filename: c.filename }
          : null
      if (!block) continue
      const arr = blocksByIndex.get(c.modelIndex) ?? []
      arr.push(block)
      blocksByIndex.set(c.modelIndex, arr)
    }

    for (const [idx, blocks] of blocksByIndex) {
      const mm = messages[idx]
      if (!mm || mm.role !== 'user' || blocks.length === 0) continue
      const existing = mm.content
      const base: Exclude<UserContent, string> =
        typeof existing === 'string'
          ? [{ type: 'text', text: existing }]
          : Array.isArray(existing)
            ? existing
            : []
      mm.content = [...base, ...blocks]
    }
  }

  // DEXA body-composition context — loaded server-side (RLS scopes to the user)
  // rather than sent from the client, so the chat sees the latest scans + goals.
  const dexaContext = await loadDexaContext(supabase)

  // Build full-context system prompt
  let systemPrompt = buildInsightsChatSystemPrompt({
    markerHistory: markerHistory ?? [],
    profile: profile ?? {},
    supplements: supplements ?? [],
    geneticSnps: geneticSnps ?? [],
    dutchContext: dutchContext ?? undefined,
    microbiomeTests: microbiomeTests ?? [],
    otherTests: otherTests ?? [],
    dexaContext,
    rmr: rmrContext ?? null,
  })

  // Count existing messages to detect first exchange for auto-titling
  const { count: messageCount } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)

  const isFirstExchange = (messageCount ?? 0) <= 1

  // Cross-conversation memory via Claude's memory tool (beta). Off unless
  // INSIGHTS_MEMORY_ENABLED is set, so it can be rolled out gradually.
  const memoryEnabled = process.env.INSIGHTS_MEMORY_ENABLED === 'true'

  if (memoryEnabled) {
    // Preload memory into the prompt so the answer streams immediately; the
    // tool is then only needed when Claude wants to save something new.
    systemPrompt += '\n\n' + (await loadMemoryForPrompt(user.id))
  }

  systemPrompt += LAB_TEST_TOOLS_GUIDANCE
  systemPrompt += '\n\n' + buildClassifierGuidance()
  systemPrompt += WEB_SEARCH_GUIDANCE
  systemPrompt += NEXT_TO_TEST_GUIDANCE
  systemPrompt += STACK_GUIDANCE
  systemPrompt += HEALTH_RECORDS_GUIDANCE
  systemPrompt += PROFILE_GUIDANCE

  // Lab-test + next-to-test tools (createLabTestTools), in-chat document indexing
  // (docTools), and Anthropic's provider-defined web_search; the memory tool is
  // layered on when enabled. web_search runs server-side and streams citation
  // `source-url` parts (persisted in onEnd below).
  const docTools = createDocumentIndexTools(supabaseAdmin, user.id, attachments, threadId)
  const stackTools = createStackTools(supabaseAdmin, user.id)
  const recordTools = createHealthRecordTools(supabaseAdmin, user.id, attachments)
  const profileTools = createProfileTools(supabaseAdmin, user.id)
  const otherTestTools = createOtherTestTools(supabaseAdmin, user.id)
  const documentReadTools = createDocumentReadTools(supabaseAdmin, user.id)
  const baseTools = memoryEnabled
    ? { ...createLabTestTools(supabaseAdmin, user.id), ...docTools, ...stackTools, ...recordTools, ...profileTools, ...otherTestTools, ...documentReadTools, memory: createMemoryTool(user.id) }
    : { ...createLabTestTools(supabaseAdmin, user.id), ...docTools, ...stackTools, ...recordTools, ...profileTools, ...otherTestTools, ...documentReadTools }
  const tools = {
    ...baseTools,
    web_search: anthropic.tools.webSearch_20250305({ maxUses: MAX_WEB_SEARCH_USES }),
  }

  // Adaptive thinking is back on (OTH-18). The OTH-17 duplication was NOT the
  // model or this loop: turns that ended right after a completed server tool
  // step (step cap / abort) matched the client's stock sendAutomaticallyWhen
  // predicate, which re-posted the conversation; a thinking continuation then
  // REGENERATED the reply instead of resuming — duplicate bubbles. Fixed at the
  // root in `lastAssistantMessageAwaitsInteractiveTool` (chat-continuation.ts):
  // only client-answered interactive tools resume a run now. Verified against
  // the live API: multi-step server-tool turns with thinking (+ web_search)
  // stream each step exactly once.

  // The turn's stop switch (OTH-41). The composer's Stop posts to
  // /api/insights-chat/stop, which aborts this — the ONLY thing that ends a
  // run early. A dropped connection deliberately does not: the response is
  // tee'd (see the end of this file) precisely so a phone losing signal keeps
  // its answer, and the two are indistinguishable from here without this.
  const runControl = beginRun(threadId)

  // One `streamText` run = one attempt at the turn. A run can end cut short —
  // see turn-continuation.ts — in which case we resume it into the SAME UI
  // message rather than leaving the user with tool chips and no answer.
  const runTurn = (turnMessages: typeof messages) =>
    streamText({
      model: anthropic(REASONING_MODEL),
      // An explicit breakpoint on the system prompt, next to the automatic
      // one below. Anthropic looks back only ~20 blocks from a breakpoint for
      // an earlier cache entry, so a step that adds many blocks (parallel tool
      // calls, a cited web_search reply) would otherwise miss and re-write the
      // whole prefix at cache-write price. This one keeps tools + system
      // prompt cached however much history a step adds (OTH-60).
      instructions: {
        role: 'system',
        content: systemPrompt,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: turnMessages,
      tools,
      abortSignal: runControl.signal,
      // Set explicitly, never left to the provider's per-model default.
      // Thinking shares this budget and is spent first: too small a cap lets
      // a step burn it all on reasoning plus one tool call and end with no
      // room left for the reply — a turn that stops dead after "Tool
      // activity" with no error, because nothing actually failed (OTH-36).
      // Anthropic's starting point for effort `high` and above is 64k.
      maxOutputTokens: 64000,
      // One step can hold several parallel tool calls, so a turn that logs a
      // handful of records plus a profile update easily needs 10+ steps. At 8
      // the turn ended mid-work with no answer (OTH-43); a turn that does hit
      // this cap is resumed by shouldContinueTurn.
      stopWhen: isStepCount(25),
      // Opus 5.5: adaptive thinking is always on (and can't be disabled);
      // effort is the only control. `high` rather than `xhigh` — Anthropic
      // reserves xhigh for 30+ minute agentic runs (OTH-43).
      //
      // cacheControl = Anthropic's automatic prompt caching (top-level
      // cache_control): the breakpoint follows the end of the conversation, so
      // the next step of a turn — and the next turn within 5 minutes — reads
      // the history it has seen before from cache ($0.20 instead of $4 per
      // MTok on Opus 5.5) instead of paying full input price again. The
      // system-prompt breakpoint above covers tools + system prompt when a
      // step adds too many blocks for this one to find its earlier entry.
      // Output is unchanged; anything that edits earlier history or the
      // system prompt just misses the cache (OTH-60).
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive' },
          effort: 'high',
          cacheControl: { type: 'ephemeral' },
        },
      },
      // Surface provider/API failures in server logs — a mid-loop error
      // otherwise just ends the stream and looks like a truncated reply.
      onError: ({ error }) => {
        console.error('[insights-chat] streamText error:', error)
      },
    })

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let turnMessages = messages
      let continuations = 0

      for (;;) {
        const result = runTurn(turnMessages)

        // `sendStart`/`sendFinish` are suppressed so every attempt appends to
        // one assistant message instead of opening a new bubble; the single
        // `finish` chunk is written once the loop is done.
        const reader = toUIMessageStream({
          stream: result.stream,
          // The AI SDK defaults sendSources to false, which silently drops
          // the Anthropic provider's `source` parts — web_search citations
          // would never reach the client (empty Sources footer) or onEnd.
          sendSources: true,
          // Reasoning parts must reach the client WITH their provider
          // signatures: when an interactive tool (ask_user) resumes the run,
          // the client re-posts the trailing assistant turn, and Anthropic
          // only accepts its thinking blocks back if the signature
          // round-tripped. This is the SDK default — pinned explicitly
          // because thinking replay depends on it (OTH-18).
          sendReasoning: true,
          sendStart: continuations === 0,
          sendFinish: false,
        }).getReader()

        // Drained by hand rather than through `writer.merge`, which only
        // SCHEDULES the copy: the run's own promises can settle while chunks
        // are still in flight, so a merged attempt could have its last words
        // overtaken by the trailing `finish`. Reading here keeps the order
        // exact and still forwards each chunk the moment it arrives.
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          writer.write(value)
        }

        const steps = await result.steps
        // Is the run parked waiting for the CLIENT to answer a tool call?
        //
        // This mirrors the SDK's own definition of that state, and both halves
        // matter. A tool call counts as ANSWERED when the step produced either
        // a result or an error for it — a server tool whose `execute` threw is
        // reported as a `tool-error` part, and it does come back to Anthropic
        // as a tool_result. And only CLIENT tool calls can park a run:
        // provider-executed ones (`web_search`) are declared with
        // `supportsDeferredResults`, so their result legitimately arrives in a
        // LATER step — which is exactly what `pause_turn` is. Counting either
        // of those as "waiting for the user" would switch off the OTH-38
        // resume for the very turns it was written for.
        const lastStep = steps[steps.length - 1]
        const answeredToolCallIds = new Set(
          (lastStep?.content ?? [])
            .filter((part) => part.type === 'tool-result' || part.type === 'tool-error')
            .map((part) => part.toolCallId)
        )
        const end = {
          finishReason: await result.finishReason,
          rawFinishReason: await result.rawFinishReason,
          hasText: steps.some((step) => (step.text ?? '').trim().length > 0),
          hasToolCalls: steps.some((step) => step.toolCalls.length > 0),
          // The user pressed Stop. Nothing to resume, and nothing to add.
          isAborted: runControl.signal.aborted,
          awaitsToolResults: (lastStep?.toolCalls ?? []).some(
            (toolCall) =>
              toolCall.providerExecuted !== true &&
              !answeredToolCallIds.has(toolCall.toolCallId)
          ),
        }

        // A turn that ends without an answer used to leave NOTHING in the
        // server log, because nothing threw. Record how every turn ended.
        console.log('[insights-chat] turn end', {
          threadId,
          attempt: continuations,
          steps: steps.length,
          ...end,
          outputTokens: (await result.usage).outputTokens,
          // Summed over the turn's steps; a healthy turn reads most of its
          // input from cache after the first step (OTH-60).
          ...(await cacheUsage(result)),
        })

        if (!shouldContinueTurn(end, continuations)) break

        continuations += 1
        console.warn('[insights-chat] turn was cut short — resuming', {
          threadId,
          attempt: continuations,
          rawFinishReason: end.rawFinishReason,
        })
        // Anthropic's documented way to continue a paused turn: hand the
        // response back unchanged and let the model carry on.
        turnMessages = [...turnMessages, ...(await result.responseMessages)]
      }

      writer.write({ type: 'finish' })
      endRun(threadId, runControl)
    },
    // Persist the assistant message's PARTS (not just text): completed tool
    // parts — e.g. the build_lab_test_lists download cards — are saved so they
    // survive a reload. Pending/interactive parts (state !== 'output-available')
    // are skipped so a resolved question doesn't re-render as unanswered.
    onEnd: async ({ responseMessage, isAborted }) => {
      const parts = (responseMessage.parts ?? []) as Array<{
        type: string
        text?: string
        state?: string
      }>
      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('')
      // Tool parts AND source-url parts (Anthropic web_search citations) both
      // ride the existing tool_invocations jsonb column for now. The client
      // dispatches on `part.type`, so a structured `sources` column is an easy
      // follow-up if we ever need to query citations directly.
      const persistedParts = parts.filter(
        (p) =>
          ((p.type === 'dynamic-tool' || p.type.startsWith('tool-')) &&
            p.state === 'output-available') ||
          p.type === 'source-url'
      )

      // An empty reply reaching this point is worth a log line of its own: the
      // continuation above is meant to prevent it, so seeing one means either
      // the budget ran out or the stream was cut at the client.
      if (text.trim().length === 0) {
        console.warn('[insights-chat] persisting a reply with no text', {
          threadId,
          isAborted,
          parts: persistedParts.length,
        })
      }

      if (text.trim().length > 0 || persistedParts.length > 0) {
        const row = {
          // Fixed id so the retry below cannot store the reply twice when the
          // first insert committed but its response was lost.
          id: crypto.randomUUID(),
          thread_id: threadId,
          role: 'assistant',
          content: text,
          tool_invocations: persistedParts.length > 0 ? persistedParts : null,
        }
        // The stream has ended, so the client cannot be told any more. The
        // database copy is what recoverThread reads after a dropped
        // connection, so retry once and log loudly if the reply is lost.
        let { error: replyError } = await supabaseAdmin.from('chat_messages').insert(row)
        if (replyError) {
          ;({ error: replyError } = await supabaseAdmin
            .from('chat_messages')
            .upsert(row, { onConflict: 'id', ignoreDuplicates: true }))
        }
        if (replyError) {
          console.error('[insights-chat] could not save the assistant reply', {
            threadId,
            error: replyError.message,
          })
        }
      }

      const { error: touchError } = await supabaseAdmin
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
      if (touchError) {
        console.error('[insights-chat] could not update the thread timestamp', {
          threadId,
          error: touchError.message,
        })
      }

      if (isFirstExchange && lastUiMessage.role === 'user' && lastMessageText) {
        const title =
          lastMessageText.length > 60
            ? lastMessageText.slice(0, 57) + '...'
            : lastMessageText
        const { error: titleError } = await supabaseAdmin
          .from('chat_threads')
          .update({ title })
          .eq('id', threadId)
        if (titleError) {
          console.error('[insights-chat] could not set the thread title', {
            threadId,
            error: titleError.message,
          })
        }
      }
    },
  })

  // `consumeSseStream` tees the response and drains the copy here on the server
  // itself (OTH-40). Without it, a client that goes away mid-answer — a phone
  // locking, the app going to the background, any dropped connection — cancels
  // the response body, which cascades back and fires the stream's `onEnd`
  // early. The half-written answer is what gets saved, and the rest is thrown
  // away even though the model is still writing it. With the tee the run
  // always finishes and `onEnd` persists the COMPLETE reply, so the client
  // can pick it up from the database (see recoverThread in insights-client).
  return createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream })
}

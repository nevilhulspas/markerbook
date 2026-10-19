import type { HealthDocumentType } from './types'
import { bloodDocumentType } from './entries/blood'
import { dutchDocumentType } from './entries/dutch'
import { microbiomeDocumentType } from './entries/microbiome'
import { dexaDocumentType } from './entries/dexa'
import { rmrDocumentType } from './entries/rmr'
import { otherDocumentType } from './entries/other'

export const HEALTH_DOCUMENT_TYPES: HealthDocumentType[] = [
  bloodDocumentType,
  dutchDocumentType,
  microbiomeDocumentType,
  dexaDocumentType,
  rmrDocumentType,
  // Keep `other` LAST — it's the catch-all fallback for tests that don't fit a
  // specific type above, so the classifier should prefer the specific ones.
  otherDocumentType,
]

export function getHealthDocumentType(id: string): HealthDocumentType | undefined {
  return HEALTH_DOCUMENT_TYPES.find((t) => t.id === id)
}

/** Lines injected into the chat system prompt so the model knows what's indexable. */
export function buildClassifierGuidance(): string {
  const lines = HEALTH_DOCUMENT_TYPES.map(
    (t) => `- \`${t.id}\` (${t.label}): ${t.classifierHint}`
  ).join('\n')
  return `# Uploaded health documents
The user can attach files to a message. When an attachment is one of the health
documents below, call \`extract_health_document\` with the matching \`documentType\`,
then call \`confirm_health_document_index\` so the user can choose to log it to their
record or keep it for this chat only. If the file is NOT one of these (a meal photo,
a random document), do not call those tools — just discuss it.
${lines}`
}

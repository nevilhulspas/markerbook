import type Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'

import { getAnthropic } from './client'
import { extractJsonObject } from './json'
import { EXTRACTION_MODEL } from './models'

/** User-facing error messages; each parser keeps the wording it always had. */
export interface ExtractionErrors {
  noText: string
  noJson: string
  invalid: string
}

const DEFAULT_ERRORS: ExtractionErrors = {
  noText: 'No extraction result returned',
  noJson: 'No JSON object found in extraction result',
  invalid: 'Extraction did not match the expected format',
}

export interface ExtractDocumentJsonOptions<T> {
  /** The user message: file blocks followed by the extraction prompt. */
  content: Anthropic.Messages.ContentBlockParam[]
  maxTokens: number
  /** Validates (and may transform) the parsed JSON. */
  schema: z.ZodType<T>
  /**
   * Structured output. With a schema the reply is parsed as-is; without one
   * the first `{...}` is salvaged from the text.
   */
  jsonSchema?: Record<string, unknown>
  /** Stream to the final message (needed for very large max_tokens). */
  stream?: boolean
  /** When set, a reply cut off at max_tokens throws this message. */
  truncatedMessage?: string
  errors?: Partial<ExtractionErrors>
}

/**
 * One document-extraction call: Sonnet with no up-front thinking
 * (`between_tools`, the lowest setting on the 5.5 models — extraction is
 * transcription, and thinking would eat the max_tokens budget) at medium
 * effort, then JSON parse and schema validation.
 */
export async function extractDocumentJson<T>(options: ExtractDocumentJsonOptions<T>): Promise<T> {
  const errors = { ...DEFAULT_ERRORS, ...options.errors }
  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: EXTRACTION_MODEL,
    max_tokens: options.maxTokens,
    thinking: { type: 'between_tools' },
    messages: [{ role: 'user', content: options.content }],
    output_config: options.jsonSchema
      ? { effort: 'medium', format: { type: 'json_schema', schema: options.jsonSchema } }
      : { effort: 'medium' },
  }

  const anthropic = getAnthropic()
  const response = options.stream
    ? await anthropic.messages.stream(params).finalMessage()
    : await anthropic.messages.create(params)

  if (options.truncatedMessage && response.stop_reason === 'max_tokens') {
    throw new Error(options.truncatedMessage)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error(errors.noText)

  let jsonText: string
  if (options.jsonSchema) {
    jsonText = textBlock.text
  } else {
    const salvaged = extractJsonObject(textBlock.text)
    if (!salvaged) throw new Error(errors.noJson)
    jsonText = salvaged
  }

  const parsed = options.schema.safeParse(JSON.parse(jsonText))
  if (!parsed.success) throw new Error(errors.invalid)
  return parsed.data
}

import { tool } from 'ai'
import { z } from 'zod'

/** Client-resolved multiple-choice question (no execute). */
export function createAskUserTool() {
  return tool({
    description:
      'Ask the user a single multiple-choice question and wait for their answer before continuing. Use this to clarify scope or preferences (e.g. which focus areas to include, how detailed the list should be) instead of guessing. Provide 2–6 concise options.',
    inputSchema: z.object({
      question: z.string().describe('The question to show the user.'),
      options: z
        .array(z.string())
        .min(2)
        .max(6)
        .describe('The answer choices.'),
      multiple: z
        .boolean()
        .optional()
        .describe('If true, the user may select several options.'),
    }),
    // No execute: this is resolved on the client (QuestionPrompt → addToolOutput).
  })
}

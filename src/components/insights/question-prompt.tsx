'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export interface QuestionPromptProps {
  /** The question text to display. */
  question: string
  /** The answer choices. */
  options: string[]
  /** Called with the selected answer (string) or answers (string[] when multiple). */
  onAnswer: (answer: string | string[]) => void
  /** If true, allow multiple selections (checkboxes + submit); otherwise single (radio). */
  multiple?: boolean
}

/**
 * A reusable multiple-choice prompt for AI-Elements-style chats. Single-select
 * fires `onAnswer` immediately on click; multi-select collects choices and fires
 * on Submit. Once answered it locks so the callback can't fire twice.
 */
export function QuestionPrompt({
  question,
  options,
  onAnswer,
  multiple = false,
}: QuestionPromptProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)

  function chooseSingle(option: string) {
    if (answered) return
    setAnswered(true)
    onAnswer(option)
  }

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    )
  }

  function submitMultiple() {
    if (answered || selected.length === 0) return
    setAnswered(true)
    onAnswer(selected)
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">{question}</p>

      {multiple ? (
        <>
          <div className="space-y-1.5">
            {options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggle(option)}
                  disabled={answered}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <Button
            size="sm"
            onClick={submitMultiple}
            disabled={answered || selected.length === 0}
          >
            Submit
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant="outline"
              onClick={() => chooseSingle(option)}
              disabled={answered}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

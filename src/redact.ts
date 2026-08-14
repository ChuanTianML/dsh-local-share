/** Privacy-first, deterministic text redaction used before document rendering. */

/** Result of applying all DSH Share redaction rules to one string. */
export interface RedactionResult {
  /** Redacted text. */
  text: string
  /** Number of matched sensitive spans replaced. */
  count: number
}

type Replacement = string | ((...groups: string[]) => string)

/** Preserve an assigned value's quote style while replacing its contents. */
function redactAssignedValue(prefix: string, value: string): string {
  const quote = value.length >= 2 && (value[0] === '"' || value[0] === "'")
    ? value[0]
    : ''
  return `${prefix}${quote}[REDACTED_SECRET]${quote}`
}

/** Apply one global expression while counting replacements. */
function replaceCounted(input: RedactionResult, pattern: RegExp, replacement: Replacement): RedactionResult {
  let matches = 0
  const text = input.text.replace(pattern, (...args: unknown[]) => {
    matches += 1
    if (typeof replacement === 'string') return replacement
    const groups = args.slice(1, -2).map(value => String(value))
    return replacement(...groups)
  })
  return { text, count: input.count + matches }
}

/**
 * Remove common credentials, identity data, and absolute local paths.
 * @param text - untrusted Session text or tool arguments.
 * @returns redacted text and the number of replacements.
 */
export function redactText(text: string): RedactionResult {
  let result: RedactionResult = { text, count: 0 }

  result = replaceCounted(
    result,
    /((?:["']?\b(?:authorization|proxy-authorization)\b["']?)\s*[:=]\s*["']?(?:bearer|basic)\s+)[^\s,"';}.)]+/giu,
    prefix => `${prefix}[REDACTED_SECRET]`,
  )
  result = replaceCounted(
    result,
    /((?:["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|token|secret|password|passwd|credential)\b["']?)\s*[:=]\s*)("[^"\r\n]+"|'[^'\r\n]+'|[^\s,"';&}.)]+)/giu,
    redactAssignedValue,
  )
  result = replaceCounted(
    result,
    /(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*\s*=\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gu,
    prefix => `${prefix}[REDACTED_SECRET]`,
  )
  result = replaceCounted(
    result,
    /\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|AIza[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/gu,
    '[REDACTED_SECRET]',
  )
  result = replaceCounted(
    result,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
    '[REDACTED_SECRET]',
  )
  result = replaceCounted(
    result,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    '[REDACTED_EMAIL]',
  )
  result = replaceCounted(
    result,
    /\bfile:\/{2,3}(?:[^/\s<>"'`]+\/)+[^\s<>"'`),;]*/giu,
    '[REDACTED_PATH]',
  )
  result = replaceCounted(
    result,
    /\b[A-Z]:\\(?:[^\\\s<>"'`]+\\)+[^\\\s<>"'`),;]*/giu,
    '[REDACTED_PATH]',
  )
  result = replaceCounted(
    result,
    /(^|[\s("'=:[\x60])\/(?:[^/\s<>"'`]+\/)+[^/\s<>"'`),;]*/gmu,
    prefix => `${prefix}[REDACTED_PATH]`,
  )

  return result
}

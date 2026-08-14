import { describe, expect, it } from 'vitest'
import { redactText } from '../src/redact.ts'

describe('redactText', () => {
  it.each([
    ['provider key', 'sk-abcdefghijklmnop', '[REDACTED_SECRET]'],
    ['authorization', 'Authorization: Bearer very-private-value', 'Authorization: Bearer [REDACTED_SECRET]'],
    ['JSON authorization', '{"Authorization":"Bearer very-private-value"}', '{"Authorization":"Bearer [REDACTED_SECRET]"}'],
    ['secret assignment', 'DEEPSEEK_API_KEY="secret value"', 'DEEPSEEK_API_KEY=[REDACTED_SECRET]'],
    ['named secret', 'password: hunter2', 'password: [REDACTED_SECRET]'],
    ['quoted JSON secret', '{"apiKey":"secret value"}', '{"apiKey":"[REDACTED_SECRET]"}'],
    ['generic token field', "token='opaque value'", "token='[REDACTED_SECRET]'"],
    ['email', 'alice@example.com', '[REDACTED_EMAIL]'],
    ['POSIX path', '/Users/alice/project/file.ts', '[REDACTED_PATH]'],
    ['file URL', 'file:///Users/alice/project/file.ts', '[REDACTED_PATH]'],
    ['Windows path', 'C:\\Users\\Alice\\project\\file.ts', '[REDACTED_PATH]'],
    ['JWT', 'eyJabcdefghij.abcdefghij.abcdefghij', '[REDACTED_SECRET]'],
  ])('redacts %s', (_name, input, expected) => {
    const result = redactText(input)
    expect(result.text).toBe(expected)
    expect(result.count).toBe(1)
  })

  it('redacts several spans and preserves ordinary text and URLs', () => {
    const result = redactText('alice@example.com uses /tmp/private/file; docs: https://example.com/api/path')
    expect(result.text).toBe('[REDACTED_EMAIL] uses [REDACTED_PATH]; docs: https://example.com/api/path')
    expect(result.count).toBe(2)
    expect(redactText('ordinary text and relative/path.ts')).toEqual({
      text: 'ordinary text and relative/path.ts',
      count: 0,
    })
  })
})

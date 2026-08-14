/** Locale namespace owned by the Share dialog. */
export const NS = 'dsh-share'

/** Simplified-Chinese UI copy. */
export const zh = {
  action: '分享',
  title: '分享 Session',
  description: '在本机生成可预览的 Markdown 或单文件 HTML，不会上传内容。',
  close: '关闭',
  format: '格式',
  markdown: 'Markdown',
  html: '单文件 HTML',
  includeTools: '包含工具调用（参数与结果状态）',
  redact: '自动脱敏',
  acknowledgement: '我已检查预览，并了解关闭脱敏可能泄露凭据和隐私数据。',
  preview: '预览',
  loading: '正在生成安全预览…',
  error: '无法生成分享文件。',
  copy: '复制源码',
  copied: '已复制',
  copyFailed: '复制失败',
  download: '下载',
  stats: '{messages} 条消息 · {tools} 个工具调用 · {redactions} 处脱敏',
  'warning.redaction-best-effort': '自动脱敏是启发式保护，分享前仍需检查预览。',
  'warning.unredacted': '自动脱敏已关闭，文件可能包含凭据或隐私数据。',
  'warning.attachments-omitted': '图片和附件内容未导出。',
  'warning.injected-context-omitted': '插件注入的上下文未导出。',
  'warning.tools-omitted': '工具调用默认未导出。',
  'warning.tool-arguments-truncated': '过长的工具参数已截断。',
} as const

/** English UI copy. */
export const en: Record<keyof typeof zh, string> = {
  action: 'Share',
  title: 'Share Session',
  description: 'Create previewable Markdown or a single HTML file locally. Nothing is uploaded.',
  close: 'Close',
  format: 'Format',
  markdown: 'Markdown',
  html: 'Single-file HTML',
  includeTools: 'Include tool calls (arguments and outcome)',
  redact: 'Automatic redaction',
  acknowledgement: 'I reviewed the preview and understand that disabling redaction may expose credentials and private data.',
  preview: 'Preview',
  loading: 'Generating a safe preview…',
  error: 'Could not generate the share file.',
  copy: 'Copy source',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  download: 'Download',
  stats: '{messages} messages · {tools} tool calls · {redactions} redactions',
  'warning.redaction-best-effort': 'Automatic redaction is heuristic. Review the preview before sharing.',
  'warning.unredacted': 'Automatic redaction is off. The file may contain credentials or private data.',
  'warning.attachments-omitted': 'Image and attachment content was omitted.',
  'warning.injected-context-omitted': 'Plugin-injected context was omitted.',
  'warning.tools-omitted': 'Tool calls were omitted by default.',
  'warning.tool-arguments-truncated': 'Long tool arguments were truncated.',
}

/** Stable keys consumed by the browser contribution. */
export type DshShareLocaleKey = keyof typeof zh

/** Locale namespace owned by the Share dialog. */
export declare const NS = "dsh-local-share";
/** Simplified-Chinese UI copy. */
export declare const zh: {
    readonly action: "分享";
    readonly title: "分享 Session";
    readonly description: "在本机生成可预览的 Markdown、单文件 HTML 或 PNG 长图，不会上传内容。";
    readonly close: "关闭";
    readonly format: "格式";
    readonly markdown: "Markdown";
    readonly html: "单文件 HTML";
    readonly longImage: "PNG 长图";
    readonly includeTools: "包含工具调用（参数与结果状态）";
    readonly redact: "自动脱敏";
    readonly redactionSummary: "自动脱敏已开启；分享前仍请检查预览。";
    readonly acknowledgement: "我已检查预览，并了解关闭脱敏可能泄露凭据和隐私数据。";
    readonly turns: "选择轮次";
    readonly selectAll: "全选";
    readonly turn: "第 {number} 轮";
    readonly emptyTurn: "无可见文本";
    readonly preview: "预览";
    readonly loading: "正在生成安全预览…";
    readonly error: "无法生成分享文件。";
    readonly copy: "复制源码";
    readonly copyImage: "复制长图";
    readonly copied: "已复制";
    readonly copyFailed: "复制失败";
    readonly download: "下载";
    readonly downloadImage: "下载长图";
    readonly generatingImage: "正在生成长图…";
    readonly imageError: "无法生成长图；如果 Session 很长，请减少所选轮次后重试。";
    readonly stats: "{turns} 轮 · {messages} 条消息 · {tools} 个工具调用 · {redactions} 处脱敏";
    readonly 'warning.redaction-best-effort': "自动脱敏是启发式保护，分享前仍需检查预览。";
    readonly 'warning.unredacted': "自动脱敏已关闭，文件可能包含凭据或隐私数据。";
    readonly 'warning.attachments-omitted': "图片和附件内容未导出。";
    readonly 'warning.injected-context-omitted': "插件注入的上下文未导出。";
    readonly 'warning.tools-omitted': "工具调用默认未导出。";
    readonly 'warning.tool-arguments-truncated': "过长的工具参数已截断。";
};
/** English UI copy. */
export declare const en: Record<keyof typeof zh, string>;
/** Stable keys consumed by the browser contribution. */
export type DshShareLocaleKey = keyof typeof zh;

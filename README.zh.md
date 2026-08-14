# DSH Share

[![CI](https://github.com/ChuanTianML/dsh-share/actions/workflows/ci.yml/badge.svg)](https://github.com/ChuanTianML/dsh-share/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Session
的隐私优先 Markdown 与单文件 HTML 分享插件。
DSH Share 是一个独立的社区插件。

[English](README.md)

DSH Share 会在 Web Session Header 中加入 **分享** 入口。它先在本机生成预览，
再允许复制源码或下载文件。插件不会上传内容，也不会发起外部网络请求。

## 为什么需要 DSH Share

官方 Session log 导出的无损 ZIP 适合诊断和迁移；DSH Share 生成更小、可直接阅读
的文档，适合评审、Issue 报告和知识分享。

- 支持 Markdown 或一个无脚本 HTML 文件
- 默认开启尽力而为的自动脱敏
- 复制或下载前先预览
- 工具调用默认关闭，开启后折叠展示
- 不依赖云服务、账号或公开链接后端
- 不增加模型可见内容和模型 token 消耗

## 安装

DSH 目前仍处于开发者预览阶段。将已打 tag 的 GitHub bundle 安装到 Web profile：

```sh
dsh plugin --profile web add github:ChuanTianML/dsh-share#v0.1.0
dsh --profile web
```

打开一个非空 Session，点击 Header 中的 **分享**。

卸载插件：

```sh
dsh plugin --profile web remove dsh-share
```

## 隐私行为

默认文档只按日志顺序保留人类直接输入和助手可见文本。

| 内容 | 默认行为 | 可选行为 |
| --- | --- | --- |
| 人类输入 | 包含 | — |
| 助手可见文本 | 包含 | — |
| 工具名、有界参数、结果状态 | 排除 | 开启“包含工具调用” |
| 工具结果正文 | 排除 | 始终不包含 |
| 推理 / thinking | 排除 | 始终不包含 |
| 系统提示与请求配置 | 排除 | 始终不包含 |
| 插件注入的 user-role 上下文 | 排除 | 始终不包含 |
| 附件字节与 Session 元数据 | 排除 | 始终不包含 |

自动脱敏覆盖常见凭据、Authorization Header、含密钥的环境变量赋值、邮箱和本机
绝对路径。它是启发式保护，不是安全证明；分享前仍应检查预览。关闭自动脱敏后，
复制和下载会保持锁定，直到重新勾选风险确认。

预览运行在受 sandbox 限制的 `srcdoc` iframe 中。生成的 HTML 不含脚本和外部资源，
并带有严格的 Content Security Policy。

## Host 配置

所有资源上限都会在插件加载时验证。

| 字段 | 默认值 | 含义 |
| --- | ---: | --- |
| `maxEvents` | `20000` | 一个 Session 可接受的最大原始事件数 |
| `maxOutputChars` | `2000000` | 文件或预览的最大字符数 |
| `maxToolArgumentChars` | `12000` | 每个已启用工具调用保留的最大参数字符数 |

Session 或总输出超限会明确失败。只有工具参数允许截断，预览会显示对应警告。

## 开发

已验证的 Harness revision 是
`47f943859bef60e4160492346772ded9b24f765a`。请把开发 checkout 隔离到
`.sandbox/harness`：

```sh
corepack enable
pnpm install
git clone https://github.com/deepseek-ai/deepseek-harness.git .sandbox/harness
git -C .sandbox/harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir .sandbox/harness install --frozen-lockfile
pnpm --dir .sandbox/harness run build
pnpm run check
```

也可以用 `DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness` 指向另一个只读开发
checkout。`pnpm run check` 会运行严格类型检查、ESLint、单元与组合测试、Host/
浏览器构建以及 package dry run。profile 安装不会执行构建，因此仓库会提交 `lib/`
产物。

完整产品与安全设计见 [docs/design.md](docs/design.md)。

## 兼容性

0.1.0 面向上述 DSH 开发者预览 revision。DSH 尚未承诺稳定的外部插件兼容性；
Harness 后续变化可能需要发布新的 DSH Share 版本。

## 安全报告

见 [SECURITY.md](SECURITY.md)。不要在公开 Issue 中粘贴真实凭据或私有 Session。

## License

MIT

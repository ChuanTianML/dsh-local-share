/* global setTimeout, clearTimeout, URL, document, console, window, HTMLAnchorElement, location, Blob */
/** Exercise a packed plugin in the real Harness Web UI using only synthetic data. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'
import { seed } from '../integration/seed.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = await mkdtemp(join(tmpdir(), 'local-share-browser-'))
const cli = resolve(process.env.DSH_TEST_CLI ?? join(process.env.DSH_HARNESS_ROOT ?? join(root, '.sandbox/harness'), 'apps/cli/lib/bin.js'))
const env = { ...process.env, DSH_HOME: join(work, 'home'), DEEPSEEK_API_KEY: '' }
let server
let browser
let page
let output = ''
let url = process.env.DSH_TEST_URL
try {
  if (!url) {
    await seed(cli, env.DSH_HOME)
    const packed = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--ignore-scripts', '--json', '--cache', join(work, 'cache'), '--pack-destination', work], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' }))
    execFileSync(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', join(work, packed[0].filename)], { env, stdio: 'pipe' })
    const patch = join(work, 'test.patch.yml')
    await writeFile(patch, `- id: session-persistence-jsonl\n  config:\n    root: ${JSON.stringify(join(env.DSH_HOME, 'sessions'))}\n    compression: none\n`)
    server = spawn(process.execPath, [cli, 'web', '--patch', patch, '--no-open', '--port', '0'], { env, cwd: work, stdio: ['ignore', 'pipe', 'pipe'] })
    url = await new Promise((resolveUrl, reject) => {
      const timer = setTimeout(() => reject(new Error('Harness startup timed out')), 60_000)
      const receive = data => {
        output += data
        const match = output.match(/dsh web: (http:\/\/127[^\s]+)/u)
        if (match) { clearTimeout(timer); resolveUrl(match[1]) }
      }
      server.stdout.on('data', receive)
      server.stderr.on('data', receive)
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Harness exited ${code}: ${output.replace(/token=[^\s]+/gu, 'token=[omitted]')}`)) })
    })
  }
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {})
  page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const target = new URL(route.request().url())
    return target.hostname === new URL(url).hostname || ['blob:', 'data:'].includes(target.protocol) ? route.continue() : route.abort()
  })
  await page.goto(url)
  await page.getByText('Workspaces', { exact: true }).waitFor()
  await page.addLocatorHandler(page.getByRole('button', { name: 'Continue', exact: true }), locator => locator.click())
  await page.addLocatorHandler(page.getByText('Get started', { exact: true }), () => page.keyboard.press('Escape'))
  const ungrouped = page.getByText('Ungrouped', { exact: true })
  if (await ungrouped.isVisible()) await ungrouped.click()
  await page.getByText('Local Share validation', { exact: true }).or(page.getByText('Untitled', { exact: true })).first().click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const download = dialog.getByRole('button', { name: 'Download', exact: true })
  await download.waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('.dsh-local-share-preview-overlay-visible'))
  assert.equal(await dialog.getByLabel('Automatic redaction', { exact: true }).isChecked(), true)
  assert.equal(await dialog.getByLabel('Include tool calls (arguments and outcome)', { exact: true }).isChecked(), false)

  async function save(format) {
    await dialog.getByLabel(format, { exact: true }).check()
    const button = dialog.getByRole('button', { name: format === 'Long PNG' ? 'Download image' : 'Download', exact: true })
    await page.waitForFunction(() => !document.querySelector('.dsh-local-share-preview-overlay-visible'))
    const pending = page.waitForEvent('download')
    await button.click()
    const file = await pending
    assert.equal(await file.failure(), null)
    const data = await readFile(await file.path())
    if (format === 'Long PNG') {
      assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
      assert.ok(data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0)
      await file.saveAs(join(work, 'share.png'))
    } else {
      const text = data.toString()
      assert.ok(text.includes('[REDACTED_EMAIL]') && text.includes('[REDACTED_SECRET]'))
      assert.ok(!text.includes('PRIVATE_REASONING_SENTINEL') && !text.includes('alice@example.com') && !text.includes('sk-abcdefghijklmnop'))
      if (format === 'Single-file HTML') assert.ok(!/<script[\s>]/iu.test(text))
    }
    return data.toString()
  }
  for (const format of ['Markdown', 'Single-file HTML', 'Long PNG']) await save(format)
  console.log('PASS: packed plugin registers, renders, and downloads Markdown, HTML, PNG')

  await page.evaluate(() => {
    // Reproduce the reported host rewrite at both the prototype and document levels.
    window.rewrittenShareLinks = 0
    const rewrite = anchor => {
      if (anchor instanceof HTMLAnchorElement && new URL(anchor.href).origin === location.origin) {
        anchor.href += '?__dsh_hub_session=synthetic'
        window.rewrittenShareLinks++
      }
    }
    const nativeClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () { rewrite(this); nativeClick.call(this) }
    document.addEventListener('click', event => rewrite(event.target), true)
    const probe = document.createElement('a')
    probe.href = URL.createObjectURL(new Blob(['old implementation']))
    // Positive control: the legacy parent-realm path would be rewritten.
    rewrite(probe)
    if (!probe.href.includes('__dsh_hub_session')) throw new Error('rewrite fixture inactive')
    URL.revokeObjectURL(probe.href.split('?')[0])
    window.rewrittenShareLinks = 0
  })
  for (const format of ['Markdown', 'Single-file HTML', 'Long PNG']) await save(format)
  assert.equal(await page.evaluate(() => window.rewrittenShareLinks), 0)
  console.log('PASS: all three formats download under Hub-style link rewriting without a file picker')

  await dialog.getByLabel('Markdown', { exact: true }).check()
  await dialog.locator('.dsh-local-share-turn input').nth(1).uncheck()
  const selected = await save('Markdown')
  assert.ok(selected.includes('Answer 1') && !selected.includes('Answer 2'))
  await dialog.getByLabel('Automatic redaction', { exact: true }).uncheck()
  await page.waitForFunction(() => !document.querySelector('.dsh-local-share-preview-overlay-visible'))
  assert.equal(await download.isDisabled(), true)
  await dialog.getByLabel(/I reviewed the preview/).check()
  assert.equal(await download.isEnabled(), true)
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  assert.equal(await dialog.getByLabel('Automatic redaction', { exact: true }).isChecked(), true)
  await page.waitForFunction(() => !document.querySelector('.dsh-local-share-preview-overlay-visible'))
  await page.screenshot({ path: join(work, 'share-desktop.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(work, 'share-mobile.png'), fullPage: true, animations: 'disabled' })
  assert.deepEqual(errors, [])
  console.log('PASS: selected-turn filtering, redaction, consent reset, no page errors')
  console.log(`Evidence: ${work}`)
} catch (error) {
  if (page) { console.error(await page.locator('body').innerText()); await page.screenshot({ path: join(work, 'failure.png'), fullPage: true, animations: 'disabled' }) }
  console.error(`Evidence: ${work}`)
  throw error
} finally {
  await browser?.close()
  server?.kill('SIGTERM')
}

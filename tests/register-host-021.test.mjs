import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'

// The plugin starts its driver session during apply(); a stub keeps this test
// independent of a real cua-driver installation.
const stubDir = mkdtempSync(join(tmpdir(), 'dsh-cu-stub-'))
const stub = join(stubDir, 'cua-driver-stub.mjs')
writeFileSync(stub, '#!/usr/bin/env node\nprocess.stdout.write("{}")\n')
chmodSync(stub, 0o755)
process.env.CUA_DRIVER_BIN = stub

const plugin = (await import('../index.js')).default
const { Config, renderWithImage } = await import('../index.js')

const hostConfig = Config({ cursorTheme: '' })

function registeredTools() {
  const tools = new Map()
  const ctx = {
    tools: {
      register(definition) {
        tools.set(definition.name, definition)
        return () => tools.delete(definition.name)
      },
    },
    get: () => undefined,
    logger: { info() {} },
    approval: { request: async () => 'unavailable' },
  }
  plugin.apply(ctx, hostConfig)
  return tools
}

const IMAGE = {
  attachmentId: 'sha256:test',
  mediaType: 'image/png',
  bytes: 1,
  width: 10,
  height: 20,
  name: 'screen.png',
}

const OUTPUT_SAMPLES = {
  screen_observe: [
    {
      ok: true,
      result: 'window',
      window: { pid: 1, windowId: 2, app: 'Finder', title: 'Desktop' },
      elementCount: 1,
      mode: 'ax',
      elements: [{ index: 1, role: '按钮', label: '打开', x: 10, y: 20 }],
      screenshotFile: null,
    },
    {
      ok: true,
      result: 'window',
      window: { pid: 1, windowId: 2, app: 'Finder', title: 'Desktop' },
      elementCount: 0,
      mode: 'native',
      elements: [],
      screenshotFile: null,
      image: IMAGE,
    },
  ],
  screen_zoom: [
    { ok: true, result: 'zoom', image: IMAGE },
    { ok: false, result: 'unsupported route' },
  ],
  computer_click: [{ ok: true, result: 'clicked' }, { ok: false, result: 'refused' }],
  computer_double_click: [{ ok: true, result: 'double clicked' }],
  computer_right_click: [{ ok: true, result: 'right clicked' }],
  computer_type: [{ ok: true, result: 'typed' }],
  computer_key: [{ ok: true, result: 'pressed' }],
  computer_scroll: [{ ok: true, result: 'scrolled' }],
  computer_drag: [{ ok: true, result: 'dragged' }],
  computer_wait: [{ ok: true, result: 'waited' }],
  app_list: [{ ok: true, result: 'apps', apps: [{ name: 'Finder', pid: 1, active: true }] }],
  app_launch: [{ ok: true, result: 'launched', pid: 1 }, { ok: true, result: 'launched', pid: null }],
}

test('registers all 12 tools against the host tool contract', () => {
  const tools = registeredTools()
  assert.deepEqual([...tools.keys()], [
    'screen_observe',
    'screen_zoom',
    'computer_click',
    'computer_double_click',
    'computer_right_click',
    'computer_type',
    'computer_key',
    'computer_scroll',
    'computer_drag',
    'computer_wait',
    'app_list',
    'app_launch',
  ])
})

test('every tool output schema accepts its runtime shape', () => {
  const tools = registeredTools()
  for (const [name, samples] of Object.entries(OUTPUT_SAMPLES)) {
    const tool = tools.get(name)
    assert.ok(tool, `${name} must be registered`)
    for (const sample of samples) {
      assert.deepEqual(
        validateJsonSchemaValue(tool.output.schema, sample, 'value'),
        [],
        `${name} rejected ${JSON.stringify(sample)}`,
      )
    }
  }
})

test('a registered tool executes through the host validation pipeline', async () => {
  const tool = registeredTools().get('computer_wait')
  const value = await tool.execute({ ms: 1 }, {})
  assert.deepEqual(value, { ok: true, result: '已等待 1ms。' })
  assert.deepEqual(tool.output.render({}, value), [{ type: 'text', text: '已等待 1ms。' }])
})

test('renderWithImage keeps the host image block contract', () => {
  const blocks = renderWithImage({}, { result: 'screenshot', image: IMAGE })
  assert.deepEqual(blocks, [
    { type: 'text', text: 'screenshot' },
    { type: 'image', attachment: IMAGE },
  ])
})

import test from 'node:test'
import assert from 'node:assert/strict'

import { deepseekVisionDescribe } from '../lib/vision.js'

function llmContext(chunks) {
  return {
    get(name) {
      if (name !== 'llm') return undefined
      return {
        async resolveModelInfo(provider, model) {
          return { provider, id: model, inputModalities: ['text', 'image'] }
        },
        async *stream() {
          yield* chunks
        },
      }
    },
  }
}

const cfg = { visionProvider: 'deepseek-official', visionModel: 'vision-test' }
const request = { imageRef: { attachmentId: 'sha256:test' }, question: 'describe' }

test('reads text deltas from the DSH 0.2 stream protocol', async () => {
  const ctx = llmContext([
    { type: 'reasoning-delta', text: 'thinking' },
    { type: 'text-delta', text: '界面' },
    { type: 'text-delta', text: '内容' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  assert.equal(await deepseekVisionDescribe(ctx, cfg, request), '界面内容')
})

test('surfaces a terminal finish error from the DSH 0.2 stream protocol', async () => {
  const ctx = llmContext([
    { type: 'finish', reason: { kind: 'error', failure: { message: 'MISSING_CREDENTIAL' } } },
  ])
  await assert.rejects(deepseekVisionDescribe(ctx, cfg, request), /MISSING_CREDENTIAL/)
})

test('surfaces a terminal abort from the DSH 0.2 stream protocol', async () => {
  const ctx = llmContext([
    { type: 'finish', reason: { kind: 'aborted' } },
  ])
  await assert.rejects(deepseekVisionDescribe(ctx, cfg, request), /已取消/)
})

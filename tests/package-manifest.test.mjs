import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'))

const manifest = await readJson('../package.json')
const lockfile = await readJson('../package-lock.json')

const HOST_PACKAGES = [
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/schemastery',
]

const DSH_RANGE = '>=0.1.2-rc.1 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0'

test('host-owned DSH packages are peers, not runtime dependencies', () => {
  for (const packageName of HOST_PACKAGES) {
    assert.equal(
      manifest.dependencies?.[packageName],
      undefined,
      `${packageName} must not be bundled as a runtime dependency`,
    )
    assert.equal(
      manifest.peerDependencies?.[packageName],
      packageName.endsWith('dsh-tools') ? DSH_RANGE : '>=3.18.2 <4',
      `${packageName} must declare the tested host compatibility range`,
    )
    assert.ok(
      manifest.devDependencies?.[packageName],
      `${packageName} must remain available for local tests`,
    )
  }
})

test('the manifest admits the tested DSH 0.2 prerelease line', () => {
  assert.equal(manifest.engines?.dsh, DSH_RANGE)
  assert.equal(manifest.dsh?.compatibility?.dsh, DSH_RANGE)
})

test('package-lock records the same host-first dependency contract', () => {
  const root = lockfile.packages['']
  assert.equal(root.dependencies, undefined)
  assert.deepEqual(root.peerDependencies, manifest.peerDependencies)
  assert.deepEqual(root.devDependencies, manifest.devDependencies)
})

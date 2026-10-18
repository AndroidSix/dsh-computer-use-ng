import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const distTag = manifest.version.includes('-') ? 'next' : 'latest'
const dryRun = process.argv.includes('--dry-run')

const run = (command, args) => {
  console.log(`\n$ ${command} ${args.join(' ')}`)
  if (!dryRun) execFileSync(command, args, { stdio: 'inherit' })
}

run('node', ['scripts/check-release-version.mjs'])
run('npm', ['test'])
run('npm', ['run', 'check'])
run('npm', ['pack', '--ignore-scripts'])
run('npm', [
  'publish',
  `./${manifest.name}-${manifest.version}.tgz`,
  '--access',
  'public',
  '--provenance',
  '--ignore-scripts',
  '--tag',
  distTag,
])

if (dryRun) console.log('\nDry run only: nothing was packed or published.')

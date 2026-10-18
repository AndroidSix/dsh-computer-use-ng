import { readFileSync } from 'node:fs'

const readJson = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'))

const manifest = readJson('../package.json')
const lockfile = readJson('../package-lock.json')
const expectedTag = `v${manifest.version}`

const problems = []
if (lockfile.version !== manifest.version) problems.push(`package-lock version ${lockfile.version}`)
if (lockfile.packages['']?.version !== manifest.version) problems.push(`package-lock root ${lockfile.packages['']?.version}`)

const requestedTag = process.argv[2] ?? process.env.RELEASE_TAG
if (requestedTag && requestedTag !== expectedTag) problems.push(`tag ${requestedTag}`)

if (problems.length > 0) {
  console.error(`Version mismatch: package.json is ${manifest.version}, but ${problems.join(', ')} must be ${manifest.version}`)
  process.exit(1)
}

const distTag = manifest.version.includes('-') ? 'next' : 'latest'
if (process.env.GITHUB_ENV) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_ENV, `NPM_TAG=${distTag}\n`)
}
console.log(`${expectedTag} -> npm dist-tag ${distTag}`)

/**
 * Cross-platform standalone assembly (works on Linux, macOS, Windows).
 * 1. copies .next/static and public/ into .next/standalone
 * 2. assembles .next/standalone → server-dist (used by the Electron build)
 */
const fs = require('fs')
const path = require('path')

function copy(src, dest) {
  const st = fs.statSync(src)
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f))
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('standalone build not found — run `next build` first')
  process.exit(1)
}

copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'))
copy(path.join(root, 'public'), path.join(standalone, 'public'))

const serverDist = path.join(root, 'server-dist')
fs.rmSync(serverDist, { recursive: true, force: true })
copy(standalone, serverDist)

console.log('✓ standalone assembled → server-dist')

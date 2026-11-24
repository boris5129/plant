import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const port = 4187
const address = `http://127.0.0.1:${port}/`

async function localStatus() {
  try {
    const response = await fetch(address, { method: 'HEAD', signal: AbortSignal.timeout(500), redirect: 'manual' })
    return response.ok && response.headers.get('x-plant-fit') === 'local' ? 'ready' : 'occupied'
  } catch {
    return 'unreachable'
  }
}

async function startLocal() {
  const status = await localStatus()
  if (status === 'ready') return
  if (status === 'occupied') throw new Error(`Another application is using port ${port}.`)
  const server = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url))], {
    env: { ...process.env, PLANT_FIT_PORT: String(port) },
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  let launchError
  server.once('error', (error) => { launchError = error })
  server.unref()
  for (let attempt = 0; attempt < 25; attempt++) {
    await delay(150)
    if (await localStatus() === 'ready') return
    if (launchError) throw launchError
    if (server.exitCode !== null) break
  }
  throw new Error(`PLANT FIT could not start at ${address}`)
}

async function openChrome() {
  const locations = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map((folder) => path.join(folder, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  for (const location of locations) {
    try {
      await access(location)
    } catch {
      continue
    }
    const chrome = spawn(location, [address], { detached: true, stdio: 'ignore' })
    await new Promise((resolve, reject) => {
      chrome.once('spawn', resolve)
      chrome.once('error', reject)
    })
    chrome.unref()
    return
  }
  throw new Error(`Chrome was not found. Open ${address} in Chrome.`)
}

try {
  await startLocal()
  if (!process.argv.includes('--no-open')) await openChrome()
  console.log(address)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}

#!/usr/bin/env node
// Type the corpus into the real ROMs and record what they crunch it to.
//
//   npm run capture:rom                 write src/test/fixtures/rom-crunch.json
//   npm run capture:rom -- --check      re-capture, and fail on any difference
//
// Options: --rom1 <file>, --rom2 <file> (default: the installed emulator's
// bundled BIOS.bin / BIOS2.bin), --port <n> (debug port for BIOS 1; BIOS 2 uses
// n+1; default: free ports the OS picks).
//
// Needs AC6502 Emulator 3.1.1 installed (the `6502` command). For each BIOS it
// boots a headless machine with the debug server on, and for each corpus
// program it types NEW, then every line followed by PRINT 12345+1, waiting for
// " 12346" before the next line. That paces typing to the crunch, so the
// capture never leans on serial flow control either way. Then it reads VARTAB
// ($035F) and $0800..VARTAB-1 (the image SAVE would write) and the output of
// LIST.
//
// It also decodes KeywordTbl from the running ROM and requires it to equal
// src/test/fixtures/tokens-1.6.json / tokens-2.0.json byte for byte.
//
// The emulator is deterministic, so nothing is retried: the first difference
// fails the run. Every machine started here is stopped before exit.

import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = path.join(ROOT, 'src', 'test', 'corpus')
const FIXTURES = path.join(ROOT, 'src', 'test', 'fixtures')
const OUTPUT = path.join(FIXTURES, 'rom-crunch.json')

const EMULATOR_VERSION = '3.1.1'
const PROGRAM_START = 0x0800
const VARTAB = 0x035f

const BIOSES = {
  1: {
    bios: 'v1.6',
    vdp: 'tms9918a',
    romName: 'BIOS.bin',
    sha256: '4b4154afac681e26324d3f5a845e41770d977c05db1ef6516c9d2c5e210d8c56',
    banner: /6502 BIOS v1\.6/,
    tokens: 'tokens-1.6.json',
  },
  2: {
    bios: 'v2.0.2',
    vdp: 'picovdp',
    romName: 'BIOS2.bin',
    sha256: '7a71252daa7f341a7c6ac8ff7015a0481bf003ace99b0cb0c1e575a7e1f1d70e',
    banner: /AC6502 BIOS v2\.0/,
    tokens: 'tokens-2.0.json',
  },
}

// -----------------------------------------------------------------------------

function fail(message) {
  console.error(`capture-rom: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const options = { check: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check') { options.check = true }
    else if (arg === '--rom1' || arg === '--rom2' || arg === '--port') {
      if (argv[i + 1] === undefined) { fail(`${arg} needs a value`) }
      options[arg.slice(2)] = argv[++i]
    } else { fail(`unknown option ${arg}`) }
  }
  return options
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The installed app's Resources directory, from the `6502` shim. */
function emulatorResources() {
  const which = spawnSync('sh', ['-c', 'command -v 6502'], { encoding: 'utf8' })
  const shim = which.stdout.trim()
  if (which.status === 0 && shim) {
    const match = fs.readFileSync(fs.realpathSync(shim), 'latin1').match(/"([^"]*?\.app)\/Contents\//)
    if (match) { return path.join(match[1], 'Contents', 'Resources') }
  }
  return '/Applications/AC6502 Emulator.app/Contents/Resources'
}

function checkEmulator() {
  const result = spawnSync('6502', ['--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    fail(`the 6502 command is not installed; install AC6502 Emulator ${EMULATOR_VERSION}`)
  }
  const version = result.stdout.trim()
  if (version !== EMULATOR_VERSION) {
    fail(`6502 --version is ${version}; this capture needs ${EMULATOR_VERSION}`)
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// -----------------------------------------------------------------------------

class Machine {

  constructor(bios, rom, port) {
    this.bios = bios
    this.rom = rom
    this.port = port
    this.token = randomBytes(16).toString('hex')
    this.home = fs.mkdtempSync(path.join(os.tmpdir(), 'bastok-capture-'))
    this.log = ''
  }

  start() {
    const args = [
      'run', '--headless', '--quiet',
      '--debug', '--debug-port', String(this.port), '--debug-token', this.token,
      '--rom', this.rom, '--vdp', BIOSES[this.bios].vdp,
      '--timeout', '600s',
    ]
    // A private SIXTY5O2_HOME keeps this run's session lock away from any
    // other emulator the user has running.
    this.child = spawn('6502', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SIXTY5O2_HOME: this.home },
    })
    this.exited = new Promise(resolve => this.child.once('exit', resolve))
    this.child.stdout.on('data', data => { this.log += data })
    this.child.stderr.on('data', data => { this.log += data })
  }

  async stop() {
    if (this.child && this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill('SIGTERM')
      const done = await Promise.race([this.exited.then(() => true), sleep(5000).then(() => false)])
      if (!done) {
        this.child.kill('SIGKILL')
        await this.exited
      }
    }
    fs.rmSync(this.home, { recursive: true, force: true })
  }

  async rpc(method, params) {
    for (let attempt = 0; ; attempt++) {
      if (this.child.exitCode !== null) {
        throw new Error(`the emulator exited (${this.child.exitCode}): ${this.log.trim()}`)
      }
      let response
      try {
        response = await fetch(`http://127.0.0.1:${this.port}/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        })
      } catch (error) {
        // Only while the server is still coming up.
        if (attempt < 100) { await sleep(200); continue }
        throw error
      }
      const reply = await response.json()
      if (reply.error) { throw new Error(`${method}: ${reply.error.message}`) }
      return reply.result
    }
  }

  async waitFor(serial, since, what) {
    const result = await this.rpc('wait.for', { serial, since, timeoutMs: 30000 })
    if (!result.matched) {
      throw new Error(`BIOS ${this.bios}: timed out waiting for ${what}; output so far: ${JSON.stringify(result.output)}`)
    }
    return result.output
  }

  async send(text, serial, what) {
    const { cursor } = await this.rpc('serial.write', { data: text })
    return this.waitFor(serial, cursor, what)
  }

  async read(address, length) {
    const { data } = await this.rpc('mem.read', { address, length })
    return Buffer.from(data, 'base64')
  }

  async boot() {
    const info = await this.rpc('session.info')
    if (info.version !== EMULATOR_VERSION) {
      throw new Error(`the debug server reports version ${info.version}, not ${EMULATOR_VERSION}`)
    }
    const banner = await this.waitFor('BYTES FREE[\\s\\S]*OK\\r\\n', 0, 'BASIC to start')
    if (!BIOSES[this.bios].banner.test(banner)) {
      throw new Error(`BIOS ${this.bios}: unexpected banner ${JSON.stringify(banner)}`)
    }
  }

  /** KeywordTbl, decoded from the running ROM, as tokens.json would hold it. */
  async keywordTable() {
    const { matches } = await this.rpc('mem.search', {
      pattern: [0x45, 0x4e, 0xc4, 0x46, 0x4f, 0xd2], start: 0x8000, end: 0xffff,
    })
    if (matches.length !== 1) {
      throw new Error(`BIOS ${this.bios}: KeywordTbl found ${matches.length} times`)
    }
    const bytes = await this.read(matches[0], 1024)
    const table = {}
    let word = ''
    for (let i = 0; bytes[i] !== 0; i++) {
      if (i >= bytes.length) { throw new Error(`BIOS ${this.bios}: KeywordTbl has no terminator`) }
      word += String.fromCharCode(bytes[i] & 0x7f)
      if (bytes[i] & 0x80) {
        table[`$${(0x80 + Object.keys(table).length).toString(16).toUpperCase()}`] = word
        word = ''
      }
    }
    return JSON.stringify(table, null, 2) + '\n'
  }

  async type(name, text) {
    await this.send('NEW\r', 'OK\\r\\n', 'NEW')
    const lines = text.split(/\r\n|\r|\n/).filter(line => line.trim() !== '')
    for (const line of lines) {
      const output = await this.send(`${line}\rPRINT 12345+1\r`, ' 12346\\r\\n', `line "${line}"`)
      const error = output.match(/\?[A-Z' ]*ERROR/)
      if (error) {
        throw new Error(`BIOS ${this.bios}, ${name}: "${line}" gave ${error[0]}`)
      }
    }

    const vartab = (await this.read(VARTAB, 2)).readUInt16LE(0)
    if (vartab < PROGRAM_START + 2) {
      throw new Error(`BIOS ${this.bios}, ${name}: VARTAB is $${vartab.toString(16)}`)
    }
    const image = await this.read(PROGRAM_START, vartab - PROGRAM_START)

    const output = await this.send('LIST\r', '\\r\\n\\r\\nOK\\r\\n$', 'LIST')
    const list = output
      .replace(/\r\n/g, '\n')
      .replace(/^LIST\n/, '')
      .replace(/\n\nOK\n$/, '\n')

    return { image: image.toString('hex'), list }
  }

}

// -----------------------------------------------------------------------------

async function capture(options) {
  checkEmulator()
  const resources = emulatorResources()
  const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS, 'manifest.json'), 'utf8'))
  const names = Object.keys(manifest).sort()

  const result = { emulator: EMULATOR_VERSION, roms: {}, programs: {} }
  for (const name of names) { result.programs[name] = {} }

  for (const bios of [1, 2]) {
    const spec = BIOSES[bios]
    const rom = options[`rom${bios}`] ?? path.join(resources, 'assets', 'roms', spec.romName)
    if (!fs.existsSync(rom)) { fail(`no ROM at ${rom}; pass --rom${bios}`) }
    const hash = sha256(fs.readFileSync(rom))
    if (hash !== spec.sha256) {
      fail(`${rom} has sha256 ${hash}; BIOS ${spec.bios} is ${spec.sha256}`)
    }
    result.roms[bios] = { bios: spec.bios, sha256: hash }

    const port = options.port !== undefined ? Number(options.port) + bios - 1 : await freePort()
    const machine = new Machine(bios, rom, port)
    running = machine
    console.error(`capture-rom: BIOS ${spec.bios} (${spec.vdp}) on port ${port}`)
    try {
      machine.start()
      await machine.boot()

      const table = await machine.keywordTable()
      const pinned = fs.readFileSync(path.join(FIXTURES, spec.tokens), 'utf8')
      if (table !== pinned) {
        throw new Error(`KeywordTbl in the running ${spec.bios} ROM differs from ${spec.tokens}`)
      }
      console.error(`capture-rom:   KeywordTbl = ${spec.tokens}`)

      for (const name of names) {
        if (!manifest[name].bios.includes(bios)) { continue }
        const text = fs.readFileSync(path.join(CORPUS, `${name}.txt`), 'latin1')
        result.programs[name][bios] = await machine.type(name, text)
        console.error(`capture-rom:   ${name}`)
      }
    } finally {
      await machine.stop()
      running = null
    }
  }

  return JSON.stringify(result, null, 2) + '\n'
}

function firstDifference(expected, actual) {
  const a = expected.split('\n')
  const b = actual.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `line ${i + 1}:\n  committed: ${a[i]}\n  captured:  ${b[i]}`
    }
  }
  return ''
}

let running = null
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    if (running) { await running.stop() }
    process.exit(130)
  })
}

const options = parseArgs(process.argv.slice(2))
let json
try {
  json = await capture(options)
} catch (error) {
  fail(error.message)
}

if (options.check) {
  const committed = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : ''
  if (committed !== json) {
    fail(`${path.relative(ROOT, OUTPUT)} differs from the ROMs' crunch; ${firstDifference(committed, json)}`)
  }
  console.error(`capture-rom: check passed; ${path.relative(ROOT, OUTPUT)} matches both ROMs`)
} else {
  fs.writeFileSync(OUTPUT, json)
  console.error(`capture-rom: wrote ${path.relative(ROOT, OUTPUT)}`)
}

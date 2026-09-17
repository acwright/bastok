// The command line, run as a user would: node dist/index.js.

import { strict as assert } from 'assert'
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { after, test } from 'node:test'

import { Bastok } from '../Bastok/Bastok'

const ROOT = path.join(__dirname, '..', '..')
const CLI = path.join(ROOT, 'dist', 'index.js')

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'buffer' })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr.toString('utf8'),
  }
}

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bastok-'))
after(() => fs.rmSync(TEMP, { recursive: true, force: true }))

let files = 0
function source(text: string): string {
  const file = path.join(TEMP, `program${files++}.txt`)
  fs.writeFileSync(file, text)
  return file
}

function rows(output: Buffer): string[] {
  return output.toString('utf8').trimEnd().split('\n')
}

test('--bios accepts only 1 or 2', () => {
  const file = source('10 END\n')
  const result = run('-b', '3', file)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /BIOS must be 1 or 2/)
  assert.match(result.stderr, /Usage: bastok/)
})

test('-T prints the 1.x table by default', () => {
  const table = rows(run('-T').stdout)
  assert.equal(table.length, 85)
  assert.equal(table[0x34], '$B4  BRK')
  assert.equal(table.at(-1), '$D4  FORMAT')
})

test('-T -b 2 prints the 2.x table', () => {
  const table = rows(run('-T', '-b', '2').stdout)
  assert.equal(table.length, 100)
  assert.equal(table[0x34], '$B4  SCREEN')
  assert.equal(table.at(-1), '$E3  NVFIND')
})

test('-t -b 2 writes the library\'s 2.x bytes', () => {
  const text = '10 VPOKE 1,2: SCREEN 0\n'
  const bastok = new Bastok()
  bastok.bios = 2
  const result = run('-t', '-b', '2', '-o', '-', source(text))
  assert.equal(result.status, 0)
  assert.deepEqual(result.stdout, bastok.tokenize(text).buffer)
  assert.equal(result.stderr, '')
})

test('the default is BIOS 1, and it hints at --bios 2 for 2.x source', () => {
  const text = '10 VPOKE 1,2\n'
  const result = run('-t', '-o', '-', source(text))
  assert.equal(result.status, 0)
  assert.deepEqual(result.stdout, new Bastok().tokenize(text).buffer)
  assert.match(result.stderr, /line 10 crunches differently on BIOS 2\.x \(VPOKE\); use --bios 2/)
})

test('-q silences hints', () => {
  const file = source('10 VPOKE 1,2\n20 BRK\n')
  assert.equal(run('-q', '-t', '-o', '-', file).stderr, '')
  assert.equal(run('-q', '-t', '-b', '2', '-o', '-', file).stderr, '')
  const image = source('')
  fs.writeFileSync(image, run('-q', '-t', '-b', '2', '-o', '-', file).stdout)
  assert.equal(run('-q', '-d', '-o', '-', image).stderr, '')
  assert.match(run('-d', '-o', '-', image).stderr, /try --bios 2/)
})

test('guess.txt still tokenizes to guess.prg', () => {
  const result = run('-q', '-o', '-', path.join(ROOT, 'examples', 'guess.txt'))
  assert.deepEqual(result.stdout, fs.readFileSync(path.join(ROOT, 'examples', 'guess.prg')))
})

test('-v prints the package version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.equal(run('-v').stdout.toString('utf8').trim(), pkg.version)
})

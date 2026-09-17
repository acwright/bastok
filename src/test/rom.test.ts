// bastok against the ROMs' own crunch.
//
// src/test/fixtures/rom-crunch.json is what `npm run capture:rom` recorded by
// typing each program in src/test/corpus into BIOS v1.6 and v2.0.1 on AC6502
// Emulator 3.1.1: the bytes from $0800 to VARTAB (what SAVE writes) and the
// output of LIST. These tests need no emulator; `npm run capture:rom -- --check`
// re-captures and proves the file is still what the ROMs do.

import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { test } from 'node:test'

import { Bastok } from '../Bastok/Bastok'
import { Bios } from '../Bastok/Tokens'

const ROOT = path.join(__dirname, '..', '..')
const CORPUS = path.join(ROOT, 'src', 'test', 'corpus')

interface Capture { image: string, list: string }

const capture: {
  emulator: string
  roms: Record<string, { bios: string, sha256: string }>
  programs: Record<string, Record<string, Capture>>
} = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'test', 'fixtures', 'rom-crunch.json'), 'utf8'))

const manifest: Record<string, { bios: Bios[] }> =
  JSON.parse(fs.readFileSync(path.join(CORPUS, 'manifest.json'), 'utf8'))

function bastokFor(bios: Bios): Bastok {
  const bastok = new Bastok()
  bastok.bios = bios
  return bastok
}

test('the capture is from BIOS v1.6 and v2.0.1 on emulator 3.1.1', () => {
  assert.equal(capture.emulator, '3.1.1')
  assert.deepEqual(capture.roms, {
    1: { bios: 'v1.6', sha256: '4b4154afac681e26324d3f5a845e41770d977c05db1ef6516c9d2c5e210d8c56' },
    2: { bios: 'v2.0.1', sha256: 'f5fb454b9f407c9cbb4cb349ac833b7c92400122d44b6a5840ebe6ab9cf0d97b' },
  })
})

test('every corpus program was captured on each BIOS it lists', () => {
  assert.deepEqual(Object.keys(capture.programs).sort(), Object.keys(manifest).sort())
  for (const [name, { bios }] of Object.entries(manifest)) {
    assert.deepEqual(Object.keys(capture.programs[name]).sort(), bios.map(String).sort(), name)
  }
})

for (const [name, captures] of Object.entries(capture.programs)) {
  for (const [key, { image, list }] of Object.entries(captures)) {
    const bios = Number(key) as Bios
    const source = fs.readFileSync(path.join(CORPUS, `${name}.txt`), 'latin1')

    test(`${name}, BIOS ${bios}: tokenizing gives the ROM's bytes`, () => {
      assert.equal(bastokFor(bios).tokenize(source).buffer.toString('hex'), image)
    })

    test(`${name}, BIOS ${bios}: detokenizing gives the ROM's LIST`, () => {
      const result = bastokFor(bios).detokenize(Buffer.from(image, 'hex'))
      assert.equal(result.text, list)
      assert.deepEqual(result.warnings, [])
    })

    test(`${name}, BIOS ${bios}: the ROM's image survives a round trip`, () => {
      const bastok = bastokFor(bios)
      const text = bastok.detokenize(Buffer.from(image, 'hex')).text
      assert.equal(bastok.tokenize(text).buffer.toString('hex'), image)
    })
  }
}

test('examples/guess.prg is the image BIOS 1.6 and 2.0.1 store for guess.txt', () => {
  const prg = fs.readFileSync(path.join(ROOT, 'examples', 'guess.prg')).toString('hex')
  assert.equal(capture.programs['common-guess']['1'].image, prg)
  assert.equal(capture.programs['common-guess']['2'].image, prg)
})

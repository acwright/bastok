// The token tables, pinned to the BIOS they mirror.
//
// tokens-1.6.json: KeywordTbl decoded from 6502-BIOS tag v1.6
//   (commit 71e1e66560cf08635812b062a038c14381dd8f69), BIOS.bin sha256
//   fc0002d0ae25240ed36cfa4bea12735ee71fb05017651bf726520af0658be0a0 (the same
//   file as 6502 Emulator 3.1.0's assets/roms/BIOS.bin). Method: find the table
//   by its first bytes "EN" $C4 "FO" $D2 (END, FOR), then read keywords up to the
//   $00 terminator, bit 7 ending each one; keys "$80".. in order, JSON with a
//   two-space indent and a trailing newline. The same decode of v2.0's BIOS.bin
//   reproduces v2.0's tests/fixtures/tokens.json byte for byte. Generated once;
//   never regenerate it from Tokens.ts.

import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { test } from 'node:test'

import { Bastok } from '../Bastok/Bastok'
import { KEYWORDS, KEYWORDS_1, TOK_BASE, TOK_MAX, TOK_REM } from '../Bastok/Tokens'

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures')

const TOKENS_1_6_SHA256 = '497ae892f33f04295a0ea89cc09c5e99713b922a62c70900425e225a67d4f6f9'

function fixture(name: string): { bytes: Buffer, json: Record<string, string> } {
  const bytes = fs.readFileSync(path.join(FIXTURES, name))
  return { bytes, json: JSON.parse(bytes.toString('utf8')) }
}

function asObject(keywords: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    keywords.map((keyword, index) => [`$${(TOK_BASE + index).toString(16).toUpperCase()}`, keyword])
  )
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test('tokens-1.6.json is the file decoded from BIOS v1.6', () => {
  assert.equal(sha256(fixture('tokens-1.6.json').bytes), TOKENS_1_6_SHA256)
})

test('the 1.x table is KeywordTbl at BIOS v1.6', () => {
  assert.deepEqual(asObject(KEYWORDS_1), fixture('tokens-1.6.json').json)
  assert.equal(KEYWORDS, KEYWORDS_1)
  assert.equal(TOK_MAX, 0xd4)
  assert.equal(TOK_REM, 0x8e)
})

test('every 1.x keyword tokenizes alone to its own token', () => {
  KEYWORDS_1.forEach((keyword, index) => {
    const buffer = new Bastok().tokenize(`10 ${keyword}\n`).buffer
    assert.deepEqual([...buffer.subarray(4, buffer.length - 2)], [TOK_BASE + index, 0x00], keyword)
  })
})

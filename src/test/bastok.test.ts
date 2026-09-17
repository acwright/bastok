import { strict as assert } from 'assert'
import { test } from 'node:test'

import { Bastok } from '../Bastok/Bastok'
import { BastokError } from '../Bastok/Errors'
import { PROGRAM_START } from '../Bastok/Tokens'

function tokenize(text: string): Buffer {
  return new Bastok().tokenize(text).buffer
}

function detokenize(buffer: Buffer): string {
  return new Bastok().detokenize(buffer).text
}

test('emits the line layout the BIOS expects', () => {
  const buffer = tokenize('10 PRINT "HI"\n')
  // [next-lo][next-hi][num-lo][num-hi] PRINT "HI" [$00] [$0000]
  assert.deepEqual(
    [...buffer],
    [
      0x0b, 0x08,             // next line -> $080B
      0x0a, 0x00,             // line 10
      0x96,                   // PRINT
      0x20, 0x22, 0x48, 0x49, 0x22, // ` "HI"`
      0x00,                   // end of line
      0x00, 0x00,             // end of program
    ]
  )
})

test('links lines against the load address', () => {
  const buffer = tokenize('10 END\n20 END\n')
  assert.equal(buffer.readUInt16LE(0), PROGRAM_START + 6)
  assert.equal(buffer.readUInt16LE(6), PROGRAM_START + 12)
  assert.equal(buffer.readUInt16LE(12), 0)
})

test('honours a custom load address', () => {
  const bastok = new Bastok()
  bastok.address = 0x1000
  assert.equal(bastok.tokenize('10 END\n').buffer.readUInt16LE(0), 0x1006)
})

test('folds case outside quotes and preserves it inside', () => {
  assert.equal(detokenize(tokenize('10 print "Hello": a=1\n')), '10 PRINT "Hello": A=1\n')
})

test('copies the remainder of a REM verbatim', () => {
  const buffer = tokenize('10 REM print for x\n')
  assert.deepEqual([...buffer.subarray(4, 6)], [0x8e, 0x20])
  assert.equal(buffer.subarray(6, buffer.length - 3).toString('latin1'), 'print for x')
})

test('does not tokenize inside strings', () => {
  const buffer = tokenize('10 PRINT "FOR"\n')
  assert.equal(buffer.indexOf(0x81), -1)
})

test('matches the longest keyword, as BIOS 1.4 and later do', () => {
  // FORMAT ($D4) wins over FOR ($81), though FOR comes first in KeywordTbl.
  const buffer = tokenize('10 FORMAT\n')
  assert.deepEqual([...buffer.subarray(4, buffer.length - 2)], [0xd4, 0x00])
})

test('a shorter keyword still matches when the longer one does not', () => {
  // FORJ=1TO3: FOR ($81) J = 1 TO ($9C) 3
  const buffer = tokenize('10 FORJ=1TO3\n')
  assert.deepEqual(
    [...buffer.subarray(4, buffer.length - 2)],
    [0x81, 0x4a, 0x3d, 0x31, 0x9c, 0x33, 0x00]
  )
  // FORMA is FOR plus the letters MA: FORMAT needs all six letters.
  assert.deepEqual([...tokenize('10 FORMA\n').subarray(4, 8)], [0x81, 0x4d, 0x41, 0x00])
})

test('tokenizes keywords embedded in identifiers, like the interpreter', () => {
  const buffer = tokenize('10 TOTAL=1\n')
  assert.equal(buffer[4], 0x9c) // TO
})

test('stores lines in numeric order regardless of file order', () => {
  const text = detokenize(tokenize('30 END\n10 END\n20 END\n'))
  assert.equal(text, '10 END\n20 END\n30 END\n')
})

test('a later duplicate replaces an earlier line', () => {
  const result = new Bastok().tokenize('10 END\n10 CLS\n')
  assert.equal(detokenize(result.buffer), '10 CLS\n')
  assert.equal(result.warnings.length, 1)
})

test('a bare line number deletes the line', () => {
  assert.equal(detokenize(tokenize('10 END\n20 CLS\n10\n')), '20 CLS\n')
})

test('skips blank lines', () => {
  assert.equal(detokenize(tokenize('\n10 END\n   \n')), '10 END\n')
})

test('round-trips a whole program', () => {
  const source = [
    '10 REM guessing game',
    '20 CLS: N=INT(RND(1)*100)+1',
    '30 PRINT "GUESS 1-100";: INPUT G',
    '40 IF G<N THEN PRINT "HIGHER": GOTO 30',
    '50 IF G>N THEN PRINT "LOWER": GOTO 30',
    '60 PRINT "GOT IT IN"; T; "TRIES"',
    '70 FOR I=1 TO 10: POKE 53280,I: NEXT I',
    '80 END',
    '',
  ].join('\n')
  assert.equal(detokenize(tokenize(source)), source)
})

test('writes and reads a load-address header', () => {
  const bastok = new Bastok()
  bastok.header = true
  bastok.address = 0x2000

  const buffer = bastok.tokenize('10 END\n').buffer
  assert.equal(buffer.readUInt16LE(0), 0x2000)

  const reader = new Bastok()
  reader.header = true
  assert.equal(reader.detokenize(buffer).text, '10 END\n')
  assert.equal(reader.address, 0x2000)
})

test('warns about stale link pointers but still lists', () => {
  const buffer = tokenize('10 END\n')
  buffer.writeUInt16LE(0x9999, 0)
  const result = new Bastok().detokenize(buffer)
  assert.equal(result.text, '10 END\n')
  assert.equal(result.warnings.length, 1)
})

test('renders unknown token bytes as a hex escape', () => {
  const buffer = tokenize('10 END\n')
  buffer[4] = 0xff
  const result = new Bastok().detokenize(buffer)
  assert.equal(result.text, '10 {$FF}\n')
  assert.equal(result.warnings.length, 1)
})

test('detokenizes an empty program', () => {
  assert.equal(detokenize(Buffer.from([0x00, 0x00])), '')
})

test('rejects illegal characters', () => {
  assert.throws(() => tokenize('10 A=B@C\n'), (error: BastokError) => {
    return error instanceof BastokError && /not a legal BASIC character/.test(error.message)
  })
})

test('rejects statements without a line number', () => {
  assert.throws(() => tokenize('PRINT "HI"\n'), /expected a line number/)
})

test('rejects oversized source lines', () => {
  assert.throws(() => tokenize(`10 REM ${'X'.repeat(200)}\n`), /input buffer holds 200/)
})

test('accepts a line right at the input-buffer limit', () => {
  // Crunching never grows a line, so the 200-character input cap is reached
  // before the 250-byte payload cap can be; both limits are enforced anyway.
  const source = `10 REM ${'X'.repeat(193)}`
  assert.equal(source.length, 200)
  assert.equal(detokenize(tokenize(source + '\n')), source + '\n')
})

test('rejects tabs with a helpful message', () => {
  assert.throws(() => tokenize('10\tEND\n'), /a tab at column 3/)
})

test('detects direction from content when the extension is unknown', () => {
  const bastok = new Bastok()
  assert.equal(bastok.outputPathFor('/tmp/game.txt', 'tokenize'), '/tmp/game.prg')
  assert.equal(bastok.outputPathFor('/tmp/game.prg', 'detokenize'), '/tmp/game.txt')
  assert.equal(bastok.outputPathFor('/tmp/game.txt', 'detokenize'), '/tmp/game.out.txt')
})

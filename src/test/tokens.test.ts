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
//
// tokens-2.0.json: a byte-identical copy of 6502-BIOS v2.0:tests/fixtures/tokens.json
//   (commit b185e37ccefcfc2be872ee3a59950d7ee9830bf9), sha256
//   d7e569a6a0bbf8d31d0de38d94c5003e358258b1554e445e5aca7e6b688add61. Its
//   BIOS.bin (sha256 4702fad7d7232b687901d3697eb2450dadcfcc6cd0ee4a8bc6d52f46bba7f8e4)
//   is emulator 3.1.0's assets/roms/BIOS2.bin.

import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { test } from 'node:test'

import { Bastok } from '../Bastok/Bastok'
import {
  Bios,
  KEYWORDS,
  KEYWORDS_1,
  KEYWORDS_2,
  TOK_BASE,
  TOK_MAX,
  TOK_REM,
  keywordForToken,
  keywordsFor,
  tokenMax,
} from '../Bastok/Tokens'

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures')

const TOKENS_1_6_SHA256 = '497ae892f33f04295a0ea89cc09c5e99713b922a62c70900425e225a67d4f6f9'
const TOKENS_2_0_SHA256 = 'd7e569a6a0bbf8d31d0de38d94c5003e358258b1554e445e5aca7e6b688add61'

/** The keywords BIOS 2.0 appends, in order. */
const APPENDED_2 = [
  'VPOKE', 'VREG', 'PALETTE', 'VSYNC', 'VLOAD', 'SPRITE', 'SCROLL', 'LAYER',
  'NVSAVE', 'NVLOAD', 'NVERASE', 'VPEEK', 'VSTAT', 'NVSTAT', 'NVFIND',
]

function bastokFor(bios: Bios): Bastok {
  const bastok = new Bastok()
  bastok.bios = bios
  return bastok
}

/** The payload bytes of a one-line program, without its terminator. */
function payload(line: string, bios: Bios): number[] {
  const buffer = bastokFor(bios).tokenize(`10 ${line}\n`).buffer
  return [...buffer.subarray(4, buffer.length - 3)]
}

const ascii = (text: string) => [...Buffer.from(text, 'latin1')]

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

test('tokens-2.0.json is the BIOS v2.0 fixture', () => {
  assert.equal(sha256(fixture('tokens-2.0.json').bytes), TOKENS_2_0_SHA256)
})

test('the 2.x table is KeywordTbl at BIOS v2.0', () => {
  assert.deepEqual(asObject(KEYWORDS_2), fixture('tokens-2.0.json').json)
})

test('the 2.x table is the 1.x table with SCREEN at $B4, plus $D5-$E3', () => {
  const expected = [...KEYWORDS_1]
  expected[0xb4 - TOK_BASE] = 'SCREEN'
  assert.deepEqual(KEYWORDS_2.slice(0, KEYWORDS_1.length), expected)
  assert.deepEqual(KEYWORDS_2.slice(KEYWORDS_1.length), APPENDED_2)
  assert.equal(tokenMax(1), 0xd4)
  assert.equal(tokenMax(2), 0xe3)
  assert.equal(keywordsFor(1), KEYWORDS_1)
  assert.equal(keywordsFor(2), KEYWORDS_2)
  assert.equal(KEYWORDS_2.indexOf('REM') + TOK_BASE, TOK_REM)
  assert.equal(keywordForToken(0xb4), 'BRK')
  assert.equal(keywordForToken(0xb4, 2), 'SCREEN')
  assert.equal(keywordForToken(0xe3, 2), 'NVFIND')
  assert.equal(keywordForToken(0xd5, 1), undefined)
})

test('every 2.x keyword tokenizes alone to its own token', () => {
  KEYWORDS_2.forEach((keyword, index) => {
    assert.deepEqual(payload(keyword, 2), [TOK_BASE + index], keyword)
  })
})

test('the default BIOS is 1', () => {
  assert.equal(new Bastok().bios, 1)
  assert.deepEqual(payload('VPOKE 1,2', 1), [...new Bastok().tokenize('10 VPOKE 1,2\n').buffer.subarray(4, -3)])
})

test('longest match holds under both tables', () => {
  for (const bios of [1, 2] as Bios[]) {
    assert.deepEqual(payload('FORMAT', bios), [0xd4], `FORMAT, BIOS ${bios}`)
    assert.deepEqual(payload('FORJ=1TO3', bios), [0x81, ...ascii('J=1'), 0x9c, ...ascii('3')])
    assert.deepEqual(payload('TOTAL=1', bios), [0x9c, ...ascii('TAL=1')])
    assert.deepEqual(payload('NVRAM', bios), [0xb1])
    assert.deepEqual(payload('POKE 1,2', bios), [0x95, ...ascii(' 1,2')])
    assert.deepEqual(payload('A=PEEK(1)', bios), [...ascii('A='), 0xc3, ...ascii('(1)')])
  }
})

test('2.x keywords crunch as keywords only under BIOS 2', () => {
  const cases: Array<[string, number[], number[]]> = [
    // source, BIOS 1 payload, BIOS 2 payload
    ['VPOKE 1,2', [0x56, 0x95, ...ascii(' 1,2')], [0xd5, ...ascii(' 1,2')]],
    ['A=VPEEK(1)', [...ascii('A=V'), 0xc3, ...ascii('(1)')], [...ascii('A='), 0xe0, ...ascii('(1)')]],
    ['NVSAVE 3', [...ascii('NV'), 0x93, ...ascii(' 3')], [0xdd, ...ascii(' 3')]],
    ['XVLOAD=1', [...ascii('XV'), 0x92, ...ascii('=1')], [...ascii('X'), 0xd9, ...ascii('=1')]],
    ['ONSCREEN', [0x90, ...ascii('SCREEN')], [0x90, 0xb4]],
    ['SCREEN 0', [...ascii('SCREEN 0')], [0xb4, ...ascii(' 0')]],
    ['SCROLL 1', [...ascii('SCROLL 1')], [0xdb, ...ascii(' 1')]],
    ['BRK', [0xb4], [...ascii('BRK')]],
  ]
  for (const [source, one, two] of cases) {
    assert.deepEqual(payload(source, 1), one, `${source}, BIOS 1`)
    assert.deepEqual(payload(source, 2), two, `${source}, BIOS 2`)
  }
})

test('$B4 lists as BRK under BIOS 1 and SCREEN under BIOS 2', () => {
  const image = new Bastok().tokenize('10 BRK\n').buffer
  assert.equal(bastokFor(1).detokenize(image).text, '10 BRK\n')
  assert.equal(bastokFor(2).detokenize(image).text, '10 SCREEN\n')
})

test('$D5 is an unknown token under BIOS 1 and VPOKE under BIOS 2', () => {
  const image = bastokFor(2).tokenize('10 VPOKE 1,2\n').buffer
  const one = bastokFor(1).detokenize(image)
  assert.equal(one.text, '10 {$D5} 1,2\n')
  assert.ok(one.warnings.some(warning => /\$D5 is not a known token/.test(warning)))
  const two = bastokFor(2).detokenize(image)
  assert.equal(two.text, '10 VPOKE 1,2\n')
  assert.deepEqual(two.warnings, [])
})

const GUESS = [
  '10 REM guessing game',
  '20 CLS: N=INT(RND(1)*100)+1',
  '30 PRINT "GUESS 1-100";: INPUT G',
  '40 IF G<N THEN PRINT "HIGHER": GOTO 30',
  '50 IF G>N THEN PRINT "LOWER": GOTO 30',
  '60 PRINT "GOT IT IN"; T; "TRIES"',
  '70 FOR I=1 TO 10: POKE 53280,I: NEXT I',
  '80 FORMAT',
  '',
].join('\n')

const PROGRAM_2 = [
  '10 SCREEN 2: LAYER 1,1: PALETTE 1,255,0,0',
  '20 VPOKE 4096,65: A=VPEEK(4096): VREG 7,17',
  '30 VSYNC: VLOAD "TILES.BIN",0: SPRITE 0,10,20,1',
  '40 SCROLL 1,8,0: S=VSTAT(0)',
  '50 NVSAVE "HI",A: NVLOAD "HI",A: NVERASE "HI"',
  '60 N=NVSTAT(0): F=NVFIND("HI")',
  '',
].join('\n')

test('round-trips a whole program under each table', () => {
  for (const bios of [1, 2] as Bios[]) {
    const bastok = bastokFor(bios)
    assert.equal(bastok.detokenize(bastok.tokenize(GUESS).buffer).text, GUESS, `BIOS ${bios}`)
  }
  const bastok = bastokFor(2)
  const image = bastok.tokenize(PROGRAM_2).buffer
  assert.equal(bastok.detokenize(image).text, PROGRAM_2)
  for (const keyword of ['SCREEN', ...APPENDED_2]) {
    assert.ok(image.includes(TOK_BASE + KEYWORDS_2.indexOf(keyword)), keyword)
  }
})

test('hints: BIOS 1 tokenizing warns about lines holding 2.x keywords', () => {
  const result = bastokFor(1).tokenize('10 VPOKE 1,2\n20 PRINT "VPOKE"\n30 BRK\n40 ONSCREEN\n50 NVRAM\n')
  assert.deepEqual(result.warnings, [
    'source line 1: line 10 crunches differently on BIOS 2.x (VPOKE); use --bios 2 for a 2.x machine',
    'source line 4: line 40 crunches differently on BIOS 2.x (SCREEN); use --bios 2 for a 2.x machine',
  ])
})

test('hints: BIOS 2 tokenizing warns about BRK only', () => {
  const result = bastokFor(2).tokenize('10 VPOKE 1,2\n20 X=1:BRK\n30 PRINT "BRK"\n40 REM BRK\n50 SCREEN 0\n')
  assert.deepEqual(result.warnings, ['source line 2: line 20: BRK is not a keyword on BIOS 2.x'])
})

test('hints: BIOS 1 listing says to try --bios 2 once for $D5-$E3', () => {
  const image = bastokFor(2).tokenize('10 VPOKE 1,2\n20 NVFIND 1\n').buffer
  const { warnings } = bastokFor(1).detokenize(image)
  assert.equal(warnings.length, 3)
  assert.equal(warnings[2], '$D5-$E3 are BIOS 2.x tokens; try --bios 2')
})

test('hints: BIOS 2 listing flags a bare SCREEN, which was BRK on 1.x', () => {
  const image = bastokFor(1).tokenize('10 BRK\n20 X=1:BRK :Y=2\n30 SCREEN 0\n').buffer
  const two = bastokFor(2).detokenize(image)
  assert.deepEqual(two.warnings, [
    'line 10: bare SCREEN; if this program is from BIOS 1.x, it was BRK',
    'line 20: bare SCREEN; if this program is from BIOS 1.x, it was BRK',
  ])
  const one = bastokFor(1).detokenize(bastokFor(1).tokenize(GUESS).buffer)
  assert.deepEqual(one.warnings, [])
  const clean = bastokFor(2).detokenize(bastokFor(2).tokenize(PROGRAM_2).buffer)
  assert.deepEqual(clean.warnings, [])
})

test('hints: an ordinary 1.x program tokenizes without warnings under either table', () => {
  assert.deepEqual(bastokFor(1).tokenize(GUESS).warnings, [])
  assert.deepEqual(bastokFor(2).tokenize(GUESS).warnings, [])
  assert.deepEqual(bastokFor(2).tokenize(PROGRAM_2).warnings, [])
})

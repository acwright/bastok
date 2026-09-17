// =============================================================================
//   T O K E N   T A B L E
//
//   Transcribed from KeywordTbl in 6502-BIOS/BASIC.asm, once for BIOS 1.x (tag
//   v1.6) and once for BIOS 2.x (tag v2.0.1).  Order is significant:
//   the token byte is TOK_BASE + (index in this array), so reordering changes
//   the token values. The interpreter's keyword matcher walks the whole table
//   and takes the LONGEST match (BIOS 1.4 and later).
// =============================================================================

/** First token byte. Keywords are numbered sequentially from here. */
export const TOK_BASE = 0x80

/**
 * BIOS 1.x keywords in table order: KeywordTbl at 6502-BIOS tag v1.6, the
 * last 1.x release, so this table is final. Pinned by
 * src/test/fixtures/tokens-1.6.json.
 */
export const KEYWORDS_1: readonly string[] = [
  // Statements
  'END',      // $80
  'FOR',      // $81
  'NEXT',     // $82
  'DATA',     // $83
  'INPUT',    // $84
  'DIM',      // $85
  'READ',     // $86
  'LET',      // $87
  'GOTO',     // $88
  'RUN',      // $89
  'IF',       // $8A
  'RESTORE',  // $8B
  'GOSUB',    // $8C
  'RETURN',   // $8D
  'REM',      // $8E
  'STOP',     // $8F
  'ON',       // $90
  'WAIT',     // $91
  'LOAD',     // $92
  'SAVE',     // $93
  'DEF',      // $94
  'POKE',     // $95
  'PRINT',    // $96
  'CONT',     // $97
  'LIST',     // $98
  'CLR',      // $99
  'NEW',      // $9A
  'TAB',      // $9B
  'TO',       // $9C
  'FN',       // $9D
  'SPC',      // $9E
  'THEN',     // $9F
  'NOT',      // $A0
  'STEP',     // $A1
  'AND',      // $A2
  'OR',       // $A3
  'ELSE',     // $A4
  'SYS',      // $A5
  'DIR',      // $A6
  'DEL',      // $A7
  'CLS',      // $A8
  'LOCATE',   // $A9
  'COLOR',    // $AA
  'SOUND',    // $AB
  'VOL',      // $AC
  'TIME',     // $AD
  'DATE',     // $AE
  'SETTIME',  // $AF
  'SETDATE',  // $B0
  'NVRAM',    // $B1
  'PAUSE',    // $B2
  'BANK',     // $B3
  'BRK',      // $B4
  'MEM',      // $B5
  // Functions
  'SGN',      // $B6
  'INT',      // $B7
  'ABS',      // $B8
  'FRE',      // $B9
  'POS',      // $BA
  'SQR',      // $BB
  'RND',      // $BC
  'LOG',      // $BD
  'EXP',      // $BE
  'COS',      // $BF
  'SIN',      // $C0
  'TAN',      // $C1
  'ATN',      // $C2
  'PEEK',     // $C3
  'LEN',      // $C4
  'STR$',     // $C5
  'VAL',      // $C6
  'ASC',      // $C7
  'CHR$',     // $C8
  'LEFT$',    // $C9
  'RIGHT$',   // $CA
  'MID$',     // $CB
  'JOY',      // $CC
  'INKEY',    // $CD
  'HEX',      // $CE
  'MIN',      // $CF
  'MAX',      // $D0
  'DISK',     // $D1
  'BLOAD',    // $D2
  'BSAVE',    // $D3
  'FORMAT',   // $D4
]

/**
 * BIOS 2.x keywords in table order: KeywordTbl at 6502-BIOS tag v2.0.1. The 1.x
 * table with $B4 BRK replaced by SCREEN, plus $D5-$E3. Pinned by
 * src/test/fixtures/tokens-2.0.json, a copy of the BIOS's own
 * tests/fixtures/tokens.json at v2.0.1 — unchanged from v2.0, which is why the
 * fixture keeps its name.
 */
export const KEYWORDS_2: readonly string[] = [
  // Statements
  'END',      // $80
  'FOR',      // $81
  'NEXT',     // $82
  'DATA',     // $83
  'INPUT',    // $84
  'DIM',      // $85
  'READ',     // $86
  'LET',      // $87
  'GOTO',     // $88
  'RUN',      // $89
  'IF',       // $8A
  'RESTORE',  // $8B
  'GOSUB',    // $8C
  'RETURN',   // $8D
  'REM',      // $8E
  'STOP',     // $8F
  'ON',       // $90
  'WAIT',     // $91
  'LOAD',     // $92
  'SAVE',     // $93
  'DEF',      // $94
  'POKE',     // $95
  'PRINT',    // $96
  'CONT',     // $97
  'LIST',     // $98
  'CLR',      // $99
  'NEW',      // $9A
  'TAB',      // $9B
  'TO',       // $9C
  'FN',       // $9D
  'SPC',      // $9E
  'THEN',     // $9F
  'NOT',      // $A0
  'STEP',     // $A1
  'AND',      // $A2
  'OR',       // $A3
  'ELSE',     // $A4
  'SYS',      // $A5
  'DIR',      // $A6
  'DEL',      // $A7
  'CLS',      // $A8
  'LOCATE',   // $A9
  'COLOR',    // $AA
  'SOUND',    // $AB
  'VOL',      // $AC
  'TIME',     // $AD
  'DATE',     // $AE
  'SETTIME',  // $AF
  'SETDATE',  // $B0
  'NVRAM',    // $B1
  'PAUSE',    // $B2
  'BANK',     // $B3
  'SCREEN',   // $B4
  'MEM',      // $B5
  // Functions
  'SGN',      // $B6
  'INT',      // $B7
  'ABS',      // $B8
  'FRE',      // $B9
  'POS',      // $BA
  'SQR',      // $BB
  'RND',      // $BC
  'LOG',      // $BD
  'EXP',      // $BE
  'COS',      // $BF
  'SIN',      // $C0
  'TAN',      // $C1
  'ATN',      // $C2
  'PEEK',     // $C3
  'LEN',      // $C4
  'STR$',     // $C5
  'VAL',      // $C6
  'ASC',      // $C7
  'CHR$',     // $C8
  'LEFT$',    // $C9
  'RIGHT$',   // $CA
  'MID$',     // $CB
  'JOY',      // $CC
  'INKEY',    // $CD
  'HEX',      // $CE
  'MIN',      // $CF
  'MAX',      // $D0
  'DISK',     // $D1
  'BLOAD',    // $D2
  'BSAVE',    // $D3
  'FORMAT',   // $D4
  // BIOS 2.x
  'VPOKE',    // $D5
  'VREG',     // $D6
  'PALETTE',  // $D7
  'VSYNC',    // $D8
  'VLOAD',    // $D9
  'SPRITE',   // $DA
  'SCROLL',   // $DB
  'LAYER',    // $DC
  'NVSAVE',   // $DD
  'NVLOAD',   // $DE
  'NVERASE',  // $DF
  'VPEEK',    // $E0
  'VSTAT',    // $E1
  'NVSTAT',   // $E2
  'NVFIND',   // $E3
]

/** The BIOS 1.x table, under its 1.0.0 name. */
export const KEYWORDS: readonly string[] = KEYWORDS_1

/** Highest valid BIOS 1.x token byte ($D4). */
export const TOK_MAX = TOK_BASE + KEYWORDS_1.length - 1

/** $B4: BRK on BIOS 1.x, SCREEN on BIOS 2.x. The one token whose keyword changed. */
export const TOK_BRK_SCREEN = 0xb4

/** REM ($8E, in both tables) — everything after it on a line is copied verbatim. */
export const TOK_REM = TOK_BASE + KEYWORDS_1.indexOf('REM')

/** The BIOS a program image is for: 1 (1.x, e.g. 1.6) or 2 (2.x). */
export type Bios = 1 | 2

/** The keyword table for a BIOS. */
export function keywordsFor(bios: Bios = 1): readonly string[] {
  return bios === 2 ? KEYWORDS_2 : KEYWORDS_1
}

/** Highest valid token byte for a BIOS: $D4 on 1.x, $E3 on 2.x. */
export function tokenMax(bios: Bios = 1): number {
  return TOK_BASE + keywordsFor(bios).length - 1
}

/** Keyword text for a token byte, or undefined if the byte is not a token. */
export function keywordForToken(token: number, bios: Bios = 1): string | undefined {
  return keywordsFor(bios)[token - TOK_BASE]
}

/** Default program load address (PROGRAM_START in BIOS.inc). */
export const PROGRAM_START = 0x0800

/** Top of the program area; programs must end at or below this. */
export const PROGRAM_LIMIT = 0x8000

/** BAS_LINBUF_MAX — maximum accepted raw input line length. */
export const LINBUF_MAX = 200

/** BAS_TOKBUF_MAX — maximum tokenized payload bytes per line. */
export const TOKBUF_MAX = 250

/** Highest representable line number. */
export const LINENUM_MAX = 0xffff

/**
 * Characters BasValidPunct rejects. Everything else in $20-$7E is accepted
 * verbatim outside of quotes.
 */
export const ILLEGAL_CHARS = '@&[]{}|\\`~'

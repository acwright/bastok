// =============================================================================
//   T O K E N   T A B L E
//
//   Transcribed from KeywordTbl in 6502-BIOS/BASIC.asm.  Order is significant:
//   the token byte is TOK_BASE + (index in this array), so reordering changes
//   the token values. The interpreter's keyword matcher walks the whole table
//   and takes the LONGEST match (BIOS 1.4 and later).
// =============================================================================

/** First token byte. Keywords are numbered sequentially from here. */
export const TOK_BASE = 0x80

/** Keywords in table order. KEEP IN SYNC WITH BASIC.asm. */
export const KEYWORDS: readonly string[] = [
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

/** Highest valid token byte. */
export const TOK_MAX = TOK_BASE + KEYWORDS.length - 1

/** REM ($8E) — everything after it on a line is copied verbatim. */
export const TOK_REM = TOK_BASE + KEYWORDS.indexOf('REM')

/** Keyword text for a token byte, or undefined if the byte is not a token. */
export function keywordForToken(token: number): string | undefined {
  return KEYWORDS[token - TOK_BASE]
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

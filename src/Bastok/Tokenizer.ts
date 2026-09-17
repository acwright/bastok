import { BastokError } from './Errors'
import {
  Bios,
  ILLEGAL_CHARS,
  LINBUF_MAX,
  LINENUM_MAX,
  PROGRAM_LIMIT,
  PROGRAM_START,
  TOKBUF_MAX,
  TOK_BASE,
  TOK_REM,
  keywordsFor,
} from './Tokens'

/** A stored program line: number plus its tokenized payload (no terminator). */
interface ProgramLine {
  number: number
  payload: number[]
}

export interface TokenizeResult {
  /** The program image, ready to write as .prg / .bas. */
  buffer: Buffer
  /** Non-fatal notes (replaced lines, deletions, memory overrun). */
  warnings: string[]
}

/**
 * Converts BASIC source text into a tokenized program image.
 *
 * This is a port of BasProcessLine / BasCrunch / BasMatchKeyword / BasStoreLine
 * from 6502-BIOS/BASIC.asm, and deliberately reproduces the interpreter's
 * behaviour rather than improving on it -- including longest-match keyword
 * matching that still tokenizes keywords embedded in longer identifiers.
 */
export class Tokenizer {

  /** Load address the program image is linked for. */
  address: number = PROGRAM_START

  /** BIOS whose keyword table is used: 1 (1.x) or 2 (2.x). */
  bios: Bios = 1

  tokenize(text: string): TokenizeResult {
    const warnings: string[] = []
    const lines: ProgramLine[] = []
    const rawLines = text.split(/\r\n|\r|\n/)

    rawLines.forEach((raw, index) => {
      const sourceLine = index + 1
      this.validateRaw(raw, sourceLine)

      // BasProcessLine: skip leading spaces; an all-space line does nothing.
      let x = 0
      while (raw[x] === ' ') { x++ }
      if (x >= raw.length) { return }

      if (raw[x] < '0' || raw[x] > '9') {
        throw new BastokError(
          `expected a line number, found "${raw.trim().slice(0, 20)}" ` +
          '(immediate-mode statements cannot be stored in a program)',
          sourceLine
        )
      }

      // Parse the line number, then allow exactly one optional space before
      // the statement text.
      const start = x
      while (raw[x] >= '0' && raw[x] <= '9') { x++ }
      const number = parseInt(raw.slice(start, x), 10)
      if (number > LINENUM_MAX) {
        throw new BastokError(`line number ${number} exceeds ${LINENUM_MAX}`, sourceLine)
      }
      if (raw[x] === ' ') { x++ }

      const payload = this.crunch(raw, x, sourceLine)
      this.store(lines, number, payload, sourceLine, warnings)
    })

    return { buffer: this.link(lines, warnings), warnings }
  }

  // ---------------------------------------------------------------------------

  /**
   * Enforce the limits BasReadLine imposes on typed input. The interpreter
   * silently drops what it cannot hold; we report it instead.
   */
  private validateRaw(raw: string, sourceLine: number): void {
    if (raw.length > LINBUF_MAX) {
      throw new BastokError(
        `line is ${raw.length} characters; the input buffer holds ${LINBUF_MAX}`,
        sourceLine
      )
    }
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i)
      if (code < 0x20 || code > 0x7e) {
        const shown = code === 0x09 ? 'a tab' : `character code $${this.hex(code)}`
        throw new BastokError(
          `${shown} at column ${i + 1} cannot be typed into BASIC ` +
          '(only printable ASCII $20-$7E is accepted)',
          sourceLine
        )
      }
    }
  }

  /**
   * BasCrunch: tokenize raw[x..] into a payload byte array.
   *
   *   - Outside quotes, a-z fold to uppercase.
   *   - Outside quotes, alphabetic runs are matched against the keyword table.
   *   - Inside double quotes, characters are copied verbatim to the closing
   *     quote or end of line.
   *   - After a REM token the remainder of the line is copied verbatim.
   *   - Illegal punctuation is a syntax error.
   */
  private crunch(raw: string, from: number, sourceLine: number): number[] {
    const dst: number[] = []
    let x = from

    const emit = (byte: number) => {
      if (dst.length >= TOKBUF_MAX) {
        throw new BastokError(
          `tokenized line exceeds ${TOKBUF_MAX} bytes`,
          sourceLine
        )
      }
      dst.push(byte)
    }

    while (x < raw.length) {
      const char = raw[x]

      if (char === '"') {
        // Copy the opening quote and everything up to the closing quote.
        emit(0x22)
        x++
        while (x < raw.length) {
          const inner = raw.charCodeAt(x)
          emit(inner)
          x++
          if (inner === 0x22) { break }
        }
        continue
      }

      const upper = char >= 'a' && char <= 'z' ? char.toUpperCase() : char

      if (upper >= 'A' && upper <= 'Z') {
        const match = this.matchKeyword(raw, x)
        if (match) {
          emit(match.token)
          x = match.next
          if (match.token === TOK_REM) {
            // Remainder of the line is copied verbatim -- no folding, no
            // keyword matching, no punctuation check.
            while (x < raw.length) {
              emit(raw.charCodeAt(x))
              x++
            }
            break
          }
          continue
        }
        emit(upper.charCodeAt(0))
        x++
        continue
      }

      // Punctuation, digit or space.
      if (ILLEGAL_CHARS.includes(char)) {
        throw new BastokError(
          `"${char}" at column ${x + 1} is not a legal BASIC character`,
          sourceLine
        )
      }
      emit(char.charCodeAt(0))
      x++
    }

    return dst
  }

  /**
   * BasMatchKeyword: walk the whole keyword table and take the LONGEST keyword
   * that matches at raw[x], as BIOS 1.4 and later do. "FORMAT" is FORMAT ($D4),
   * not FOR ($81) followed by the letters MAT. A keyword is still matched when
   * it is only the start of a longer name, so "TOTAL" is TO ($9C) plus TAL.
   */
  private matchKeyword(raw: string, x: number): { token: number, next: number } | null {
    const keywords = keywordsFor(this.bios)
    let best: { token: number, next: number } | null = null
    for (let index = 0; index < keywords.length; index++) {
      const keyword = keywords[index]
      if (best !== null && keyword.length <= best.next - x) { continue }
      let matched = true
      for (let i = 0; i < keyword.length; i++) {
        const char = raw[x + i]
        if (char === undefined) { matched = false; break }
        const upper = char >= 'a' && char <= 'z' ? char.toUpperCase() : char
        if (upper !== keyword[i]) { matched = false; break }
      }
      if (matched) {
        best = { token: TOK_BASE + index, next: x + keyword.length }
      }
    }
    return best
  }

  /**
   * BasStoreLine: insert in line-number order, replacing an existing line with
   * the same number. An empty payload deletes the line.
   */
  private store(
    lines: ProgramLine[],
    number: number,
    payload: number[],
    sourceLine: number,
    warnings: string[]
  ): void {
    let at = lines.findIndex(line => line.number >= number)
    if (at < 0) { at = lines.length }

    const exists = lines[at] !== undefined && lines[at].number === number
    if (exists) {
      lines.splice(at, 1)
      warnings.push(
        payload.length === 0
          ? `source line ${sourceLine}: deleted line ${number}`
          : `source line ${sourceLine}: line ${number} replaces an earlier definition`
      )
    } else if (payload.length === 0) {
      warnings.push(
        `source line ${sourceLine}: line ${number} is empty and no such line exists; ignored`
      )
    }

    if (payload.length > 0) {
      lines.splice(at, 0, { number, payload })
    }
  }

  /**
   * Emit [next-lo][next-hi][num-lo][num-hi][payload][$00] per line, ending
   * with a $0000 next-pointer. Matches what SAVE writes: the image starts at
   * the load address with no header and includes the two-byte terminator.
   */
  private link(lines: ProgramLine[], warnings: string[]): Buffer {
    const size = lines.reduce((total, line) => total + line.payload.length + 5, 0) + 2
    const buffer = Buffer.alloc(size)

    let offset = 0
    for (const line of lines) {
      const next = this.address + offset + line.payload.length + 5
      buffer.writeUInt16LE(next & 0xffff, offset)
      buffer.writeUInt16LE(line.number, offset + 2)
      for (let i = 0; i < line.payload.length; i++) {
        buffer[offset + 4 + i] = line.payload[i]
      }
      buffer[offset + 4 + line.payload.length] = 0x00
      offset += line.payload.length + 5
    }
    // Terminator: a next-pointer of $0000. Buffer.alloc already zeroed it.

    const end = this.address + size
    if (end > PROGRAM_LIMIT) {
      warnings.push(
        `program ends at $${this.hex(end, 4)}, past the top of program RAM ` +
        `($${this.hex(PROGRAM_LIMIT, 4)})`
      )
    }
    return buffer
  }

  private hex(value: number, width: number = 2): string {
    return value.toString(16).toUpperCase().padStart(width, '0')
  }

}

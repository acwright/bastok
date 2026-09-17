import { BastokError } from './Errors'
import { Bios, PROGRAM_START, TOK_BASE, keywordForToken } from './Tokens'

export interface DetokenizeResult {
  /** The listing, one line per program line. */
  text: string
  /** Non-fatal notes (bad link pointers, unknown tokens, truncated image). */
  warnings: string[]
}

/**
 * Converts a tokenized program image back into BASIC source text.
 *
 * This is a port of BasCmdList / BasPrintKeyword from 6502-BIOS/BASIC.asm:
 * decimal line number, one space, then the payload with token bytes expanded
 * to their keywords.
 *
 * Lines are walked sequentially (header, then bytes up to the NUL terminator)
 * rather than by following next-pointers, so an image whose links are stale --
 * which is legal, since LOAD relinks via BasFixChain -- still lists correctly.
 * Pointers that disagree with the sequential layout are reported as warnings.
 */
export class Detokenizer {

  /** Load address the image is linked for; only used to check next-pointers. */
  address: number = PROGRAM_START

  /** BIOS whose keyword table is used: 1 (1.x) or 2 (2.x). */
  bios: Bios = 1

  /** Line ending for the emitted listing. */
  eol: string = '\n'

  detokenize(buffer: Buffer): DetokenizeResult {
    const warnings: string[] = []
    const lines: string[] = []
    let offset = 0

    while (true) {
      if (offset + 2 > buffer.length) {
        warnings.push(
          `image ends at offset ${offset} without a $0000 end-of-program marker`
        )
        break
      }

      const next = buffer.readUInt16LE(offset)
      // BasCmdList treats a zero high byte as the end-of-program marker.
      if ((next & 0xff00) === 0) { break }

      if (offset + 4 > buffer.length) {
        warnings.push(`line header at offset ${offset} is truncated`)
        break
      }
      const number = buffer.readUInt16LE(offset + 2)

      let end = offset + 4
      while (end < buffer.length && buffer[end] !== 0x00) { end++ }
      if (end >= buffer.length) {
        warnings.push(`line ${number} is not terminated; image is truncated`)
        break
      }

      lines.push(`${number} ${this.expand(buffer, offset + 4, end, number, warnings)}`)

      const expected = this.address + end + 1
      if (next !== (expected & 0xffff)) {
        warnings.push(
          `line ${number} links to $${this.hex(next, 4)} but the next line is at ` +
          `$${this.hex(expected & 0xffff, 4)} (LOAD relinks, so this is harmless)`
        )
      }
      offset = end + 1
    }

    if (lines.length === 0 && buffer.length > 2) {
      throw new BastokError(
        'no BASIC lines found; the file does not look like a tokenized program ' +
        '(use --address if it was linked for a different load address)'
      )
    }

    return {
      text: lines.length > 0 ? lines.join(this.eol) + this.eol : '',
      warnings,
    }
  }

  // ---------------------------------------------------------------------------

  /** Expand one line's payload, turning token bytes back into keywords. */
  private expand(
    buffer: Buffer,
    from: number,
    to: number,
    number: number,
    warnings: string[]
  ): string {
    let out = ''
    for (let i = from; i < to; i++) {
      const byte = buffer[i]
      if (byte < TOK_BASE) {
        out += String.fromCharCode(byte)
        continue
      }
      const keyword = keywordForToken(byte, this.bios)
      if (keyword === undefined) {
        out += `{$${this.hex(byte)}}`
        warnings.push(
          `line ${number}: $${this.hex(byte)} is not a known token; emitted as ` +
          `{$${this.hex(byte)}}, which will not tokenize back`
        )
        continue
      }
      out += keyword
    }
    return out
  }

  private hex(value: number, width: number = 2): string {
    return value.toString(16).toUpperCase().padStart(width, '0')
  }

}

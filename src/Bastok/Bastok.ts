import * as fs from 'fs'
import * as path from 'path'

import { BastokError } from './Errors'
import { Detokenizer, DetokenizeResult } from './Detokenizer'
import { Tokenizer, TokenizeResult } from './Tokenizer'
import { KEYWORDS, PROGRAM_START, TOK_BASE } from './Tokens'

export type Mode = 'tokenize' | 'detokenize'

/** Extensions that hold a tokenized program image. */
const BINARY_EXTENSIONS = ['.prg', '.bas']

/** Extensions that hold BASIC source text. */
const TEXT_EXTENSIONS = ['.txt', '.asc', '.bs']

/**
 * File-level facade over the tokenizer and detokenizer: direction detection,
 * the optional two-byte load-address header, and reading / writing.
 */
export class Bastok {

  /** Load address the program image is linked for. */
  address: number = PROGRAM_START

  /**
   * Read or write a two-byte little-endian load address ahead of the image.
   * The BIOS SAVE command does not write one; this is for interoperating with
   * tools that expect the Commodore .prg convention.
   */
  header: boolean = false

  /** Line ending used when emitting a listing. */
  eol: string = '\n'

  // ---------------------------------------------------------------------------
  //   T O K E N I Z E
  // ---------------------------------------------------------------------------

  /** Tokenize BASIC source text into a program image. */
  tokenize(text: string): TokenizeResult {
    const tokenizer = new Tokenizer()
    tokenizer.address = this.address

    const result = tokenizer.tokenize(text)
    if (!this.header) { return result }

    const prefix = Buffer.alloc(2)
    prefix.writeUInt16LE(this.address & 0xffff, 0)
    return { ...result, buffer: Buffer.concat([prefix, result.buffer]) }
  }

  /** Tokenize a source file into a program image. */
  tokenizeFile(file: string): TokenizeResult {
    return this.tokenize(this.read(file).toString('latin1'))
  }

  // ---------------------------------------------------------------------------
  //   D E T O K E N I Z E
  // ---------------------------------------------------------------------------

  /** Detokenize a program image into BASIC source text. */
  detokenize(buffer: Buffer): DetokenizeResult {
    let image = buffer

    if (this.header) {
      if (buffer.length < 2) {
        throw new BastokError('file is too short to contain a load-address header')
      }
      this.address = buffer.readUInt16LE(0)
      image = buffer.subarray(2)
    }

    const detokenizer = new Detokenizer()
    detokenizer.address = this.address
    detokenizer.eol = this.eol

    return detokenizer.detokenize(image)
  }

  /** Detokenize a program file into BASIC source text. */
  detokenizeFile(file: string): DetokenizeResult {
    return this.detokenize(this.read(file))
  }

  // ---------------------------------------------------------------------------
  //   H E L P E R S
  // ---------------------------------------------------------------------------

  /**
   * Decide which direction to convert in, from the file extension and -- when
   * the extension is unfamiliar -- from whether the contents are printable.
   */
  detectMode(file: string): Mode {
    const extension = path.extname(file).toLowerCase()
    if (BINARY_EXTENSIONS.includes(extension)) { return 'detokenize' }
    if (TEXT_EXTENSIONS.includes(extension)) { return 'tokenize' }

    const buffer = this.read(file)
    const sample = buffer.subarray(0, 512)
    for (const byte of sample) {
      const printable = byte >= 0x20 && byte <= 0x7e
      const whitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d
      if (!printable && !whitespace) { return 'detokenize' }
    }
    return 'tokenize'
  }

  /** Default output path for a conversion: swap in the matching extension. */
  outputPathFor(file: string, mode: Mode): string {
    const extension = mode === 'tokenize' ? '.prg' : '.txt'
    const base = path.join(path.dirname(file), path.basename(file, path.extname(file)))
    const candidate = base + extension
    return candidate === file ? base + '.out' + extension : candidate
  }

  /** The token table, formatted for display. */
  tokenTable(): string {
    return KEYWORDS
      .map((keyword, index) => {
        const token = (TOK_BASE + index).toString(16).toUpperCase()
        return `$${token}  ${keyword}`
      })
      .join('\n')
  }

  private read(file: string): Buffer {
    try {
      return fs.readFileSync(file)
    } catch (error) {
      const reason = (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'no such file'
        : (error as Error).message
      throw new BastokError(`cannot read ${file}: ${reason}`)
    }
  }

}

export { BastokError } from './Errors'
export { Detokenizer, DetokenizeResult } from './Detokenizer'
export { Tokenizer, TokenizeResult } from './Tokenizer'
export * from './Tokens'

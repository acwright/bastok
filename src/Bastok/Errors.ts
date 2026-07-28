/** An error the user can act on: bad syntax, oversized line, corrupt image. */
export class BastokError extends Error {

  /** 1-based line number within the source text, when known. */
  sourceLine?: number

  constructor(message: string, sourceLine?: number) {
    super(sourceLine === undefined ? message : `line ${sourceLine}: ${message}`)
    this.name = 'BastokError'
    this.sourceLine = sourceLine
  }

}

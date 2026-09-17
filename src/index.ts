#! /usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import figlet from 'figlet'
import { Command, InvalidArgumentError } from 'commander'
import { Bastok, BastokError, Mode } from './Bastok/Bastok'

const VERSION: string = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
).version

const bastok = new Bastok()

function parseHex(value: string) {
  const prefixedHexString = value.startsWith('0x') ? value : `0x${value}`
  const parsedValue = parseInt(prefixedHexString, 16)
  if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 0xffff) {
    throw new InvalidArgumentError('Address not valid')
  }
  return prefixedHexString
}

function parseBios(value: string) {
  if (value !== '1' && value !== '2') {
    throw new InvalidArgumentError('BIOS must be 1 or 2')
  }
  return Number(value)
}

const program = new Command()
program.showHelpAfterError()
program
  .name('bastok')
  .description(
    'A utility for converting BASIC source text to tokenized program images\n' +
    '(.prg / .bas) for the AC6502 BIOS, and back again.'
  )
  .version(VERSION, '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Output help / options')
  .option('-t, --tokenize', 'Force text -> tokenized binary')
  .option('-d, --detokenize', 'Force tokenized binary -> text')
  .option('-o, --output <path>', 'Output file, or - for stdout')
  .option('-a, --address <address>', 'Program load address in hex', parseHex, '0x0800')
  .option('-H, --header', 'Read / write a 2-byte load address header', false)
  .option('-c, --crlf', 'Emit CRLF line endings when detokenizing', false)
  .option('-q, --quiet', 'Suppress warnings and the summary line', false)
  .option('-b, --bios <1|2>', 'BIOS the image is for: 1 (1.x, e.g. 1.6) or 2 (2.x)', parseBios, 1)
  .option('-T, --tokens', 'Print the token table and exit', false)
  .argument('[path]', 'Path to the file to convert')
  .addHelpText('beforeAll', figlet.textSync('bastok') + '\n' + `Version: ${VERSION} | A.C. Wright Design\n`)
  .addHelpText('after', `
Examples:
  bastok game.txt                 Tokenize to game.prg
  bastok game.prg                 Detokenize to game.txt
  bastok -o - game.prg            List game.prg to stdout
  bastok -t -o out.bas game.txt   Tokenize to out.bas
  bastok -b 2 game.txt            Tokenize for BIOS 2.x
  bastok --tokens                 Show the token table
  bastok -T -b 2                  Show the BIOS 2.x token table`)
  .parse(process.argv)

const options = program.opts()
bastok.bios = options.bios

if (options.tokens) {
  console.log(bastok.tokenTable())
  process.exit(0)
}

const input = program.args[0]
if (!input) {
  program.error("error: missing required argument 'path'")
}

if (options.tokenize && options.detokenize) {
  program.error('error: --tokenize and --detokenize are mutually exclusive')
}

bastok.address = parseInt(options.address, 16)
bastok.header = options.header
bastok.eol = options.crlf ? '\r\n' : '\n'

function warn(message: string) {
  if (!options.quiet) { console.error(message) }
}

try {
  const mode: Mode = options.tokenize
    ? 'tokenize'
    : options.detokenize
      ? 'detokenize'
      : bastok.detectMode(input)

  const result = mode === 'tokenize'
    ? bastok.tokenizeFile(input)
    : bastok.detokenizeFile(input)

  result.warnings.forEach(message => warn(`bastok: warning: ${message}`))

  const payload = mode === 'tokenize'
    ? (result as { buffer: Buffer }).buffer
    : Buffer.from((result as { text: string }).text, 'latin1')

  const output = options.output ?? bastok.outputPathFor(input, mode)
  if (output === '-') {
    process.stdout.write(payload)
  } else {
    fs.writeFileSync(output, payload)
    warn(`bastok: wrote ${payload.length} bytes to ${output}`)
  }
} catch (error) {
  if (error instanceof BastokError) {
    console.error(`bastok: ${error.message}`)
    process.exit(1)
  }
  throw error
}

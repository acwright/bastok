bastok
======

```
  _               _        _    
 | |__   __ _ ___| |_ ___ | | __
 | '_ \ / _` / __| __/ _ \| |/ /
 | |_) | (_| \__ \ || (_) |   < 
 |_.__/ \__,_|___/\__\___/|_|\_\
```

A Node.js-based utility for converting BASIC source text to tokenized program
images (`.prg` / `.bas`) for the [6502 homebrew BIOS](https://github.com/acwright/6502-BIOS),
and back again. Write your BASIC on a real keyboard, tokenize it here, and drop
the result straight onto a CompactFlash card or send it over XMODEM.

Inspired by the `petcat` utility distributed with the VICE emulator.

> 📖 **Guide:** [AC6502 Documentation](https://acwright.github.io/6502-DOCS/) — the user's and programmer's guide for the whole family.
> See [the tool belt](https://acwright.github.io/6502-DOCS/crossdev/tools) and [BASIC in a cross-dev workflow](https://acwright.github.io/6502-DOCS/crossdev/basic).

## Installation

### From NPM

```
npm install -g bastok
```

### From Source

1. Clone the repository:
```
git clone https://github.com/acwright/bastok.git
cd bastok
```

2. Install dependencies:
```
npm install
```

3. Build the project:
```
npm run build
```

4. (Optional) Link globally:
```
npm link
```

## Usage

```
bastok [options] <path>
```

The conversion direction is chosen from the file extension: `.txt`, `.asc` and
`.bs` are tokenized; `.prg` and `.bas` are detokenized. Anything else is
sniffed — a file of printable ASCII is treated as source, otherwise as a
program image. Use `-t` / `-d` to decide for yourself.

### Tokenize

```
bastok game.txt
```

Writes `game.prg`. To pick the name and extension yourself:

```
bastok -o GAME.BAS game.txt
```

### Detokenize

```
bastok game.prg
```

Writes `game.txt`. To list to the terminal instead:

```
bastok -o - game.prg
```

### Command Line Options

- `-v, --version` — Output the current version
- `-h, --help` — Display help information
- `-t, --tokenize` — Force text → tokenized binary
- `-d, --detokenize` — Force tokenized binary → text
- `-o, --output <path>` — Output file, or `-` for stdout
- `-a, --address <address>` — Program load address in hex (default: `0x0800`)
- `-H, --header` — Read / write a 2-byte load address header
- `-c, --crlf` — Emit CRLF line endings when detokenizing
- `-q, --quiet` — Suppress warnings and the summary line
- `-T, --tokens` — Print the token table and exit

Warnings and the "wrote N bytes" summary go to stderr, so `-o -` stays pipe-safe.

### Getting the program onto the machine

The image `bastok` produces is byte-for-byte what BASIC's `SAVE` writes, so it
can be used directly:

```
bastok game.txt -o GAME.BAS       # copy GAME.BAS to a CF card, then LOAD "GAME.BAS"
bastok game.txt -o game.prg       # send game.prg with XMODEM after a bare LOAD
```

**Load it with BASIC's `LOAD`, not by writing it straight into RAM.** The image
is only half the story: BASIC also keeps `VARTAB` (`$035F`), the pointer to the
end of the program, in its workspace. `LOAD` walks the line chain and updates it
via `BasFixChain`; a debugger, monitor or emulator that just pokes the bytes
into `$0800` does not.

If `VARTAB` is left at its post-`NEW` value of `$0802`, the program appears to
list and run correctly right up until it assigns its first variable — which is
written as a 7-byte record *on top of line 10*. The failure looks like this:

```
?UNDEF'D STATEMENT ERROR IN 90     GOTO can no longer find its target
LIST
78 FOR                             the variable table, listed as if it were a line
```

`78` is the two name bytes of the variable `N` (`$4E $00`) read as a line
number, and `FOR` is `$81`, the exponent byte of its floating-point value. If
you must inject the image directly, set `VARTAB`, `ARYTAB` (`$0361`) and
`STREND` (`$0363`) to the load address plus the file size afterwards.

## File Format

A tokenized program is a raw memory image of the program area starting at
`$0800` (`PROGRAM_START`). There is **no load-address header** — `SAVE` writes
`$0800` through `VARTAB` verbatim. Each line is:

```
[next-lo][next-hi][num-lo][num-hi][tokens...][$00]
```

and the program ends with a next-pointer of `$0000`, which is included in the
file. Next-pointers are absolute addresses, so they depend on the load address;
use `-a` if you are linking for somewhere other than `$0800`. `LOAD` relinks the
chain via `BasFixChain` anyway, so a stale pointer is harmless — `bastok` warns
about mismatches rather than refusing to read the file.

`-H` prepends (or consumes) a two-byte little-endian load address, the
Commodore `.prg` convention. The BIOS does not use it; it is there for
interoperating with other tools. When detokenizing with `-H`, the address in the
header wins over `-a`.

## Tokens

85 keywords, `$80`–`$D4`, transcribed from `KeywordTbl` in `BASIC.asm`. Run
`bastok --tokens` for the full list.

| | | | | |
|---|---|---|---|---|
| `$80` END | `$81` FOR | `$82` NEXT | `$83` DATA | `$84` INPUT |
| `$85` DIM | `$86` READ | `$87` LET | `$88` GOTO | `$89` RUN |
| `$8A` IF | `$8B` RESTORE | `$8C` GOSUB | `$8D` RETURN | `$8E` REM |
| `$8F` STOP | `$90` ON | `$91` WAIT | `$92` LOAD | `$93` SAVE |
| `$94` DEF | `$95` POKE | `$96` PRINT | `$97` CONT | `$98` LIST |
| `$99` CLR | `$9A` NEW | `$9B` TAB | `$9C` TO | `$9D` FN |
| `$9E` SPC | `$9F` THEN | `$A0` NOT | `$A1` STEP | `$A2` AND |
| `$A3` OR | `$A4` ELSE | `$A5` SYS | `$A6` DIR | `$A7` DEL |
| `$A8` CLS | `$A9` LOCATE | `$AA` COLOR | `$AB` SOUND | `$AC` VOL |
| `$AD` TIME | `$AE` DATE | `$AF` SETTIME | `$B0` SETDATE | `$B1` NVRAM |
| `$B2` PAUSE | `$B3` BANK | `$B4` BRK | `$B5` MEM | `$B6` SGN |
| `$B7` INT | `$B8` ABS | `$B9` FRE | `$BA` POS | `$BB` SQR |
| `$BC` RND | `$BD` LOG | `$BE` EXP | `$BF` COS | `$C0` SIN |
| `$C1` TAN | `$C2` ATN | `$C3` PEEK | `$C4` LEN | `$C5` STR$ |
| `$C6` VAL | `$C7` ASC | `$C8` CHR$ | `$C9` LEFT$ | `$CA` RIGHT$ |
| `$CB` MID$ | `$CC` JOY | `$CD` INKEY | `$CE` HEX | `$CF` MIN |
| `$D0` MAX | `$D1` DISK | `$D2` BLOAD | `$D3` BSAVE | `$D4` FORMAT |

## Tokenizer Behaviour

`bastok` is a port of `BasCrunch` / `BasMatchKeyword` / `BasStoreLine` from
`BASIC.asm`, and reproduces what the interpreter does rather than improving on
it. Typing your source in by hand gives the same bytes.

- **Case is folded** to uppercase outside of quoted strings. Text inside quotes,
  and everything after `REM`, is kept exactly as written.
- **Keywords match first, not longest.** The interpreter walks the keyword table
  in token order and takes the first hit, so `FORMAT` tokenizes as `FOR` (`$81`)
  followed by the letters `MAT`. Type it into the machine and you get the same.
- **Keywords inside identifiers are tokenized.** `TOTAL=1` becomes `TO` (`$9C`)
  plus `TAL=1`, the classic MS BASIC hazard. Avoid variable names that contain
  keywords.
- **Spaces are preserved** as typed — this BASIC does not squeeze them out.
- **Lines are stored in numeric order** regardless of their order in the file.
  A repeated line number replaces the earlier line, and a bare line number with
  no statement deletes it, exactly as retyping would.
- **Blank lines are skipped.** Lines without a line number are an error; a
  program file cannot hold immediate-mode statements.

### Limits and errors

- Source lines are capped at 200 characters (`BAS_LINBUF_MAX`) and tokenized
  payloads at 250 bytes (`BAS_TOKBUF_MAX`).
- ``@ & [ ] { } | \ ` ~`` are rejected — `BasValidPunct` does not accept them.
- Only printable ASCII `$20`–`$7E` may appear in source; tabs are an error,
  since the machine's line editor cannot accept one.
- A program that would run past the top of program RAM (`$8000`) is written,
  but warned about.

Detokenizing a byte in `$80`–`$FF` that is not a valid token emits `{$xx}` and a
warning. Such a file will not tokenize back — `{` and `}` are illegal input.

## Example

`examples/guess.txt` round-trips exactly:

```
bastok examples/guess.txt        # -> examples/guess.prg
bastok -o - examples/guess.prg   # lists it back, identical to the source
```

## Development

### Run in Development Mode

```
npm run build
node ./dist/index.js examples/guess.txt
```

### Tests

```
npm test
```

### Release Build

```
git tag vX.Y.Z
git push origin main --tags
npm publish
```

### Project Structure

```
bastok/
├── src/
│   ├── index.ts                # CLI entry point
│   ├── Bastok/
│   │   ├── Bastok.ts           # File-level facade, direction detection
│   │   ├── Tokenizer.ts        # Text -> program image (port of BasCrunch)
│   │   ├── Detokenizer.ts      # Program image -> text (port of BasCmdList)
│   │   ├── Tokens.ts           # Keyword table, transcribed from BASIC.asm
│   │   └── Errors.ts           # BastokError
│   └── test/                   # Round-trip and behaviour tests
├── examples/                   # Sample BASIC programs
├── dist/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Keeping in sync with the BIOS

`src/Bastok/Tokens.ts` mirrors `KeywordTbl` and the `TOK_xxx` equates in
`6502-BIOS/BASIC.asm`. If keywords are added, removed or reordered there, update
the `KEYWORDS` array here to match — order determines both the token values and
the matching behaviour.

## Library Use

```ts
import { Bastok } from 'bastok'

const bastok = new Bastok()
const { buffer, warnings } = bastok.tokenize('10 PRINT "HELLO"\n')
const { text } = bastok.detokenize(buffer)
```

## Related

- [6502-ACE](https://github.com/acwright/6502-ACE) — the hardware, and the index of the whole family
- [6502-BIOS](https://github.com/acwright/6502-BIOS) — the BASIC dialect this tokenizes for
- [6502-BAS](https://github.com/acwright/6502-BAS) — BASIC listings built with this tool
- [6502-EMULATOR](https://github.com/acwright/6502-EMULATOR) — run a tokenized `.prg` without hardware
- [cffs](https://github.com/acwright/cffs) — package the result onto a CompactFlash image
- [6502-DOCS](https://github.com/acwright/6502-DOCS) — the documentation site: [where this tool fits in a cross-dev workflow](https://acwright.github.io/6502-DOCS/crossdev/tools)

## License

MIT: [https://github.com/acwright/bastok/blob/main/LICENSE](https://github.com/acwright/bastok/blob/main/LICENSE)

## Credits

Inspired by `petcat` from [VICE](https://vice-emu.sourceforge.io).

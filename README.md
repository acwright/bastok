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
images (`.prg` / `.bas`) for the [AC6502 BIOS](https://github.com/acwright/6502-BIOS),
and back again. It knows both BASIC keyword tables: BIOS 1.x (1.6 and earlier) and
BIOS 2.x. Write your BASIC on a real keyboard, tokenize it here, and drop
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

### Choosing the BIOS

BIOS 2.x added keywords to BASIC, so the same text can crunch to different bytes
on 1.x and 2.x. `-b` / `--bios` says which BIOS the program is for:

- `--bios 1` (the default) — BIOS 1.x, such as 1.6 on the COB, DEV, KIM, VCS,
  PicoCalc and an ACE with the TMS9918A. It's also what the emulator runs by
  default (`6502 run`, `--vdp tms9918a`).
- `--bios 2` — BIOS 2.x, on an ACE with the 6502-PICOVDP
  (`6502 run --vdp picovdp`).

```
bastok -b 2 game.txt              # tokenize for BIOS 2.x
bastok -b 2 -o - game.prg         # list a BIOS 2.x program
bastok -T -b 2                    # show the BIOS 2.x token table
```

The option picks the keyword table in both directions and for `--tokens`. bastok
doesn't guess the BIOS from the file, but it does warn (on stderr; `-q` silences
it) when a choice looks wrong:

- tokenizing with `--bios 1`, a line that would crunch to 2.x keywords (`VPOKE`,
  `SCREEN`, ...) on BIOS 2.x;
- tokenizing with `--bios 2`, a line that says `BRK`, which isn't a keyword on 2.x;
- listing with `--bios 1`, token bytes `$D5`–`$E3`, which only 2.x has;
- listing with `--bios 2`, a bare `SCREEN`, which was `BRK` if the program came from 1.x.

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
- `-b, --bios <1|2>` — BIOS the image is for: `1` (1.x, e.g. 1.6) or `2` (2.x) (default: `1`)
- `-T, --tokens` — Print the token table (for `--bios`) and exit

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

Transcribed from `KeywordTbl` in `BASIC.asm`. Run `bastok --tokens` (or
`bastok -T -b 2`) for the full list.

### BIOS 1.x

85 keywords, `$80`–`$D4`:

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

### BIOS 2.x

100 keywords, `$80`–`$E3`: the 1.x table, except that `$B4` is `SCREEN` instead of
`BRK`, plus fifteen more:

| | | | | |
|---|---|---|---|---|
| `$D5` VPOKE | `$D6` VREG | `$D7` PALETTE | `$D8` VSYNC | `$D9` VLOAD |
| `$DA` SPRITE | `$DB` SCROLL | `$DC` LAYER | `$DD` NVSAVE | `$DE` NVLOAD |
| `$DF` NVERASE | `$E0` VPEEK | `$E1` VSTAT | `$E2` NVSTAT | `$E3` NVFIND |

### Moving a program between 1.x and 2.x

- **A 1.x image loads on 2.x unchanged, except for `$B4`**: `BRK` lists as `SCREEN`,
  and a bare `SCREEN` is `?SYNTAX ERROR` on 2.x.
- **`BRK` in 2.x source is just letters** (a variable name), not a keyword.
- **Names that start with a 2.x keyword crunch differently.** `XVLOAD=1` is
  `X` `V` `LOAD` `=1` on 1.x but `X` `VLOAD` `=1` on 2.x, and `ONSCREEN` is `ON`
  `SCREEN` on 2.x. Watch for names containing `SCREEN`, `SCROLL`, `SPRITE`,
  `LAYER`, `PALETTE`, `VPOKE`, `VPEEK`, `VREG`, `VSYNC`, `VLOAD`, `VSTAT`, or
  `NV` followed by `SAVE`, `LOAD`, `ERASE`, `STAT` or `FIND`.
- **A 2.x image listed as 1.x** shows `{$D5}` and so on for the new keywords, and
  won't tokenize back. List it with `--bios 2`.

## Tokenizer Behaviour

`bastok` is a port of `BasCrunch` / `BasMatchKeyword` / `BasStoreLine` from
`BASIC.asm`, and reproduces what the interpreter does rather than improving on
it. Typing your source in by hand gives the same bytes; the tests check that
against both ROMs (see [Checking against the ROMs](#checking-against-the-roms)).

- **Case is folded** to uppercase outside of quoted strings. Text inside quotes,
  and everything after `REM`, is kept exactly as written.
- **Keywords match longest, not first.** The interpreter walks the whole keyword
  table and takes the longest hit, so `FORMAT` tokenizes as `FORMAT` (`$D4`), not
  as `FOR` (`$81`) followed by the letters `MAT`. BIOS 1.0–1.3 took the first
  match (so `FORMAT` couldn't be typed there); `bastok` follows 1.4 and later.
- **Keywords inside identifiers are tokenized.** `TOTAL=1` becomes `TO` (`$9C`)
  plus `TAL=1`, the classic MS BASIC hazard, even with longest match. Avoid
  variable names that contain keywords.
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

The tests need only Node. They include `src/test/rom.test.ts`, which compares
bastok with what the ROMs themselves crunched (next section).

### Checking against the ROMs

`src/test/fixtures/rom-crunch.json` records what BIOS 1.6 and 2.0 do with each
program in `src/test/corpus/`: the bytes from `$0800` to `VARTAB` (what `SAVE`
writes) and the output of `LIST`. It is captured by typing the programs into the
emulator:

```
npm run capture:rom              # re-capture and write the file
npm run capture:rom -- --check   # re-capture and fail on any difference
```

This needs [6502 Emulator](https://github.com/acwright/6502-EMULATOR) 3.1.0
installed (the `6502` command). The script boots its bundled `BIOS.bin` (1.6, on the
TMS9918A) and `BIOS2.bin` (2.0, on the PICOVDP) headless, refuses any other
emulator version or ROM hash, and also checks that `KeywordTbl` in each running
ROM equals `tokens-1.6.json` / `tokens-2.0.json`. `--rom1`, `--rom2` and `--port`
override the ROM files and the debug port.

### Release Build

The version lives only in `package.json` (and `package-lock.json`); the CLI reads it
from there.

```
npm version X.Y.Z --no-git-tag-version
git commit -am "Release vX.Y.Z"
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
│   │   ├── Tokens.ts           # Keyword tables (1.x and 2.x), from BASIC.asm
│   │   └── Errors.ts           # BastokError
│   └── test/                   # Behaviour, table, CLI and ROM tests
│       ├── corpus/             # Programs typed into the ROMs
│       └── fixtures/           # Pinned token tables, ROM captures
├── scripts/
│   └── capture-rom.mjs         # npm run capture:rom
├── examples/                   # Sample BASIC programs
├── dist/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Keeping in sync with the BIOS

`src/Bastok/Tokens.ts` mirrors `KeywordTbl` in `6502-BIOS/BASIC.asm`, twice:

- `KEYWORDS_1` is the table on 6502-BIOS branch `v1.x`, final at tag `v1.6` (the
  last 1.x release). `src/test/fixtures/tokens-1.6.json` pins it; it was decoded
  once from `v1.6`'s `BIOS.bin`. (`KEYWORDS` and `TOK_MAX` are the 1.x values,
  as in bastok 1.0.)
- `KEYWORDS_2` is the table on `main`, at tag `v2.0`.
  `src/test/fixtures/tokens-2.0.json` is a copy of the BIOS's own
  `tests/fixtures/tokens.json` at `v2.0`.

Order determines the token values. If a later 2.x BIOS adds keywords: copy its
`tests/fixtures/tokens.json` over `tokens-2.0.json` (and update the hash in
`src/test/tokens.test.ts`), update `KEYWORDS_2`, add the new keywords to the
corpus, and run `npm run capture:rom` against that ROM.

## Library Use

```ts
import { Bastok } from 'bastok'

const bastok = new Bastok()
bastok.bios = 2                 // BIOS 2.x; the default is 1
const { buffer, warnings } = bastok.tokenize('10 VPOKE 0,65\n')
const { text } = bastok.detokenize(buffer)
```

`Tokenizer` and `Detokenizer` take the same `bios` property, and `Tokens`
exports `KEYWORDS_1`, `KEYWORDS_2`, `keywordsFor(bios)`, `tokenMax(bios)` and
`keywordForToken(token, bios)`.

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

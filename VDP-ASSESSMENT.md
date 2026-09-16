# VDP assessment: bastok

> An outline, not a plan. The detailed plan for this repository goes in `VDP-PLAN.md`,
> written in a session of its own. Surveyed 2026-09-16 across the whole workspace.

## The change

The ACE moves from a Pico9918 running stock TMS9918A firmware to the **6502-PICOVDP** on
PICO9918 PRO v2.0 hardware, running **BIOS 2.x**. COB, DEV, KIM, VCS, PicoCalc and
unconverted ACEs stay on the TMS9918A and **BIOS 1.x**, whose last release is **1.6**.

**Decisions already made that matter here:**
- No new repositories.
- **BIOS 1.6** adds only the NVRAM save slots, and **no BASIC keywords**.
- **BIOS 2.0 adds BASIC keywords.**
  - Core: `SCREEN`, `VPOKE`, `VPEEK`, `VREG`, `PALETTE`, `VSYNC`, `VLOAD`.
  - Second tier, if room is found: `SPRITE`, `SCROLL`, `LAYER`, `VSTAT`.
  - Save-slot commands, if room is found.
  - Extended syntax for `SYS`, `BLOAD`, `BSAVE` and `COLOR`, which changes no tokens.
- **The token rule:** every 1.x token keeps its value (`$80`–`$D4`), and new keywords are
  appended from `$D5`. The `BRK` statement is retired and its token `$B4` goes to a new
  keyword.
- **6502-DOCS** is versioned: frozen `v1` docs for BIOS 1.6, and `main` for BIOS 2.x.

**Order that matters here:** 1.6 changes nothing for bastok. 2.x's table arrives when
6502-BIOS 2.0's `KeywordTbl` is settled, and 6502-DOCS's rewrite needs it.

---

## This repository's role

Tokenizes and detokenizes BASIC for the BIOS's built-in interpreter. `src/Bastok/Tokens.ts`
is transcribed from `KeywordTbl` in `6502-BIOS/BASIC.asm`: token = `$80` + index, and
order matters. 6502-DOCS uses bastok for its BASIC embeds, and 6502-BAS's listings build
with it.

## Impact

- **BIOS 1.6:** none.
- **BIOS 2.x:** the trigger has fired. 2.x's table is 1.x's plus appended keywords, with
  `$B4` renamed.
  - Tokenizing **with the 2.x table** a 1.x program that doesn't use `BRK` gives exactly
    the 1.x bytes.
  - Tokenizing **with the 1.x table** a 2.x program that uses new keywords gives wrong
    output. The 1.x table has no such keywords, so they would be crunched as variable
    names.
  - Detokenizing a 1.x program under the 2.x table shows `$B4` as the new keyword.

## Work outline

1. **Two dialects in one tool.** Add a `--bios 1|2` option (or a dialect name) that
   selects the table: 1.x as today; 2.x as 1.x plus the appended keywords, with `$B4`
   renamed.
   - Default to 1 until the family's default moves.
   - **Do not branch this repository:** 6502-DOCS builds `v1` and `main` embeds from the
     same tool.
2. **Tests.**
   - The 1.x table is a prefix of 2.x's, except `$B4`.
   - A 1.x program round-trips identically under both tables unless it uses `BRK`.
   - Every 2.x keyword tokenizes to its value.
   - Order-sensitive first-match cases for the new keywords: for example, `VPOKE` versus
     `POKE`, and keywords hidden inside variable names.
3. **Watch** 6502-BIOS's `KeywordTbl` on `main` until 2.0 ships, since the second-tier and
   save-slot keywords depend on ROM space.
4. **README:** "Keeping in sync with the BIOS" names both `v1.x` (the 1.x table, final)
   and `main`.
5. **Release a minor version.** 6502-DOCS pins it.

## Linked repositories

| Repository | Path | Why |
|---|---|---|
| 6502-BIOS | `~/Developer/Assembly/6502-BIOS` | `BASIC.asm` `KeywordTbl` is the source of truth; its assessment lists the 2.x keywords |
| 6502-DOCS | `~/Developer/NodeJS/6502-DOCS` | `scripts/build-embeds.mjs` tokenizes BASIC samples, with the 1.x table for `v1` and the 2.x table for `main` |
| 6502-BAS | `~/Developer/BASIC/6502-BAS` | Listings built with bastok; they stay valid on 2.x under the token rule |

## Questions for VDP-PLAN.md

1. Option name and default.
2. Whether the dialect can be inferred, for example from a comment header in the source.

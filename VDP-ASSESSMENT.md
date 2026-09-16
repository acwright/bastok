# VDP assessment: bastok

> An outline, not a plan. The detailed plan for this repository goes in `VDP-PLAN.md`,
> written in a session of its own, **only if** the trigger below fires. Surveyed
> 2026-09-16 across the whole workspace.

## The change

The ACE moves from a Pico9918 running stock TMS9918A firmware to the **6502-PICOVDP**
(`6502-PICOVDP/SPEC.md`) on PICO9918 PRO v2.0 hardware, running **BIOS 2.x**. Everything
else stays where it is: COB, DEV, KIM, VCS, PicoCalc, and any ACE whose card cannot be
reflashed (RP2040 pico9918 v1.0–1.3). Those keep the stock firmware and **BIOS 1.x (1.5)**.

- **Legacy** in these documents means TMS9918A + BIOS 1.x. **VDP** means PICOVDP + BIOS 2.x.
- **BIOS 2.0 is assumed to be:** BIOS 1.5, plus the NVRAM save slots in
  `6502-BIOS/PLAN.md`, plus the VDP work in `6502-EMULATOR`'s
  `docs/handoff/6502-BIOS.md` (branch `v3-vdp`). Existing jump-table addresses stay put.
  A later BIOS redesign may revise this.
- **Decisions already made** (in brief): no new repositories. The emulator makes the video
  card an option. 6502-DOCS is versioned (`/v1/` frozen). 6502-BIOS gets a `v1.x`
  branch, and `main` becomes 2.x. The tools change only where BIOS 2 forces it.

---

## This repository's role

Tokenizes and detokenizes BASIC for the BIOS's built-in interpreter. `src/Bastok/Tokens.ts`
is transcribed from `KeywordTbl` in `6502-BIOS/BASIC.asm`: token = `$80` + index, and
order matters. 6502-DOCS uses bastok to build its BASIC embeds.

## Impact: none in the baseline, conditional after that

- **The BIOS 2.0 baseline adds no BASIC keywords.** It has 41 bytes free in the BASIC
  segment, and the VDP handoff leaves new keywords as an open design question. So nothing
  changes yet: the program layout at `$0800` and the token table are identical.
- **The trigger:** 6502-BIOS 2.x adds, removes or reorders any keyword in `BASIC.asm`,
  or changes the line layout. Any of those makes a 1.x tokenization wrong for 2.x (and
  the reverse).

## Work outline, if triggered

1. **Two dialects in one tool.** Add a `--bios 1|2` option (or a dialect name) that
   selects the token table. Default to 1 until the family's default moves.
   - Do not branch this repository: 6502-DOCS builds legacy (`v1`) and current embeds
     from the same tool.
2. **Tests** for both tables, including detokenizing a 1.x program under 2.x where tokens
   collide.
3. **README:** "Keeping in sync with the BIOS" names both `v1.x` and `main`.
4. **Release a minor version.** 6502-DOCS pins it.

## Linked repositories

| Repository | Path | Why |
|---|---|---|
| 6502-BIOS | `~/Developer/Assembly/6502-BIOS` | `BASIC.asm` `KeywordTbl` is the source of truth; watch for keyword changes in 2.x |
| 6502-DOCS | `~/Developer/NodeJS/6502-DOCS` | `scripts/build-embeds.mjs` tokenizes BASIC samples with bastok, for both `v1` and `main` |
| 6502-BAS | `~/Developer/BASIC/6502-BAS` | BASIC programs built with bastok; legacy-dialect programs keep working |

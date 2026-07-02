# WHISTL — Brand & Design Direction

> Source of truth for the frontend's look, feel, and voice. Translate these tokens into
> Tailwind v4 `@theme` in `globals.css`. Anti-slop is a hard requirement.

## Positioning
WHISTL settles World Cup prop bets **trustlessly** — the final whistle, not an admin, releases
the money. The product should *feel* like that promise: **precise, verifiable, alive.**

## Aesthetic — "Verifiable Terminal"
A premium trading terminal that breathes football. The wow comes from **precision, data density,
motion, and the proof receipt as a hero artifact** — NOT from gradients or glassmorphism.

- Near-black ink canvas, crisp 1px hairline borders (not heavy frosted glass).
- One confident **signal accent** used sparingly; everything else is restraint + negative space.
- **Monospace numerics** for odds, stats, stakes, timestamps, addresses, proof hashes — the
  trading-terminal tell. Tabular figures, aligned.
- Editorial typographic hierarchy: big confident display headings, quiet labels.

## Color tokens
- `--ink` `#0A0B0D` (base canvas) · `--ink-2` `#111317` (raised surface) · `--line` `#22262E` (hairline)
- `--text` `#ECEEF1` · `--text-dim` `#8A929E` (labels/meta)
- `--signal` `#C6F24E` (electric lime — verified / settle / primary action; use sparingly)
- `--live` `#FF4D4D` (in-play pulse only) · `--win` `#4ADE80` · `--lose` `#5B6472`
- `--proof` `#7C5CFF` (Merkle/proof accents only — the ONE place violet is allowed, small doses)

## Typography
- Display/UI: a strong variable grotesque (e.g. Geist / Inter Display via `next/font`).
- Numerics & hashes: a monospace (e.g. Geist Mono / JetBrains Mono), `font-variant-numeric: tabular-nums`.

## Motion (purposeful, never decorative)
- Odds/score values **roll** (digit transitions), not fade.
- Settlement: a "verifying → ✓ settled" proof animation is the signature moment.
- Page entrances: short, choreographed stagger (see page-load-animations patterns). Springy, ~150–250ms.
- Live in-play uses a single calm pulse on `--live`, nowhere else.

## Voice
Terse, confident, verifiable. "Settled by proof." "No oracle. No admin. The whistle decides."
Avoid hype words and emoji in product chrome.

## Hard DON'Ts (anti-slop)
- ❌ Purple radial background glows / blurred blobs.
- ❌ Generic frosted-glass cards everywhere.
- ❌ Rainbow gradients, neon everything, emoji headers.
- ❌ Proportional numbers for data. Always tabular/mono for figures.

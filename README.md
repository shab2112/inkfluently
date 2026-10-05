# Inkfluently

Daily phrase-paced dictation practice for legible, fluent handwriting. Reads a passage aloud a
few words at a time, the student writes it by hand, photographs the page, and gets AI feedback
on legibility (primary), writing speed, and accuracy (secondary).

Full product requirements: [docs/spec.md](docs/spec.md). Brand/naming brief: [docs/design.md](docs/design.md).
The original Claude Artifact prototype used to validate these features lives at
[docs/prototype-reference.html](docs/prototype-reference.html) (reference only — not part of the build).

## Status: Phase 1 (core practice loop)

Implemented and working:
- Home: streak/heat-grid/log, weekly-focus card, adaptive passage selection, custom-passage paste,
  punctuation-announce toggle, voice picker, sessions-per-day target.
- Practice: phrase-by-phrase TTS pacing, Play/Repeat toggle, on-screen punctuation cue, slow/normal
  speed, soft countdown ring.
- Finish: photo capture, AI review via `/api/review` (Google Gemini, server-only), structured
  5-dimension legibility breakdown + accuracy (shown secondary, per the brand brief's fluency-first
  positioning).
- Dashboard: WPM / legibility / accuracy trend charts.
- Progress: before/after photo comparison with independent steppers.
- Persistence: browser `localStorage` only (see Phase 2 below).

**Not yet built** (see [docs/spec.md](docs/spec.md) for full detail on each):
- §5a account model (main-account-holder + user profiles, age-branched sign-up) — everything today
  is single-profile, local-storage only. No real backend yet.
- §3 document-upload passage input (.docx/.pdf parsing).
- §6 on-device OCR phrase-match + face-detection gates before a photo reaches the cloud AI.
- §9 Stripe subscription billing.
- §10 compliance (privacy policy, data-deletion flow, parental-consent mechanism) — required before
  any use outside the immediate family.

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set `GEMINI_API_KEY` (get one at https://aistudio.google.com/apikey). Use the
**paid tier** before any real user's photos are sent — see `docs/spec.md` §7/§10 on why the free
tier isn't acceptable once this serves anyone besides a solo developer testing.

```bash
npm run dev
```

Open http://localhost:3000. Without `GEMINI_API_KEY` set, everything works except the AI review
step, which fails with a clear "review unavailable" message (the session and photo still save).

## Stack

- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- Google Gemini API for the AI review (`src/lib/gemini.ts`, called only from `src/app/api/review/route.ts`
  — the API key never reaches the browser).
- Phase 2 (not wired up yet): Supabase for Postgres + Auth + photo storage, once the real account
  model (§5a) is built.

## Project layout

- `src/lib/` — pure logic ported from the prototype: passage bank, phrase-splitting, streak/weekly-focus
  calculations, the Gemini review call.
- `src/components/` — the five screens (Home/Practice/Finish/Dashboard/Progress) as React components.
- `src/app/api/review/` — the server-only route that calls Gemini.
- `docs/` — product spec, brand brief, and the original prototype for reference.

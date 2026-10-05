# Inkfluently — Product Spec

**Product name: Inkfluently** (decided — see design.md). **Domain: inkfluently.com.** Built and validated so far under the prototype's working name "Daily Dictée"; references to that name below are to the prototype itself, not the product name going forward.

Living requirements doc for the standalone rebuild (local → GitHub → Vercel). Everything here has been validated (or is being validated) in a Claude Artifact prototype first: https://claude.ai/artifact/57CEMDWgGktXDePaPDYyfv

## 1. Purpose

A daily 10–15 minute dictation-practice tool for a teenager: it reads a passage aloud, he writes it by hand, photographs the page, and gets AI feedback. Real objective (not just a habit tracker): **assess handwriting legibility, transcription accuracy, and writing speed over time.**

## 2. Core user flow (validated in prototype)

1. **Home** — streak counter, best streak, total sessions, 28-day heat grid, practice log (photo thumbnail, date, duration, WPM, scores, synced/local badge, session-number tag on multi-session days), a **View trends** button into the dashboard.
2. **Setup** — pick session length (10/12/15 min), a **sessions-per-day target** stepper (default 1, adjustable 1–5), optionally paste a custom passage instead of the built-in bank, toggle "announce punctuation" (classic dictée style).
3. **Practice** — phrase-by-phrase TTS playback (Play / Repeat / Next), paced like a real dictée: each sentence is broken into short, natural pause-chunks (at commas/clauses, or ~7-word groups when a sentence has none) rather than read whole, so writing keeps up more naturally. The student still fully controls pacing — Play/Repeat/Next per phrase, same as before, just at finer granularity. Slow/normal speed toggle, countdown ring (soft deadline — finishing after time's up is fine, not a hard stop), progress dots (grouped visually by sentence). **The "time's up" banner must say explicitly that nothing advances automatically and the user has to tap Finish themselves** — a soft deadline with no visible cue to that effect reads as broken ("why didn't it move on?") rather than intentional; don't just imply it, state it.
4. **Finish** — take/upload a photo of the written page (file input with `capture="environment"` — works as camera on mobile, file picker on desktop), a privacy disclaimer shown at this step, optional note, Save.
5. **Saved confirmation** — explicit "Saved!" state (synced vs. on-device), a **words-per-minute** figure, followed by AI review results with a visible "please keep this open" progress cue while the review runs.
6. **Dashboard** — three trend charts (speed, legibility, accuracy) across all sessions over time, each with hover detail and a table view, plus running averages.

## 3. Content

- Built-in passage bank: **33 original passages** (~4 sentences each) across varied topics, shuffled without repeats until exhausted. Still worth growing further for a paid product — repeats become noticeable after a few weeks of daily use even at this size.
- Custom-passage paste option stays — useful for an account holder/tutor supplying their own curriculum text.
- **New requirement (rebuild, not in the prototype): attach a document, not just paste text** — like attaching a file in the Claude app. Accept `.docx`/`.pdf`/`.txt`, extract the passage text automatically, and still keep the plain paste-text option alongside it for anyone who'd rather copy-paste. Needs document text extraction in the rebuild (e.g. mammoth.js for `.docx`, pdf.js for `.pdf`) — not something the Claude Artifact prototype attempted.

## 4. AI review (the core value-add)

One combined AI call per saved session, given the photo **and** the ground-truth passage text, returns:
- **Legibility**: 1–5 overall score **plus a structured per-dimension breakdown** (rebuild requirement, §4a) — not just a holistic score and a couple of sentences.
- **Accuracy**: 1–5 score + a list of specific differences (`spelling` / `punctuation` / `missing` / `extra`, each with expected vs. found text) + one summary sentence.

Prototype uses Claude's `sample` capability (viewer's own usage, free to the developer). **Rebuild should use Google's Gemini/Gemma API** instead — see §7.

**Confirmed prototype blocker (2026-10-05):** image-capable AI review does not currently work in this artifact's viewing context at all — every attempt (two different accounts, after fixing a timing race, after upgrading to the latest runtime contract) rejects with the capability's own `images_unavailable` code: "image input is not available in this view." This is a genuine platform-level limitation of the `sample` capability's image support in this context right now, not a bug in this app's code. It does not threaten the rebuild plan — the rebuild calls Gemini/Gemma's vision API directly, independent of this capability entirely — but it does mean **AI photo-scoring (legibility + accuracy) cannot be validated further inside the Claude Artifact prototype**. Every other feature (saving, sync, streaks, WPM, dashboard, before/after once photos exist) is unaffected and should keep working.

### 4a. Structured legibility breakdown (now live in the prototype)

**Why**: a single blended score ("4.6/5, clear and steady") tells a user whether their handwriting is good, not *what's actually wrong with it* — and "what to fix" is the entire point of a product aimed at improving handwriting, not just tracking it. The AI review must return named sub-dimensions, each independently flagged, mirroring the structured treatment accuracy already gets:

- **Letter formation** — are individual letters well-shaped, or are specific ones (e.g. reversed b/d, malformed g/y, unclosed a/o) consistently wrong?
- **Size consistency** — do letters hold a consistent height, or does size wander within a word/line?
- **Spacing** — consistent gaps between letters and words, not cramped or overly wide?
- **Baseline/alignment** — does writing sit on the line, or drift up/down across a line?
- **Slant** — is the slant consistent, or does it vary erratically letter to letter?

Each dimension gets a short flag (e.g. "strong" / "needs work") and one specific, concrete observation when flagged — not a restatement of the flag. This is what feeds §4b (the weekly focus) and should be visible on the saved-session screen itself (a structured list, like accuracy's, not collapsed away), not just logged for internal use.

**Built in the prototype**: the AI prompt now asks for exactly these five dimensions (`letter_formation`, `size_consistency`, `spacing`, `baseline`, `slant`), each flagged `good`/`needs_work` with a concrete note when flagged, rendered as a list on the results screen and stored with the session record (so history and the weekly focus below can use it).

### 4b. Weekly focus suggestion (now live in the prototype)

**Why**: a score with no next action gets glanced at and forgotten. After enough sessions to have a signal (e.g. a rolling window of the last 5-7 sessions), identify whichever §4a dimension is flagged "needs work" most consistently and surface ONE concrete, small focus for the coming week (e.g. "This week: focus on keeping your letters the same height") — shown prominently on Home, not buried in a settings page. Update it on a weekly cadence (or after N sessions), not every single session, so it reads as a stable goal to work toward rather than noise that changes daily.

**Built in the prototype**: `computeWeeklyFocus()` scans the last 7 sessions' dimension flags, finds whichever is "needs_work" most often (minimum 2 occurrences before it's treated as a real pattern, not noise from one bad photo), and shows it as a persistent card on Home — using the AI's own most recent note for that dimension when available, falling back to a generic tip per dimension otherwise.

### 4c. Visual progress — before/after photo comparison (now live in the prototype)

**Why**: handwriting is a visual, physical skill. A number trending from 3.2 to 4.1 is abstract; seeing an early messy page next to a recent neat one is immediate and motivating in a way a chart isn't. Add a side-by-side comparison view — oldest saved photo vs. most recent (and ideally a way to pick two arbitrary dates to compare) — on the progress/trends view. This sits alongside the existing numeric trend charts, not instead of them; both have value, but the photo comparison is the missing piece for a handwriting-specific product.

**Built in the prototype**: a new "🖼️ Before & after" view, reachable from Home. Defaults to oldest-vs-newest session with a saved photo, each with its WPM/legibility/accuracy chips; independent ←/→ steppers on each side let you compare any two points in time (bounded so the left side can never cross past the right). Shows a friendly empty state until at least two photos exist.

### 4d. Adaptive content (now live in the prototype, lighter-weight MVP as scoped)

**Why**: every session currently pulls a random passage regardless of what the user actually needs to work on. Full adaptive curriculum sequencing is a larger content-engineering effort than this spec scopes in detail, but an MVP version is tractable: tag each passage/generated passage by the skills it naturally exercises (e.g. punctuation-dense, long words, varied letter shapes), and when §4b has identified a weekly focus, weight passage selection toward ones that give that dimension more exercise. Surface this lightly to the user too (e.g. "today's passage: extra punctuation practice") so the adaptivity is visible, not silent.

**Built in the prototype**: passages are tagged at runtime by a simple heuristic (average word length and punctuation density — `longWords` / `punctuation` / `varied`, no manual per-passage tagging needed), mapped from whichever dimension the weekly focus names. When a focus exists, passage selection searches the day's remaining shuffle deck for a matching tag and pulls that one forward (still respecting the no-repeats-until-exhausted rule), and Home shows the adaptive note explaining why.

**Known prototype limitation, rebuild requirement:** the AI prompt currently hardcodes "a 16-year-old" — fine for one family, wrong once this serves other children. The rebuild needs a **child age/grade field the parent sets during setup/onboarding** (not something the child adjusts), and the AI prompt should be built from that value instead of a fixed age. This likely also means age-appropriate framing of the feedback tone/vocabulary, not just the prompt's stated age.

**Built in the prototype:**
- **Words-per-minute** per session (passage word count ÷ duration, only shown once the session ran at least 5 seconds so the number is meaningful).
- **A trends dashboard**: line charts for speed (WPM), legibility, and accuracy across every session, chronological, each with hover tooltips and an accessible table-view toggle, plus running averages. Chart colors were run through a colorblind-safety validator before use.
- A **visible progress cue** while the AI review is in flight ("please keep this page open" + elapsed seconds), since the call can take 5–60+ seconds and closing the tab too early would lose the result (the session itself still saves regardless).

**Design decision, not a bug**: WPM is deliberately whole-session elapsed time (listening + replays + writing), not isolated pen-on-paper time. A child needing more replays genuinely can't yet follow and write at full speed, so folding that into the number is correct, not noise — and it should legitimately trend down as fewer replays are needed with practice. This reasoning is shown to the viewer as captions on both the Saved screen and the dashboard's speed chart, so it isn't mistaken for a measurement flaw later. **AI-scored fields (legibility, accuracy) also carry a caption noting normal session-to-session scoring variance** — read the trend, not any single point.

## 5. Persistence

### 5a. Accounts & auth model (rebuild requirement)

**Terminology: "main account holder" and "user," not "parent" and "child."** The relationship isn't always parent/child (it can be any adult managing another adult's profile, or a single person who is both), so the schema and copy should name the two roles generically: the **main account holder** (owns the account, pays, receives all communications) and a **user** (practices on the account — may or may not be the same person as the account holder). "Child" describes an age fact (under 18), never a role name.

Reference model: **Bhanzu** (the ed-tech company referenced earlier, math learning platform) — account holder + user, with a split between an account-holder-facing view and a user-facing one. This product follows the same shape:

- **The main account holder signs up and owns the account**: they are the payer (yearly subscription, §9) and the sole recipient of all communications (billing, progress updates, notifications) via their own email.
- **A user under 18 is a profile under the main account holder's account**, not an independent account holder.
- **At 18, a user who was a profile under someone else's account can register their own independent account** and use the platform directly — no longer tied to the account holder's account or subscription. Needs a real migration path (claim their own history/data, or start fresh — not yet decided) rather than just a permissions change.
- **Sign-up branches on the registered user's age, not a manual "who is this for" toggle.** Collect the actual user's name and age/birthdate FIRST; derive the relationship from that, rather than asking the signer to self-categorize up front (an earlier draft of this flow asked "is this for yourself or your child?" as the first question — age-derived is more correct and removes a redundant question):
  - **Under 18 → automatically a profile under the main account holder.** No separate question needed; a minor can't independently consent, so the signer is implicitly the main account holder as described above.
  - **18 or over → check whether the registered user is the same person as the signer (the main account holder), or a different person:**
    - **Same person** (signing up for themselves): a normal self-serve account — signer = account holder = user, no separate profile at all.
    - **Different person** (e.g. the main account holder registering another adult): this is **not** the same as the under-18 case — an adult being added by someone else can't just be silently attached the way a minor can. They need their **own acceptance step** (e.g. an email/invite they confirm themselves, setting their own password) before the profile is fully active, since consent for an adult's data can't come from someone else on their behalf. Flag this distinction explicitly in the rebuild: under-18 = guardian-consent model, adult-added-by-someone-else = invite-and-self-accept model. Don't conflate the two.
- Getting this branch wrong at signup (e.g. assuming every signer is managing a minor, or skipping the adult's own consent step) is the same class of bug as the earlier mockup issue where a user's name was referenced before being entered — don't presuppose a relationship or consent that hasn't actually been established yet.
- This is a first-class rebuild requirement, not a nice-to-have: it shapes the whole auth/database schema (account-holder + user-profile relationship, an age-triggered transition flow, and the same-person-vs-different-person branch above) and should be designed in from the start rather than retrofitted.

- Local device storage always works as a fallback (per-viewer, per-browser).
- Cross-device/shared history in the prototype rides on the Claude Artifact's `db`/`assets` capabilities — **this is Claude-Artifact-specific and does not carry over to the rebuild.** The rebuild needs its own backend: real user accounts/auth (see §5a above), a real database, real file storage for photos.
- **Known prototype gotcha (not relevant post-rebuild):** a viewer shared as "Commenter" can read shared data but silently can't write it — looked like a sync bug, was actually a sharing-role issue. Rebuild's own auth model won't have this failure mode, but the underlying lesson stands: **surface write failures visibly, never fail silently** (this bit us twice during validation).
- **Sessions per day is configurable** (default 1, adjustable 1–5 in the prototype's settings). Reaching the daily target is a soft goal, not a hard cap — extra sessions beyond it are still allowed and logged as bonus sessions. Each day's sessions are numbered and tracked as separate entries (not overwritten), keyed by date + session number.
- Streak/heat-grid "day done" logic counts a day as complete once **at least one** session was logged that day, regardless of the configured target — kept intentionally simple rather than re-deriving the target that was in effect on a past day.
- **Confirmed gap, explicitly deferred to the rebuild (not the prototype):** sessions saved while a viewer lacked write access (e.g. was a Commenter) are stuck on that device with no "push this up now" retry. The rebuild's own auth model should avoid this failure mode entirely rather than needing a fix for it.
- **No data-retention/pruning policy for photos, rebuild requirement:** the shared photo store isn't unbounded — a year of daily photos (potentially several a day once multi-session/day is used) will eventually need a retention or archiving strategy (e.g. auto-downscale or archive photos past N months, or a parent-facing "delete old photos" control). Not urgent at family scale, but a real cost/scale concern once this serves paying subscribers.

## 6. Safety / privacy on photo upload

Two-layer design, **both must run before any photo reaches a cloud AI service**:

1. **On-device OCR phrase-match gate**: run OCR locally (e.g. Tesseract.js) on the photo, check whether it contains a recognizable fragment of *this session's* dictated passage. If no match → reject upload before it ever leaves the device. (Checking for the specific dictated phrase is a much stronger, lower-false-positive signal than generic "is this handwriting" image classification.)
2. **On-device face/person-presence gate**: separate from #1 — a photo can genuinely contain the right dictated text *and* also have a face/person in frame (e.g. reflection, someone walking by). Block upload if a face is detected, even when the OCR gate passes.
3. **Disclaimer, shown at the upload step**: photo analysis uses a free-tier AI service that may use uploaded images to improve its models; users should only photograph their practice page, never people or personal documents. *(This part is already live in the prototype as plain copy — see below.)*

**Not implementable in the Claude Artifact prototype**: real on-device OCR libraries (Tesseract.js) need to fetch several MB of WASM engine + trained-language-data at runtime, which the artifact's sandbox blocks for any external host. Same story for reliable on-device face detection (inconsistent browser API support). Both are a non-issue in a normal web app — **build these in the rebuild, not the prototype.**

Be explicit in any privacy copy that these are best-effort technical filters, not a guarantee — the disclaimer is the primary safeguard, the on-device gates are a backstop.

## 7. AI backend choice

- **Prototype (now)**: Claude's `sample` capability — free to the developer (spends the viewer's own Claude usage), but only works inside a Claude Artifact.
- **Rebuild (production)**: Google's Gemini/Gemma API.
  - Gemma 3 supports image input and is **free on Google AI Studio** ($0/token) — good for early development/testing.
  - **Caveat**: free-tier content may be used to train/improve Google's models — acceptable for solo dev testing, **not acceptable once other people's children's photos are involved**. Production must use the **paid tier**, which carries data-privacy guarantees (no training on customer data) and is inexpensive at this volume.

**If a native mobile app is built later** (see §8 — not a day-one requirement), there are two viable AI architectures, confirmed current as of Sept 2026:
1. **Cloud API call** — the mobile app calls Gemini/Gemma the same way the web backend does. Zero new AI architecture; the mobile app is just another client. This is the default if the mobile step turns out to just be the web app wrapped in a native shell (Capacitor, React Native WebView).
2. **On-device inference** — Google's **Gemma 4** (released April 2026) ships **E2B/E4B "edge" models** built for phones, natively multimodal (text, image, audio) — the right shape for reading a handwriting photo with nothing leaving the device. Current runtime is **LiteRT-LM** (Google's recommended framework as of this writing — the older "MediaPipe LLM Inference API" is now deprecated, so don't build against that). Real tradeoffs: needs a reasonably capable phone, a bundled/downloaded model file, and — unverified for this specific task — an open question of whether an edge model's judgment on nuanced handwriting legibility/accuracy matches the full cloud model's quality.

**Recommendation**: start with the cloud-API approach (option 1) for any mobile work, since it's already what the web backend does. Treat on-device Gemma (option 2) as a possible *later* enhancement once there's real evidence the cloud version's quality is good enough to try to match on-device — not something to build day one.

## 8. Platform & distribution

- **Decided for now: web app first — no Play Store, no App Store, no browser extension at launch.** A native mobile app remains a possible *later* step (see the AI-architecture note in §7 above for how that would work), contingent on the web version validating real demand — not ruled out permanently, just not the near-term plan.
- **Not a Chrome extension**: Chrome for Android has no extension support on phones or tablets (confirmed as of Aug 2026) — would lose mobile entirely, which is very likely how this gets used day to day.
- Rebuild as a normal cross-platform web app (Next.js or similar) hosted on Vercel, source on GitHub, running on the Gemma model (§7).
- TTS: Web Speech API is fine for a web app — no native rewrite needed since there's no native app planned.

## 9. Monetization

- Subscription model (recurring, per family/student) — chosen over one-time purchase or ad-supported.
- Cost model must account for: Gemini/Gemma API calls per session, photo storage, hosting. Price needs to cover these plus margin.
- Being web-only simplifies this: no app-store cut (15–30%) to plan around, but also no Play Billing/StoreKit subscription plumbing to lean on — needs its own payment integration (e.g. Stripe).

## 10. Compliance (required before any public/non-family distribution)

- This product handles a minor's photos and AI-generated assessments of a minor — needs a real privacy policy, data-deletion flow, and parental-consent mechanism before it's used by anyone outside the immediate family.
- Relevant frameworks depending on audience: COPPA (US, <13), UK Age Appropriate Design Code (covers under-18s). These apply to any public web service collecting minors' data — being web-only (§8) doesn't exempt the product from them, it only removes the *additional* app-store-specific policies (e.g. Google Play Families Policy no longer applies since there's no Play Store listing).
- Free-tier AI training-data usage (§7) is itself a privacy/compliance issue once other people's data is involved, not just a cost question — this is why production must use Gemini/Gemma's paid tier, not the free one.

## 11. Open questions (not yet decided)

- Target market framing: is this "dictée" (accuracy-first, French-pedagogy-style) or a general handwriting-fluency/OT-adjacent tool? Affects content, marketing, and buyer.
- Exact subscription price and what's gated behind it.
- Whether to eventually build a native mobile app once the web version validates demand, and if so, cloud-API vs. on-device Gemma inference (see §7/§8) — not decided, just no longer ruled out.
- Single-child vs. multi-child/family account support — the prototype is single-child by design; multi-child would need real user accounts and per-child data separation, which is a rebuild-phase concern, not a prototype one.

## 12. Validation status

Currently mid-validation using real usage (son's actual daily practice) on the Claude Artifact prototype. Fixed/added so far during this phase:
- Silent legibility/accuracy failures now show explicit status messages instead of just not appearing.
- Broken photo thumbnails fall back gracefully instead of showing broken-image icons.
- A local-storage-unavailable warning surfaces if on-device persistence silently isn't working.
- Words-per-minute metric, the trends dashboard, configurable sessions-per-day, and a visible "keep this open" progress cue during AI review are all now live.
- Content bank expanded from 18 to 33 passages.
- A plain-language privacy disclaimer now shows at the photo-upload step.

Also added: a delete affordance on each log entry (with an inline confirm/cancel, deletes local storage, the shared db doc, and the underlying photo asset when synced), and real accessible controls for the passage/punctuation toggles and the sessions-per-day stepper (proper `<button>`/`role="switch"` elements with labels, reachable by keyboard and announced correctly by screen readers — previously plain clickable divs).

Still open for the prototype phase: retroactive sync for local-only sessions (explicitly deferred to the rebuild, §5), and further content growth.

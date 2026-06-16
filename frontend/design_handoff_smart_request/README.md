# Handoff: SERVI Smart Request — AI Booking Flow

## Overview

This package is the **Smart Request** feature for the SERVI on-demand home-services
platform. It is an AI-powered booking panel that replaces the legacy 3-step request
modal as the primary booking entry point.

The goal: a user opens the panel, describes (or shows, or records) what they need in
**one step**, and SERVI's intelligence maps it to the right service, infers urgency and
schedule, asks 1–3 smart follow-up questions, and submits to the same
`POST /api/service-requests` endpoint that the existing booking flow already uses.

---

## About the Design Files

The files in this bundle are **high-fidelity HTML/CSS/JS prototypes** created as design
references — they are not production code to ship directly. The HTML prototype is
**fully functional and verified** (all four input modes, AI parse, submit payload), but
it uses a sandboxed Claude helper for the LLM call that does **not** exist in the real
site. That swap point is isolated and documented below.

**Your task:** the prototype is already vanilla JS and matches the SERVI site's
architecture almost exactly. The work is:
1. Copy the 5 source files into the frontend repo.
2. Add 2–3 `<script>` / `<link>` tags to the page that will host the flow.
3. Wire the 3 optional global hooks (`CONFIG.API_BASE`, `__user`, `__serviJsonAuthHeaders`).
4. Add a backend route `POST /api/parse-request` that proxies the LLM call
   (keeps your API key server-side).
5. Optionally: add `POST /api/parse-media` for real voice (STT) and photo (vision) analysis.

That's it. The design, all states, and the full submit payload are production-ready.

---

## Fidelity

**High-fidelity.** Every screen is pixel-complete:
- Exact SERVI design tokens from `landing-theme.css` (colors, type, spacing, radii, shadows)
- Marketing font pairing: **Outfit** (display/headings) + **Plus Jakarta Sans** (body/UI)
- Component styles (`sr-styles.css`) are built entirely on `var(--servi-teal)`,
  `var(--ink-800)`, `var(--border-input)`, `var(--text-primary)`, etc. — the same
  tokens your existing site uses. They will inherit naturally once the token stylesheet
  is loaded.

---

## Architecture

The feature is a **single-page state machine** mounted into `<div id="sr-root">`.
Three phases:

```
COMPOSE  →  (AI analyze, ~850ms)  →  BUILD  →  (submit)  →  SUCCESS
```

State is a plain JS object (`S`). Every interaction mutates one field and calls
`render()`, which replaces `root.innerHTML` and re-attaches delegated listeners. No
virtual DOM — just clean string templates.

**File responsibilities:**

| File | What it does |
|---|---|
| `catalog.js` | Full SERVI service catalog (5 categories, 22 subcategories, ~140 example services, keywords for matching, follow-up questions). Shared with the AI parse engine. |
| `parse.js` | Intelligence layer. `serviParse(text)` → AI primary, heuristic fallback. `serviAnalyzeVoice()` → transcript-based AI. `serviAnalyzePhotos()` → caption-based AI. `serviAnalyzeVideo()` → Wizard-of-Oz (admin review). |
| `sr-icons.js` | Inline SVG icon strings. Feather/Lucide-style, 1.7px stroke, `currentColor`. |
| `sr-styles.css` | All CSS: layout, component primitives (`.sr-btn`, `.sr-iconbtn`, `.sr-badge`, `.sr-radio`, `.sr-modal`), compose box, capture panels, build dashboard, success. Token-based. |
| `sr-app.js` | The app: state, render functions for every phase/component, all event handlers (via `data-action` delegation), recorder logic, file picker, submit with real `fetch`. |

---

## Screens

### 1 · Compose (phase: `'compose'`)

The entry point. A prompt box + four mutually-exclusive input modes.

**Layout (max-width: 660px, centered, top padding clamp(36px,6vh,72px)):**
```
[SERVI Intelligence] eyebrow (spark icon + uppercase label)
[What do you need done?] H1 — Outfit 800, clamp(32px,4.6vw,46px), tracking -0.025em
[Subtitle] — Plus Jakarta Sans 17px, color --text-secondary
[Prompt box] — 20px radius, 1.5px border --border-input, white bg
  [textarea] 17px body, min-height 92px, no resize
  [attachment thumbnail row] — only when text mode + photos attached
  [bottom bar]
    left: [+] IconButton outline + "Attach photos (optional)" hint
    right: [→] IconButton solid/accent (accent when text present)
[Or request another way] label — 12.5px, --text-muted
[3 mode tiles] — CSS grid 3-col / 1-col on mobile
[Browse escape hatch] — centered row, muted label + grid icon link
```

**Mode tiles:**

| Mode | Icon | Label | Sub |
|---|---|---|---|
| `video` | Video | Record a video | Show the problem |
| `photos` | Camera | Add photos | Snap or upload |
| `voice` | Mic | Voice note | Say it out loud |

Active tile: `border-color: --servi-teal`, `background: --servi-teal-tint`.

**Prompt box focus ring:** `border-color: --servi-teal`, `box-shadow: 0 0 0 4px --servi-teal-tint`.

**User can only attach photos in text mode.** Other modes are mutually exclusive — switching clears text/atts/media/rec state.

**Text submit:** Enter key (no shift) or the → button. Button is disabled/solid when empty, accent (teal) when text is present.

---

### 2 · Compose — Voice mode

Activated by clicking the Voice tile. Shows inside the prompt box (`.sr-box--media`).

```
[← Back to typing] link
[Capture panel]
  IDLE:
    [84px circular mic button] — ink-800 bg, white icon
    [idle waveform row] — 28 bars, 4px wide, --border color, scaleY(0.2)
    "Tap to record · up to {limit}s" hint

  RECORDING:
    [84px circular mic button] — --servi-teal bg, STOP icon, sr-pulse animation
    [live waveform row] — bars animate to real mic input (fallback: simulated)
    [red dot] ● [elapsed / limit] — tabular-nums, fontWeight 700

  DONE:
    [mini player row] — [►] play btn (teal circle) + static waveform + duration
    [Re-record] ghost button  [Use this recording →] accent button
    "SERVI will transcribe and understand your note…" note
```

**Real mic:** `getUserMedia({ audio:true })` → AnalyserNode → 28-bar amplitude viz.
**Iframe/denied fallback:** simulated waveform (random bars every 90ms).
**Voice limit:** `SETTINGS.voiceLimit` (default 60s), configurable in Settings modal.
**On "Use this recording":** `serviAnalyzeVoice({})` → build phase (no follow-ups).

---

### 3 · Compose — Photos mode

```
[← Back to typing]
  EMPTY STATE:
    [52px rounded icon box] teal-tint bg, camera icon
    "Take or upload photos of the problem"
    [Choose photos] + [Try a sample] buttons
    Note: "SERVI reads your photos…"

  HAS PHOTOS (up to 5):
    [76×76px thumb grid] — 12px radius, img or placeholder
    [+ add more thumb] — dashed border, shows when <5
    [Continue with N photo(s) →] accent button
```

User-uploaded photos become object URLs. **Only one sample available for demo; in
production swap with a real attachment upload before calling the analyze endpoint.**

**On continue:** `serviAnalyzePhotos({})` → build phase (no follow-ups).

---

### 4 · Compose — Video mode

```
  EMPTY STATE:
    [52px icon box] video icon
    "Record or upload a short video"
    [Upload video]  [Record now]
    "Our specialists review your clip…"

  RECORDING (90s limit):
    ● [elapsed / 90:00] large
    "Describe what you need while you film it."
    [Stop recording] accent button

  HAS VIDEO:
    [76×76px thumb] video icon + duration
    [Continue with video →] accent button
```

**On continue:** `serviAnalyzeVideo()` → build phase. Returns `adminReview:true` —
shows "Video received" card. **No AI parsing. No follow-up questions.** Admin team
reviews the clip in Ops dashboard; any missing info gathered via WhatsApp.

---

### 5 · Build — "Here's what I understood" (text / voice / photos)

Left pane, full width below 920px. Appears after the AI analyze completes.

**Thinking shimmer (during AI call):**
```
[spinning spark icon] "Reading your request…" / "Listening…" / "Looking at photos…"
[3 loading bars] — teal scanner animation
```

**Understanding card** (`.sr-understand`):
```
[emoji badge]  [eyebrow: ★ HERE'S WHAT I UNDERSTOOD  [N% MATCH badge]]
               [Service name bold 19px Outfit]
               [Subcategory · Category — 13.5px muted]
"Summary text in italics" — 14.5px
[transcript/caption disclosure] — gray surface box, 13px (voice/photos only)
[← Not quite? Change service] teal link → service picker modal
```

Badge color: `accent` (teal) if confidence ≥ 70%, `pending` (amber) if < 70%.

**Follow-ups card** (text mode only, 1–3 questions with chips OR free-text):
```
"A few quick details"  [Optional — helps your specialist arrive ready]
  For each question:
    Q text 14px bold
    [chip row] — pill buttons, active chip: ink-800 bg/white text
    OR: text input
```

**When & Where card:**
```
[ASAP radio row]  — bolt icon, "As soon as possible"
[Schedule radio]  — calendar icon, "Schedule for later"
  If schedule: [date input] [time input] — side by side
[Service address label]
[address input] [📍 current-location button]
```

RadioOption selected state: `border-color: --servi-teal`, `background: --servi-teal-tint`.

---

### 6 · Build — Media received (video)

Replaces understanding card when `mode === 'video'`:
```
[teal-bordered icon box with video icon]  [✓ REQUEST CAPTURED eyebrow]
                                          [Video received bold]
"Our specialists will review your clip…" — italic
```
No follow-ups. When & Where always shown.

---

### 7 · Build — Right rail (sticky ≥ 920px)

```
[Your request summary card] — --surface-2 bg, 16px radius
  emoji • "Your request"
  Row grid (74px label, 1fr value):
    Service | Category (optional) | Details (if answers) | When | Where

[What happens next card]
  "What happens next"  [⏱ Usually within ~15 min badge]
  Numbered steps:
    1. We match your specialist  (users icon)
    2. We confirm the price      (tag icon)
    3. We reach out on WhatsApp  (whatsapp icon)
  [shield icon] "Verified specialists · Price confirmed…"

[Send request →] accent lg block button (disabled if address empty + when=schedule+no date)
[fine print: "You won't be charged now. We confirm the price before anything happens."]
```

---

### 8 · Build — Service picker modal

Opens on "Not quite? Change service":
```
[Category pills] — 5 cats, active: ink-800 bg
[Subcategory groups] each with label + service buttons
  Service buttons: selected = teal border/tint + check icon
```
Clicking a service: updates req.service, closes modal, re-renders.

---

### 9 · Success

```
[76px check circle] — rgba(40,167,69,.12) bg, --success green icon
"Request sent" — Outfit 800 30px
"We'll text you on WhatsApp shortly to confirm your specialist and the price."
[SV-NNNNNN request card] — surface-2 bg, rows: Request | When | Where
[Open WhatsApp chat →] accent button
[New request] secondary button
```

---

## Interactions & Behavior

| Trigger | Behavior |
|---|---|
| Mode tile click | Switches input mode; clears text/media/rec state; re-renders compose box |
| Textarea Enter (no shift) | Submits text request |
| Textarea input | Updates `S.text`; toggles send button disabled/accent without full re-render |
| Send text | Runs `serviParse(text)` → thinking → build (≥850ms feel) |
| Voice: record / stop | Starts/stops MediaRecorder + waveform; 'done' state shows playback row |
| Voice: use recording | `serviAnalyzeVoice({})` → build (no follow-ups) |
| Photos: upload | Native file picker → object URLs → thumbnail row |
| Photos: continue | `serviAnalyzePhotos({})` → build (no follow-ups) |
| Video: record | Timer-based recorder (no actual stream in design) → stop → video thumb |
| Video: continue | `serviAnalyzeVideo()` → build → "Video received" card |
| Chip click | Toggles `S.answers[key]`; re-renders only the follow-ups card |
| ASAP/Schedule toggle | Updates `S.when`; re-renders when/where card; clears date if asap |
| "Use current location" | Simulates geolocation lookup (900ms) → fills address input |
| "Not quite? Change service" | Opens service picker modal |
| Service picker: pick | Updates `S.req`, clears answers, closes modal, re-renders |
| "Edit request" | `reset()` → back to compose |
| Submit | Validates (address + date-if-scheduled) → `POST /api/service-requests` → success |
| Settings ⚙︎ | Opens modal: engine / layout / voice-limit / next-steps toggles, persisted to `localStorage['sr_settings']` |
| Escape key | Closes any open modal |

**Transitions:** `.sr-fade-in` is a transform-only entrance (translateY(10px)→0, 380ms spring easing `cubic-bezier(0.16,1,0.3,1)`) applied to each phase container and the understanding/card elements on first render. Modal slide-up: 320ms same easing. Recording pulse: `sr-pulse` box-shadow animation 1.6s. Thinking bars: `sr-load` shimmer 1.1s staggered.

---

## State Management

```js
S = {
  phase:    'compose' | 'build' | 'success',
  mode:     'text' | 'voice' | 'photos' | 'video',
  text:     String,                // textarea value
  atts:     [{url, sample}],       // photos attached to a text request
  media:    [{kind, url, dur, sample}], // captured voice/photos/video items
  thinking: Boolean,               // AI parse in-flight
  req: {
    category, categoryLabel, emoji,
    subKey, subLabel, service,
    summary, confidence, urgency,
    inferredDate, inferredDateLabel,
    followups: [{q, key, chips}],
    source,
    transcript?,   // voice mode
    caption?,      // photo mode
    adminReview?,  // video mode
  },
  answers: { [key]: String },      // follow-up chip/text answers
  when:     'asap' | 'schedule',
  date:     String,                // YYYY-MM-DD
  time:     String,                // HH:MM
  dateLabel: String,               // human-readable detected date
  address:  String,
  rec:      null | { phase, elapsed, timer, t0 }, // recorder transients
}
```

Settings are persisted to `localStorage['sr_settings']`:
```js
SETTINGS = { engine: 'ai'|'heuristic', voiceLimit: 60, twoPane: true, showNext: true }
```

---

## The Submit Payload (Production)

POST `{CONFIG.API_BASE}/api/service-requests` — **same endpoint, same fields as the
existing `submitBooking()`.** No backend change needed to start receiving requests.

```js
{
  // ── existing fields (mirrors submitBooking exactly) ──
  category,          // e.g. 'repair', 'cleaning', 'custom'
  description,       // text request / AI summary / voice transcript
  preferredDate,     // YYYY-MM-DD or null
  preferredTime,     // HH:MM or null
  isAsap,            // boolean
  serviceAddress,
  clientName, clientPhone, clientEmail,  // from window.__user
  lang,                                  // from window.lang()
  attachments,       // [url, ...]  — from /api/uploads

  // ── additive SERVI Intelligence metadata (store for Ops dispatch) ──
  requestMode,       // 'text'|'voice'|'photos'|'video'
  matchedService,    // 'Sink or drain unclogging'
  matchedSubKey,     // 'plumbing'
  aiSummary,         // one-line restatement
  aiConfidence,      // 0..1
  aiSource,          // 'ai'|'heuristic'|'voice-ai'|'photo-ai'|'video-review'
  detailAnswers,     // { fixture:'Sink', severity:'Yes, actively' }
}
```

Attachments still go through your existing `POST /api/uploads → {url, mimetype}`. In
`sr-app.js`, the `pickFiles` callbacks currently make object URLs; replace those with
calls to `uploadAttachment(file)` and push the returned `{url}` into `S.atts`/`S.media`.

---

## Backend Endpoints to Add

### `POST /api/parse-request` (text AI — required for real AI)
**Why:** the browser must never hold an API key. This proxies the parse call.

Request body:
```json
{ "text": "My kitchen sink is clogged and water is backing up" }
```

Response: the parse object shape (same as `serviParse` returns):
```json
{
  "category": "repair", "categoryLabel": "Repair & Maintenance", "emoji": "🔧",
  "subKey": "plumbing", "subLabel": "Plumbing",
  "service": "Sink or drain unclogging",
  "summary": "Clogged kitchen sink, backing up.",
  "confidence": 0.95,
  "urgency": "asap",
  "inferredDate": null, "inferredDateLabel": null,
  "followups": [
    { "q": "Which fixture is affected?", "key": "fixture", "chips": ["Sink","Toilet","Shower","Pipes"] },
    { "q": "Is water leaking right now?", "key": "severity", "chips": ["Yes, actively","A little","No"] }
  ],
  "source": "ai"
}
```

Implementation: call Claude / GPT with the grounded catalog prompt in `parse.js → ai(text)`.
Extract the same prompt string and run it on your backend. Swap point in `parse.js`:

```js
// In the ai(text) function, replace the window.claude.complete call with:
const res = await fetch(API_BASE + '/api/parse-request', {
  method: 'POST', headers: jsonHeaders,
  body: JSON.stringify({ text })
});
return await res.json();
```

The heuristic fallback in `parse.js` remains client-side and requires no backend.

---

### `POST /api/parse-media` (voice STT + photo vision — Phase 2)

#### Voice
Request: `multipart/form-data` with `audio` file + `kind: 'voice'`
Backend: STT (Whisper / Deepgram / Google) → transcript string → run same parse logic → return parse object + `transcript` field.

Replace in `parse.js → callMediaBackend()`:
```js
if (kind === 'voice') {
  const fd = new FormData(); fd.append('audio', payload.audioBlob); fd.append('kind', 'voice');
  const res = await fetch(API_BASE + '/api/parse-media', { method:'POST', body: fd });
  return await res.json();   // includes transcript, same parse shape
}
```

#### Photos
Request: `multipart/form-data` with `images[]` + `kind: 'photos'`
Backend: vision model (Claude Vision / GPT-4o) → describe/diagnose → parse logic → return parse object + `caption` field.

Both return the same object shape as text parse — the UI renders identically.

---

## Design Tokens

All defined in `landing-theme.css` / `shared-styles.css` / the SERVI design system.
`sr-styles.css` references these via `var(--*)` — no values need to be hardcoded.

| Token | Value | Used for |
|---|---|---|
| `--servi-teal` | `#95CCD5` | Accent — CTA, selected states, focus ring |
| `--servi-teal-deep` | `#74B8C4` | Hover on teal, location icon |
| `--servi-teal-tint` | `#e8f4f6` | Teal bg tint — selected tiles, understanding card |
| `--servi-teal-deeper` | `#4a8893` | Text on teal tint |
| `--servi-teal-glow` | `rgba(149,204,213,.7)` | Teal button hover shadow |
| `--ink-800` | `#111` | Primary button bg, default text, chip active |
| `--text-primary` | `#111` | Body text |
| `--text-secondary` | `#555` | Secondary labels |
| `--text-muted` | `#888` | Hints, eyebrows |
| `--border-soft` | `#eee` | Card borders |
| `--border-input` | `#d4d4d4` | Input/tile borders |
| `--surface` | `#f0f0f0` | Icon bg, chip bg |
| `--surface-2` | `#f5f5f5` | Summary rail, success card |
| `--success` | `#28A745` | Success check icon |
| `--danger` | `#DC3545` | Recording dot |
| `--radius-md` | `12px` | Buttons, inputs |
| `--radius-lg` | `24px` | Modals |
| `--radius-pill` | `999px` | Badges, chips |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.06)` | Prompt box resting |
| `--font-display` | `'Outfit', sans-serif` | H1, titles, section heads |
| `--font-body` | `'Plus Jakarta Sans', sans-serif` | All UI / body |

---

## Assets

- **Inline SVG icons** — all shipped in `sr-icons.js` as strings. Feather/Lucide style,
  1.7px stroke, round caps, `currentColor`. 25 icons total.
- **No images** — the design uses no photography or illustrations.
- **SERVI logo wordmark** — uses `.servi-logo` + `.servi-logo__dot` from `base.css`
  (part of the existing token stylesheet). Font: Syne 800.

---

## Files in this Handoff

```
app/catalog.js      Service catalog — copy into repo, load as <script>
app/parse.js        Intelligence engine — copy, load as <script>
app/sr-icons.js     Icon strings — copy, load as <script>
app/sr-styles.css   All styles — copy, load as <link>
app/sr-app.js       The app — copy, load as <script> (last, after the above)

SERVI Smart Request.html    Reference page — open in browser to see the design
SERVI-INTEGRATION.md        Quick integration reference (§2–§5 covers wiring)
```

**Load order on the target page:**
```html
<!-- 1. SERVI design tokens (already on the page for any marketing page) -->
<!-- shared/landing-theme.css or shared/shared-styles.css -->

<!-- 2. Smart Request styles -->
<link rel="stylesheet" href="/smart-request/sr-styles.css">

<!-- 3. Data + intelligence (no deps) -->
<script src="/smart-request/catalog.js"></script>
<script src="/smart-request/parse.js"></script>

<!-- 4. UI (needs catalog + parse) -->
<script src="/smart-request/sr-icons.js"></script>
<script src="/smart-request/sr-app.js"></script>

<!-- 5. Mount point (anywhere in the body) -->
<div id="sr-root"></div>
```

---

## Implementation Checklist

- [ ] Copy 5 files into `frontend/smart-request/`
- [ ] Add `<link>` + `<script>` tags to `request.html` (or replace booking modal mount)
- [ ] Verify token CSS variables resolve (load `landing-theme.css` if not already)
- [ ] Wire `uploadAttachment(file)` for real attachment uploads (replace object URLs)
- [ ] Add `POST /api/parse-request` backend route (proxies LLM call)
- [ ] Update `parse.js → ai()` to call `/api/parse-request` instead of `window.claude`
- [ ] (Phase 2) Add `POST /api/parse-media` for voice STT
- [ ] (Phase 2) Add `POST /api/parse-media` for photo vision
- [ ] Test auth gate: confirm `window.__user` is set before submit reaches the endpoint
- [ ] Remove or hide the ⚙︎ Settings button for production (optional)
- [ ] Add `window.getDashAddress()` binding if address persistence is needed
- [ ] Verify Spanish copy (add ES strings to `i18n.js` + bind to `window.lang()`)

# SERVI Smart Request — Integration Guide

A drop-in **AI booking flow** that sits *alongside* the existing `dash-hero__left`
panel (which is **not touched**). It replaces the legacy 3-step booking modal as the
primary way to request a service.

It is plain **vanilla JS + CSS** — no React, no build step — so it matches the rest
of the SERVI site and pastes straight into your repo.

---

## 1 · Files

```
app/
  catalog.js     SERVI service catalog (grounds the AI + powers the offline fallback)
  parse.js       the "intelligence": text parse + voice/photo analysis + video review
  sr-icons.js    inline SVG icon set
  sr-styles.css  all styles (built on the SERVI design tokens)
  sr-app.js      the UI + state machine + production-shaped submit
SERVI Smart Request.html   reference page that loads the above
```

In your repo these become (suggested):

```
frontend/
  smart-request/
    catalog.js
    parse.js
    sr-icons.js
    sr-styles.css
    sr-app.js
```

> The `SERVI Smart Request (React reference).html` file is **design reference only** —
> do not ship it. It's the original prototype that this vanilla version reproduces.

---

## 2 · Wiring it into a page

The flow mounts into one element: `<div id="sr-root"></div>`.

**Option A — its own route** (`request.html`): add the markup + scripts to a page that
already loads your tokens (`landing-theme.css` / `shared-styles.css` give you the same
`--servi-*`, `--ink-*`, `--text-*`, `--border-*`, `--surface*` CSS variables this uses).

```html
<div id="sr-root"></div>

<link rel="stylesheet" href="/smart-request/sr-styles.css">
<script src="/smart-request/catalog.js"></script>
<script src="/smart-request/parse.js"></script>
<script src="/smart-request/sr-icons.js"></script>
<script src="/smart-request/sr-app.js"></script>
```

**Option B — replace the legacy booking modal**: render `#sr-root` inside your existing
booking modal container instead of calling `renderBooking()`. Keep `dash-hero__left`
exactly as-is; point its "send / submit" handoff at this flow instead of the 3-step.

The styles are namespaced under `.sr-*`, so they won't collide with your existing CSS.

---

## 3 · Hooks it uses (all optional)

`sr-app.js` auto-detects these globals you already have. If absent, it runs standalone.

| Hook | Used for | If missing |
|---|---|---|
| `window.CONFIG.API_BASE` | base URL for submit/upload | submit logs payload + shows success (demo) |
| `window.__user` `{name,phone,email}` | fills client fields | sent empty (backend can fill from session) |
| `window.__serviJsonAuthHeaders()` | auth headers on POST | falls back to `{'Content-Type':'application/json'}` |
| `window.getDashAddress()` | prefill saved address | defaults to "Santa Fe, CDMX" |
| `window.openAuthModal('login')` | auth gate before submit | skipped |
| `window.lang()` | `lang` field in payload | defaults to `'en'` |

**Auth gate:** today the file submits directly. To require login (like `submitBooking`),
uncomment/adjust the guard at the top of `submit()` in `sr-app.js`.

---

## 4 · The submit payload

On **Send request**, `sr-app.js` POSTs to **`{API_BASE}/api/service-requests`** — the
*same endpoint and field names* your current `submitBooking()` uses, so **no backend
change is required** to start receiving Smart Requests:

```js
{
  category, description, preferredDate, preferredTime, isAsap,
  serviceAddress, clientName, clientPhone, clientEmail, lang,
  attachments: [url, ...],

  // ── additive "SERVI Intelligence" metadata (safe to ignore or store) ──
  requestMode,      // 'text' | 'voice' | 'photos' | 'video'
  matchedService,   // e.g. "Sink or drain unclogging"
  matchedSubKey,    // e.g. "plumbing"
  aiSummary,        // one-line restatement
  aiConfidence,     // 0..1
  aiSource,         // 'ai' | 'heuristic' | 'voice-ai' | 'photo-ai' | 'video-review'
  detailAnswers,    // { fixture:'Sink', severity:'Yes, actively' }
}
```

The extra fields give your Ops dashboard instant dispatch context (what, which category,
how confident, captured details). Add the columns when you're ready — they're optional.

**Attachments** still go through your existing `POST /api/uploads` → `{url, mimetype}`
contract. In this prototype the captured files use local object URLs; in production wire
the file inputs in `sr-app.js` (`pickFiles` callbacks) to your `uploadAttachment(file)`
and push the returned `url` into `S.atts` / `S.media`.

---

## 5 · The AI — what's real vs. what to wire

### Text (works today, client-side)
`parse.js → window.serviParse(text)` calls an LLM, **grounded by `catalog.js`**, and
returns the matched service + smart follow-ups + inferred schedule. **AI is primary;
the keyword heuristic is the automatic fallback** on any error/timeout, and can be
forced offline (Settings → Heuristic).

> ⚠️ In this prototype the LLM call uses the preview's built-in helper. **In production
> you must route it through your backend** so your API key is never in the browser:

```js
// parse.js → replace the body of ai(text) with:
const res = await fetch(API_BASE + '/api/parse-request', {
  method: 'POST', headers: jsonHeaders,
  body: JSON.stringify({ text, catalog: /* server already has it */ })
});
return await res.json();   // same shape the function returns now
```

Cost on a small/fast model (e.g. Claude Haiku): roughly **$0.0002–0.002 per request** —
negligible. Keep the heuristic fallback so a request is never blocked.

### Voice → multimodal AI (wire one endpoint)
`window.serviAnalyzeVoice({})` runs the **same "Here's what I understood" flow**. In the
prototype it analyzes a sample transcript; in production:

```js
// 1. record audio (sr-app.js already captures it)
// 2. POST the blob to your backend:  /api/parse-media  (kind: 'voice')
// 3. backend: speech-to-text  →  feed transcript into the SAME text parser
// 4. return the parse object (+ transcript) — the UI renders it unchanged
```

### Photos → multimodal AI (wire one endpoint)
`window.serviAnalyzePhotos({})` — same idea with a **vision** model:

```js
// POST image url(s) to /api/parse-media (kind: 'photos')
// backend: vision model describes/diagnoses → text parser → return parse object
```

Both swap points are isolated in `parse.js → callMediaBackend()` — replace its body with
your `fetch` and the whole UI keeps working.

### Video → Wizard-of-Oz (no AI needed)
`window.serviAnalyzeVideo()` intentionally does **not** call AI. It shows an AI-style
"processing" beat, then a **"Video received — our specialists will review your clip"**
card. The video is dispatched to your Ops team (`requestMode:'video'`) and any missing
detail is gathered over WhatsApp. Upgrade to real video analysis later with zero UI work.

---

## 6 · Settings / variations

The ⚙︎ button (top-right) opens a small panel to toggle: **parse engine** (AI ⇄
heuristic), **layout** (two-pane ⇄ single column), **voice limit**, and the **"What
happens next"** panel. Choices persist in `localStorage` (`sr_settings`). Remove the
`open-tweaks` button from `topbarHTML()` if you don't want it in production.

---

## 7 · Getting the files into your repo

Claude Design can't push to GitHub directly, so use one of these:

1. **Download** — I'll provide a download of the `app/` folder + the HTML; unzip into
   your project, adjust the paths in §2, commit in VS Code, and push.
2. **Handoff to Claude Code** — open this project in Claude Code and it can place the
   files and wire the hooks for you (ask me to prepare the handoff).

Either way the integration is: copy 5 files → add the `<script>`/`<link>` tags to a page
→ (optional) point your backend `/api/parse-request` + `/api/parse-media` endpoints at
your LLM. Nothing else in the SERVI site needs to change.

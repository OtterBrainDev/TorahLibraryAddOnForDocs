# AI Lesson Generator — design notes (deferred feature)

This document records the design of the AI lesson generator that was
developed on the rewrite branch, why it was detached from the shipped
v1 of the add-on, and what a future revival would look like. It is
written for two audiences: future maintainers of this repository, and
Sefaria.org engineers who may be the natural long-term home for a
Sefaria-grounded AI lesson feature.

The detached source files live under
[`reference/ai-lesson/`](../../reference/ai-lesson/); they are
excluded from `clasp push` and do not ship.

## 1. Intent

The feature was trying to solve a narrow, high-value problem for
teachers and adult learners who use Google Docs as their primary
drafting surface:

> Given a learning-cycle context (today's daf, this week's 929, this
> week's parashah) or a free-form topic, produce a structured lesson
> draft — an outline, key sources, key questions, discussion prompts —
> and insert it directly into the active Google Doc so the teacher can
> edit and publish from there.

Grounding in Sefaria is the distinguishing constraint: the LLM should
pull verses, commentaries, and halakhic references from Sefaria's
corpus rather than hallucinating references. The shipped prototype
handled this by passing a handful of Sefaria refs into the prompt as
pre-fetched text, then asking the model to cite them.

## 2. User workflow

1. User clicks *Generate Shiur Draft* from the add-on menu (or a
   Quick-Actions sub-item for the three learning cycles).
2. A dialog opens with presets for audience (adult / high-school /
   beginner / educators), style (interactive shiur / source-sheet
   chavruta / drash), duration (10–120 minutes), topic, and advanced
   controls for provider selection and API-key source.
3. The client calls a server function (`generateAiLessonDraft`) with
   the request payload.
4. The server assembles a prompt, calls the AI provider, parses the
   JSON response, optionally enriches it with Sefaria text for each
   cited ref, and inserts the rendered lesson into the document at
   the cursor.

The rendering contract in the detached reference is
`insertGeneratedLessonIntoDoc_` in
[`reference/ai-lesson/Code.gs.ai-block.ref`](../../reference/ai-lesson/Code.gs.ai-block.ref).

## 3. Route 1 — Merkaz gateway

**Architecture.** The Apps Script client never holds a provider API
key. It signs each request with HMAC-SHA256 over
`timestamp + nonce + body` against a shared secret stored in Script
Properties (admin-managed). A WordPress endpoint at
themerkaz.org verifies the signature, enforces a per-user
quota/cooldown, calls the AI provider server-side, and returns
structured lesson JSON.

Endpoints in the reference code:
- `POST /wp-json/merkaz/v1/ai/bootstrap` — capability probe,
  returns managed-provider availability and server-enforced cooldowns.
- `POST /wp-json/merkaz/v1/ai/lesson` — the main generation call.

Client identity is either `Session.getActiveUser().getEmail()` (the
`userinfo.email` OAuth scope, which was the deciding factor in
dropping the scope from `appsscript.json` when the feature was
detached) or `Session.getTemporaryActiveUserKey()` — opaque,
per-script, stable for the user-script pair but not cross-device.

**Pros.**
- No client-held credentials. The provider key never leaves the
  gateway's control; a compromised add-on installation cannot leak it.
- Centralized rate limiting, cost accounting, and auditing.
- Provider swaps and model-catalog updates ship without an add-on
  release cycle (no Google Marketplace re-review needed).
- A single place to apply content-safety filters — particularly
  important for a Jewish-learning context where model hallucinations
  of halakhic positions would be embarrassing at best.

**Cons.**
- Single-vendor dependency on Merkaz/WordPress uptime. Sidebar
  degrades gracefully; the AI feature becomes unavailable.
- Cost centralization. Whoever operates the gateway pays for all
  inference. This is why Route 4 (Sefaria-hosted) reads better.
- Operational burden: hosting, key rotation, abuse response,
  WordPress-plugin maintenance.
- User-identity choice is forced: either add the PII scope
  (`userinfo.email`, which triggers stricter Marketplace review) or
  use an opaque per-script key that breaks cross-device continuity
  for users who move between Docs on phone vs. desktop.

## 4. Route 3 — Ephemeral `CacheService` keys

**Architecture.** The user pastes their own provider API key into the
preferences pane. The key is written to
`CacheService.getUserCache().put(name, value, 21600)` — six hours is
the Apps Script ceiling for user-cache TTL. It is **never** written
to `PropertiesService`. On each AI call, the server reads the cache;
if the entry expired, the user is prompted to re-paste. All provider
adapters (`callOpenAiForLesson_`, `callAnthropicForLesson_`,
`callGeminiForLesson_`) remain client-side.

The primitive is the same one
`apps-script/Code.gs:getSidebarSessionState` already uses for
sidebar session state. That code survived the cleanup and is the
right pattern for any short-lived sensitive data in Apps Script.

**Pros.**
- No plaintext persistence anywhere. The worst-case leak window is
  six hours.
- User controls their own cost. Heavy users pay their own inference
  bills directly to the provider.
- No server-side infrastructure for the add-on author. Sefaria gets
  no new operational obligations.

**Cons.**
- Six-hour re-entry friction. A teacher who uses the feature once
  per weekly parasha session will re-paste a key every time.
- No cross-device sync. A user with a laptop and a tablet will have
  two separate cache entries.
- The cache is still readable by anything with execution access to
  the user's script — an attacker with an OAuth grant could read it.
  In practice this is most of what `PropertiesService` risk is too,
  but it's worth being explicit.
- Hardcoded model catalogs in the client age without an add-on
  release. When OpenAI renames a model, users see a 404 error.
- No central content-safety layer.
- Three provider adapters to maintain in the client-side code.

## 5. Why neither route shipped in v1

Route 1 required standing up and operating Merkaz's AI gateway
infrastructure with production-grade reliability, rate limiting,
observability, and abuse response. The add-on author could not
guarantee that operational commitment for a feature that would
otherwise degrade silently.

Route 3 could not cleanly resolve two risks: the model catalog would
rot in the shipped add-on (requiring Marketplace re-review for every
new model), and any single `.innerHTML` regression in the preferences
pane could expose a pasted key to injected script. The second is
particularly stark because Stage 5 of the cleanup plan is an
`.innerHTML` audit of the preferences client — there are still
unjustified writes there as of detachment.

The answer that emerged from these trade-offs is **Route 4**:

## 6. Route 4 — Sefaria-hosted gateway (the recommendation)

Sefaria is already the textual authority this feature depends on.
They run production infrastructure for their own API. A Sefaria-hosted
AI endpoint would:

- host a server-side gateway at (hypothetically)
  `https://www.sefaria.org/api/ai/lesson`, behind their existing
  Cloudflare / rate-limit stack;
- authenticate via a Sefaria account or a Google Workspace
  Marketplace-issued service token — no new credential for the
  add-on author to manage;
- apply the same content guidelines to AI output that Sefaria already
  applies to editorial content in their corpus;
- ground the generated references in Sefaria's own text tree, by
  construction.

The request/response schema proven by the Merkaz reference
implementation is worth carrying over as-is — it is reasonably minimal
and has already been exercised in testing. Shape:

```jsonc
// Request
{
  "clientId": "addon/torah-library-addon-for-docs",
  "userRef": "opaque-script-user-key-or-email",
  "context": { "type": "daf"|"929"|"parashah"|"topic", "topic": "…" },
  "audience": "Adult learners",
  "duration": 45,
  "lessonStyle": "Interactive shiur",
  "includeOriginal": true,
  "includeTranslation": true,
  "includeEducatorNotes": true,
  "includeDiscussionPrompts": true
}

// Response
{
  "success": true,
  "title": "…",
  "outline": [{ "heading": "…", "summary": "…", "refs": ["…"] }],
  "educatorNotes": "…",
  "discussionPrompts": ["…"]
}
```

## 7. Reference implementation index

The preserved source lives under `reference/ai-lesson/`:

| File | What's in it | Start reading with |
| ---- | ------------ | ------------------ |
| `AiLessonGateway.gs.ref` | Merkaz-gateway-signed HMAC client, `/bootstrap` and `/lesson` handlers, Quick-Actions menu dispatch. | `buildMerkazAiSignature_`, `callMerkazAiEndpoint_`. |
| `Code.gs.ai-block.ref` | Direct-provider adapters (OpenAI / Anthropic / Gemini), prompt construction, response parsing, Sefaria-text enrichment, document insertion, saved-key preference helpers. | `generateLessonDraftViaProvider_`, `buildLessonGenerationPrompt_`, `parseAiLessonJson_`, `insertGeneratedLessonIntoDoc_`. |
| `ai_lesson.html.ref` | The dialog entry template (Basic / Advanced tabs, audience/style/duration controls). | Walk top-to-bottom. |
| `ai-lesson-js.html.ref` | Dialog client-side logic (form state, provider/model selection, call to `generateAiLessonDraft`). | `onGenerateClick`. |
| `ai-lesson-css.html.ref` | Dialog styles. | — |

## 8. What to cut if reviving

If this feature is revived — here or upstream at Sefaria — the
following should be resolved before shipping:

1. **Drop the hardcoded `AI_PROVIDER_OPTIONS_` model list** in favor
   of a server-fed catalog. Hardcoded models go stale and provide
   an attack surface the server cannot cleanly gate.
2. **Replace `DocumentApp.getUi().alert(result.title)`** (in
   `runAiLessonQuickActionMenu_` in the gateway reference) with a
   fixed string. Model output must not control alert-dialog text.
3. **Pin the gateway base URL to an allowlist.** The current
   reference reads `MERKAZ_AI_BASE_URL` from Script Properties with
   no validation; a misconfigured property could redirect user
   prompts to an attacker endpoint.
4. **Never re-introduce `PropertiesService` writes for API keys.** If
   persistent storage is genuinely required, it belongs server-side
   bound to a real account, not on the client.
5. **Re-audit every `.innerHTML` write in the AI dialog.** The
   reference `ai-lesson-js.html.ref` has several that could surface
   model output directly to DOM; any revival should go through them
   with `textContent` or an HTML-sanitizer as the default.
6. **Drop the `userinfo.email` OAuth scope unless absolutely
   required.** Use `Session.getTemporaryActiveUserKey()` for
   identity if you can tolerate the cross-device limitation.
7. **Add a failure mode for expired cache keys** (if Route 3).
   Currently the user sees a 401 from the provider; what they should
   see is a "your pasted key expired; paste it again" prompt wired
   from the client side.

## 9. Status

Detached in the Stage 4 cleanup (see the branch commit
`Stage 4: detach AI feature`). The file-level markers:

- Removed from `apps-script/`: `AiLessonGateway.gs`, `ai_lesson.html`,
  `ai-lesson/*.html`, the AI block of `Code.gs` (~680 lines), AI
  preferences UI in `preferences.html` and `preferences/js.html`,
  AI menu items and mode-controller handlers.
- Scrubbed from `UserProperties` on upgrade by the v3 migration in
  `apps-script/migrations.gs`.
- Dropped from `apps-script/appsscript.json`: `userinfo.email`
  OAuth scope.
- Preserved under `reference/ai-lesson/` with banner comments noting
  the code is not wired into the shipped add-on.

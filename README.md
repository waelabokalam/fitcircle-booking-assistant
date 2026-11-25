# FitCircle Booking Assistant

A bilingual booking assistant for the Levare Lab internship exercise. The submission endpoint takes one message, extracts a structured request, and checks a seven-day mock schedule for five real Damascus venues. It returns a match, alternatives, or one clarifying question.

## Quick start

Requires Node.js 22.16 or newer with full ICU timezone data. Node runs the TypeScript source directly, with zero third-party packages.

Run `npm start`, then try the assignment endpoint in another terminal.

```sh
curl -s http://localhost:3000/api/booking -H 'Content-Type: application/json' \
  -d '{"message":"Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players."}'
```

The default `local` mode runs without credentials. See the ten test messages and their outcomes in [RESULTS.md](RESULTS.md) and [RESULTS_LIVE.md](RESULTS_LIVE.md).

### Enable actual LLM extraction

1. Obtain a Gemini API key using a supported account. Check that the chosen model and region are available to you.
2. Copy `.env.example` to `.env` and set:

```dotenv
EXTRACTION_MODE=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

3. Run `npm start`. The API reports `trace.source: gemini` after validating a provider response. The adapter calls Google's API with a structured output schema. Keep the API key in the server environment and use synthetic messages for this exercise. [generateContent REST API](https://ai.google.dev/api/generate-content) · [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

Gemini 3.5 Flash-Lite is the default model and uses explicit minimal thinking. The adapter uses a short extraction prompt and validates the structured response. Authentication, quota and evidence validation failures end the attempt immediately. [Gemini thinking settings](https://ai.google.dev/gemini-api/docs/thinking)

- **Browser chat** gives Gemini 3 seconds overall, including response-body reads and retry delays. A quick temporary failure can get one retry if there's enough time. When the budget expires or extraction fails, chat keeps the draft, uses bounded local recognition, and reports `local-fallback` in the trace.
- **Stateless assignment API** allows up to three attempts, at most 14 seconds per attempt and 40 seconds overall. It returns HTTP 503 if extraction fails. Both routes respect `Retry-After` within their budgets.

## Assignment API

The assignment's `POST /api/booking` checks synthetic availability and treats each message independently. Its result includes a normalized `request`, `status`, localized `reply`, `match`, `alternatives`, `clarification_field`, and a `trace` with current-turn evidence, extraction source, reference date and checks. Business statuses are `MATCH`, `ALTERNATIVES`, `NEEDS_INFO`, `NO_AVAILABILITY` and `OUT_OF_RANGE`. Provider errors return `EXTRACTION_ERROR` with HTTP 503.

### Optional browser court guide

Open `http://localhost:3000` to try the separate multi-turn flow that links to FitCircle’s official court pages. Type Arabic to switch the interface right-to-left. Use **New booking** or **حجز جديد** to clear the draft.

| Action | `POST /api/conversation` JSON |
| --- | --- |
| Start a session | `{"message":"i want to book tmw"}` |
| Continue | `{"session_id":"<returned UUID>","message":"padle"}` |
| Start a new draft | `{"session_id":"<returned UUID>","reset":true}` |

Message turns return the court guide result plus a `session_id`. Always use the ID from the latest response. Reset rotates the ID and clears its draft. A reset request may also contain the first `message` of the new search. Unknown or expired UUIDs start an empty session with a new ID. Concurrent actions on one in-flight session return HTTP 409. Input errors return 400, 413 or 415. `GET /api/availability` exposes the synthetic exercise inventory and `GET /api/health` reports liveness.

Chat returns `court_links` with names, locations where known, and official URLs. A `COURTS` result shows places to check on FitCircle. When present, each string in `suggestions` can be sent as the next `message` with the same session ID.

## Design decisions

```text
Current message + optional pending question
   → Gemini and bounded local recognition, or offline local recognition
   → Validated verbatim evidence
   → Deterministic normalization and optional draft merge
   → Court guide links or a deterministic exercise result
   → Localized reply and decision trace
```

- **Trust boundary.** Gemini receives the current message and, in chat, the pending field and a flag for whether that field needs AM/PM. When local recognition finds one unambiguous neighborhood, the per-request schema limits the model to that exact quote or null. Otherwise it can quote an unfamiliar neighborhood from the message. The server validates all six fields verbatim and gives local conflicts precedence. The court guide supplies reviewed links, and the exercise engine supplies synthetic slots. [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [Google LangExtract source-grounding example](https://github.com/google/langextract)
- **Draft lifecycle.** The server stores the normalized request, the pending field, any unresolved clock reading, and the previous outcome in memory. New values replace only the affected fields. A matched draft supports explicit revisions such as “actually make it Friday.” A regular request after a match starts fresh. While a draft is active, **New booking** and phrases such as “start over” explicitly clear it. The store holds up to 1,000 sessions and expires idle drafts after 30 minutes. Each browser page has a separate session.
- **Time.** `Intl.DateTimeFormat` resolves dates in `Asia/Damascus`. Relative dates are resolved on the turn where they are supplied. Weekday names use the next occurrence including today, with an explicit “next” on the same weekday advancing seven days. The exercise inventory covers today plus six days and excludes past starts. In that matcher, evening covers 17:00–23:00, morning 08:00–12:00 and afternoon 12:00–17:00. A session must fit inside the whole requested window. A bare 1–12 hour requires AM or PM. Canonical two-digit `HH:mm` is accepted as 24-hour time. Durations must be integers from 15 through 240 minutes.
- **Clarification.** The court guide asks for one detail at a time to select useful links. The exercise matcher prioritizes known conflicts and out-of-range dates, then asks for sport, date, area, time, duration and player count. The pending question gives meaning to short replies.
- **Court guide.** Chat can ask for a sport or date, offer neighborhoods from its reviewed venue links, and open official venue pages with a selected date. Sport-specific links for Top Academy Courts preserve football or basketball when requested. FitCircle handles current times and any booking on its own pages.
- **Matching.** The fixture uses five venue names and locations listed on FitCircle. Top Academy has separate entries for padel, football, and basketball. Opening times, gaps, and player capacities are synthetic exercise data. Slots must fit the full duration and respect sport and capacity. Alternative ranking weights date, neighborhood and time, then breaks ties deterministically. [FitCircle’s court directory](https://www.fitcircleapp.com/courts)
- **Language.** Reply templates use Levantine Arabic or English. Mixed messages use the dominant script, with Arabic on ties. Bare numbers and neutral shorthands inherit the prior language. The slot details in the reply come from the deterministic decision.

## Test and evaluation

```sh
npm test
npm run eval -- --check  # read-only offline check, also used by CI
npm run eval            # regenerates the offline benchmark artifacts
npm run eval:live       # uses the configured Gemini key and regenerates the live artifacts
npm run bench:availability
```

The original ten-message benchmark uses a fixed reference instant (`2026-11-25T12:00:00Z`, 15:00 Damascus) and checks normalized fields, statuses, clarification fields, and venue/start where applicable. The regular demo uses the current clock. See the executed offline and browser findings in [RESULTS.md](RESULTS.md).

The HTTP regressions cover the reported exchange, Arabic and mixed-language conversations, corrections, reset, isolation, expiry, ambiguity, provider failures and booking constraints. Provider fixtures simulate HTTP responses. The live benchmark requires a Gemini key and network access and measures the provider-enabled pipeline.

The latest automated suite passed **88/88**, and the offline and live Gemini benchmarks both passed **10/10**. The slowest of the four original browser turns fell from **5.87 s to 3.02 s**. Three updated turns used Gemini and one used local fallback. The availability benchmark took **38.7 ms** median for 1,200 calls, down from **1,089.5 ms** on the previous implementation. A separate comparison checked 2,160 identical match and ranking outcomes. [Browser and latency results](RESULTS.md#chat-latency) · [Live case results](RESULTS_LIVE.md)

## Known limits and next steps

- The chat uses a reviewed set of public venue links and links to the full FitCircle sport directory. FitCircle shows live slots on those pages. [FitCircle court directory](https://www.fitcircleapp.com/courts) · [Top Academy Courts](https://www.fitcircleapp.com/padel/top-academy-courts)
- The grammar and normalizers cover a bounded set of expressions, sports and areas. Complex negation, unusual date and time expressions, and unsupported terminology may require rephrasing. Multiple independent bookings need separate drafts.
- The session ID acts as a bearer token on the local demo. State lives in a single process and disappears on restart. A browser reload starts a new chat. The mock neighborhood distances are fixed.
- A slow provider can reduce Gemini coverage in chat. The local interpreter asks for clarification when it cannot resolve a field.

## Repository map

```text
src/types.ts          Shared domain contracts
src/intent.ts         Local extraction / evidence validation / language
src/provider.ts       Structured Gemini extraction adapter
src/time.ts           Damascus calendar and time normalization
src/availability.ts   Mock inventory and deterministic ranking
src/court-guide.ts    Reviewed FitCircle court links and date handoff
src/service.ts        Orchestration and localized replies
src/conversations.ts  In-memory session lifecycle
src/server.ts         HTTP transport and static demo
public/              Browser demo (no dependencies)
tests/               Domain and HTTP / provider contract tests
scripts/             Reproducible 10-message evaluation and matcher benchmark
```

AI assistance and verification details are recorded in [AI_NOTES.md](AI_NOTES.md).

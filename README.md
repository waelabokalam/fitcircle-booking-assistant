# FitCircle Booking Assistant

A small bilingual service for interpreting sports-booking messages in Damascus and checking synthetic availability. Built for the Levare Lab internship exercise. **No real reservations are created.**

## Quick start

Requires Node.js 22.16 or newer with full ICU timezone data. Node runs the TypeScript source directly, with zero third-party packages.

```sh
npm start
# Open http://localhost:3000
```

The default `local` mode uses rule-based extraction and runs offline. To try the chat, send `i want to book tmw`, then `padle`. The inspector shows padel and tomorrow while the assistant asks for the area. Use **New booking** or type `start over` to clear the draft. The server binds to loopback for local evaluation.

### Enable actual LLM extraction

1. Obtain a Gemini API key using a supported account. Check that the chosen model and region are available to you.
2. Copy `.env.example` to `.env` and set:

```dotenv
EXTRACTION_MODE=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

3. Run `npm start`. The decision inspector reports `gemini` after validating a provider response. The adapter calls Google's API with a structured output schema. Keep the API key in the server environment and use synthetic messages for this exercise. [generateContent REST API](https://ai.google.dev/api/generate-content) · [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

When the provider is unavailable or its output fails validation, chat keeps the draft, uses bounded local recognition, and reports `local-fallback` in the trace. The stateless assignment endpoint retains its original HTTP 503 behavior.

## API

```sh
curl -s http://localhost:3000/api/booking \
  -H 'Content-Type: application/json' \
  -d '{"message":"Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players."}'
```

The assignment's `POST /api/booking` treats each message independently. Its result includes a normalized `request`, `status`, localized `reply`, `match`, `alternatives`, `clarification_field`, and a `trace` with current-turn evidence, extraction source, reference date and checks. Business statuses are `MATCH`, `ALTERNATIVES`, `NEEDS_INFO`, `NO_AVAILABILITY` and `OUT_OF_RANGE`. Provider errors return `EXTRACTION_ERROR` with HTTP 503.

### Multi-turn chat

| Action | `POST /api/conversation` JSON |
| --- | --- |
| Start a session | `{"message":"i want to book tmw"}` |
| Continue | `{"session_id":"<returned UUID>","message":"padle"}` |
| Start a new draft | `{"session_id":"<returned UUID>","reset":true}` |

Message turns return the booking result plus a `session_id`. Always use the ID from the latest response. Reset rotates the ID and clears its draft. A reset request may also contain the first `message` of the new booking. Unknown or expired UUIDs start an empty session with a new ID. Concurrent actions on one in-flight session return HTTP 409. Input errors return 400, 413 or 415. `GET /api/availability` exposes synthetic inventory and `GET /api/health` reports liveness.

## Design decisions

```text
Current message + optional pending question
   → Gemini and bounded local recognition, or offline local recognition
   → Validated verbatim evidence
   → Deterministic normalization and optional draft merge
   → One clarification or deterministic availability decision
   → Localized reply and decision trace
```

- **Trust boundary.** Gemini receives the current message and, in chat, the pending field and a flag for whether that field needs AM/PM. The response must contain six nullable verbatim phrases. Validation rejects missing or extra keys and invented evidence. Recognized local phrases and conflicts take precedence, and Gemini can supply evidence where local recognition finds none. Only the booking engine can return a venue or slot.
- **Draft lifecycle.** The server stores the normalized request, the pending field, any unresolved clock reading, and the previous outcome in memory. New values replace only the affected fields. A matched draft supports explicit revisions such as “actually make it Friday.” A regular request after a match starts fresh. While a draft is active, **New booking** and phrases such as “start over” explicitly clear it. The store holds up to 1,000 sessions and expires idle drafts after 30 minutes. Each browser page has a separate session.
- **Time.** `Intl.DateTimeFormat` resolves dates in `Asia/Damascus`. Relative dates are resolved on the turn where they are supplied. The inventory covers today plus six days and excludes past starts. Weekday names use the next occurrence including today, with an explicit “next” on the same weekday advancing seven days. Evening covers 17:00–23:00, morning 08:00–12:00 and afternoon 12:00–17:00. A session must fit inside the whole requested window. A bare 1–12 hour requires AM or PM. Canonical two-digit `HH:mm` is accepted as 24-hour time. Durations must be integers from 15 through 240 minutes.
- **Clarification.** The assistant asks for one field at a time and prioritizes known conflicts or a date outside the horizon. Otherwise it asks for sport, date, area, time, duration, then player count. The pending question gives meaning to short replies such as `٤`, `any` and `المسا`. The chat duration question specifies minutes so `60` has a defined unit.
- **Matching.** All candidates must fit one free interval completely, match the sport and meet player capacity. Exact requested date and area (or `any`) and exact start or flexible window produce a match. Synthetic inventory includes six invented venues across Mezzeh, Malki, Abu Rummaneh, Kafr Souseh, Dummar, Baramkeh, with a fixed weekday maintenance/gap pattern. Alternate starts use a 30-minute grid; requested off-grid starts are checked directly. Ranking score = `1440 × absolute date difference in days + 180 × neighborhood distance + time deviation in minutes`. Distances 0/1/2 represent same/adjacent/other mock area; these are illustrative, not measured travel times. Ties resolve by date, time, venue ID. Top alternatives prefer distinct venue/date pairs before filling remaining slots. Hard constraints are never relaxed; if no valid alternatives exist, ask whether the customer can change duration or group size.
- **Language.** Reply templates use Levantine Arabic or English. Mixed messages use the dominant script, with Arabic on ties. Bare numbers and neutral shorthands inherit the prior language. The slot details in the reply come from the deterministic decision.

## Test and evaluation

```sh
npm test
npm run eval       # updates the offline benchmark table in RESULTS.md
npm run eval:live  # genuine Gemini calls; writes RESULTS_LIVE.md and results-live.json
```

The original ten-message benchmark uses a fixed reference instant (`2026-11-25T12:00:00Z`, 15:00 Damascus) and checks normalized fields, statuses, clarification fields, and venue/start where applicable. The regular demo uses the current clock. See the executed offline and browser findings in [RESULTS.md](RESULTS.md).

The HTTP regressions cover the reported exchange, Arabic and mixed-language conversations, corrections, reset, isolation, expiry, ambiguity, provider failures and booking constraints. Provider fixtures simulate HTTP responses. The live benchmark requires a Gemini key and network access and measures the provider-enabled pipeline.

## Known limits and next steps

- All slots use a fictional inventory. A match only confirms mock availability.
- The grammar and normalizers cover a bounded set of expressions, sports and areas. Complex negation, unusual date and time expressions, and unsupported terminology may require rephrasing. Multiple independent bookings need separate drafts.
- The session ID acts as a bearer token on the local demo. State lives in a single process and disappears on restart. A browser reload starts a new chat. The mock neighborhood distances are fixed.
- The live benchmark stopped before contacting Gemini because `GEMINI_API_KEY` was absent. Provider behavior has automated fixture coverage.

## Repository map

```text
src/types.ts          Shared domain contracts
src/intent.ts         Local extraction / evidence validation / language
src/provider.ts       Structured Gemini extraction adapter
src/time.ts           Damascus calendar and time normalization
src/availability.ts   Mock inventory and deterministic ranking
src/service.ts        Orchestration and localized replies
src/conversations.ts  In-memory session lifecycle
src/server.ts         HTTP transport and static demo
public/              Browser demo (no dependencies)
tests/               Domain and HTTP / provider contract tests
scripts/             Reproducible 10-message evaluation
```

AI assistance and verification details are recorded in [AI_NOTES.md](AI_NOTES.md).

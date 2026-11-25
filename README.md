# FitCircle Booking Assistant

A small bilingual service for interpreting sports-booking messages in Damascus and checking synthetic availability. Built for the Levare Lab internship exercise. **No real reservations are created.**

## Quick start

Requires Node.js 22.16 or newer with full ICU timezone data. There are no third-party packages or build steps; native TypeScript type stripping is used. From this directory:

```sh
npm start
# Open http://localhost:3000
```

The default `local` extraction mode is a bounded rule-based baseline and requires no network or key. It is not an LLM. The browser demo shows the request JSON, decision, evidence, and mock inventory. The server binds to loopback for local evaluation.

### Enable actual LLM extraction

1. Obtain a Gemini API key using a supported account. Check that the chosen model and region are available to you.
2. Copy `.env.example` to `.env` and set:

```dotenv
EXTRACTION_MODE=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

3. Run `npm start`. The decision inspector reports `gemini` when the LLM is used. The model is configurable; the adapter uses Google's [generateContent REST API](https://ai.google.dev/api/generate-content) and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). The provided default model is illustrative and must be checked against your account. Never commit `.env` or expose the API key in the browser.

If Gemini fails, the service fails closed with HTTP 503 and a short retry message. It does not silently switch to the offline extractor or fabricate availability. The provider receives the customer message, so only synthetic test messages should be sent during this exercise.

## API

```sh
curl -s http://localhost:3000/api/booking \
  -H 'Content-Type: application/json' \
  -d '{"message":"Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players."}'
```

Returns a normalized `request` (sport, area, ISO local date, exact start time or time window, duration in minutes, number of players, language), `status`, localized `reply`, `match`, `alternatives`, `clarification_field`, and a structured `trace`. The trace includes raw evidence, the extraction source, the reference date, and the checks performed. `GET /api/availability` returns the next seven Damascus calendar days of synthetic inventory; `GET /api/health` returns a basic liveness response.

Possible statuses: `MATCH`, `ALTERNATIVES`, `NEEDS_INFO`, `NO_AVAILABILITY`, `OUT_OF_RANGE`, `EXTRACTION_ERROR`. Invalid HTTP input gets 400/413/415. An LLM/provider error gets 503. Other business outcomes get 200. Requests are independent; a follow-up question does not imply conversation state.

## Design decisions

```text
Customer message
   |  Local or Gemini extraction (raw phrases, not calculated values)
   v
Runtime schema + verbatim evidence validation
   |  Deterministic normalization / Asia-Damascus / injected clock
   v
Booking domain (sport, date, area, full duration, capacity)
   |  Exact match / ranked alternatives / clarification
   v
Localized templates + structured decision trace
```

- **Trust boundary.** The LLM gets the message only and returns six nullable raw substrings, never normalized dates, free slots, or booking decisions. Runtime validation rejects unknown keys and non-verbatim evidence. Values are then parsed and checked in code. This limits hallucinations but does not guarantee the semantic correctness of a quoted phrase or eliminate prompt injection. The model cannot call tools or write inventory.
- **Time.** `Intl.DateTimeFormat` resolves the current local calendar date in `Asia/Damascus`; day arithmetic uses UTC calendar dates to avoid host timezone dependence. The inventory covers today plus six days; past starts are excluded. The injectable clock makes tests reproducible. Weekday names mean the next occurrence including today, except an explicit “next” on the same weekday means seven days later. Evening means 17:00–23:00; morning 08:00–12:00; afternoon 12:00–17:00. A whole session must fit inside the window. Single-digit hours without a meridiem are ambiguous; canonical two-digit `HH:mm` is accepted as 24-hour time. Supported durations: 15–240 minutes, integer.
- **Missing values.** No assumed duration, group size, or area. Explicit “anywhere” is allowed. Clarification priority: sport, date, area, time, duration, player count. Only one question is asked. A past or out-of-horizon explicit date gets a bounded clarification before other missing fields. The first two supplied messages lack duration; the third lacks a sport.
- **Matching.** All candidates must fit one free interval completely, match the sport and meet player capacity. Exact requested date and area (or `any`) and exact start or flexible window produce a match. Synthetic inventory includes six invented venues across Mezzeh, Malki, Abu Rummaneh, Kafr Souseh, Dummar, Baramkeh, with a fixed weekday maintenance/gap pattern. Alternate starts use a 30-minute grid; requested off-grid starts are checked directly. Ranking score = `1440 × absolute date difference in days + 180 × neighborhood distance + time deviation in minutes`. Distances 0/1/2 represent same/adjacent/other mock area; these are illustrative, not measured travel times. Ties resolve by date, time, venue ID. Top alternatives prefer distinct venue/date pairs before filling remaining slots. Hard constraints are never relaxed; if no valid alternatives exist, ask whether the customer can change duration or group size.
- **Language.** Arabic/English/mixed is detected in code. Mixed input receives a response in the dominant script (Arabic on ties). Human-readable reply templates use Levantine Arabic or concise English and draw venue/time data solely from the decision. This is intentionally safer than allowing a second model to invent details.
- **Simplicity.** A stateless HTTP service, native TypeScript, no database, no build pipeline, no framework or SDK dependency. LLM transport is isolated in `provider.ts`; domain logic has no dependency on the HTTP server or model.

## Test and evaluation

```sh
npm test
npm run eval       # offline baseline, no API calls; rewrites RESULTS.md
npm run eval:live  # genuine Gemini calls; writes RESULTS_LIVE.md and results-live.json
```

The ten-message acceptance set includes all three supplied messages verbatim and seven additional cases. It uses a fixed reference instant (`2026-11-25T12:00:00Z`, 15:00 Damascus), and asserts extraction values, decision status, clarification field, and exact venue/start where applicable. The live UI uses the actual clock, so relative date examples will naturally change. `RESULTS.md` and `results-local.json` contain executed offline results, not LLM accuracy claims. Provider wire tests simulate HTTP responses; a live model run requires your API key and network connectivity. Do not submit local scores as live LLM results.

The test suite also exercises timezone boundaries, invalid calendar dates/times, Arabic digits, invalid duration and player count, missing evidence, full duration matching, same-day past slots, capacity, alternative ranking, HTTP validation and provider errors. CI runs the offline suite and benchmark on pushes and PRs. Native TypeScript type stripping is runtime execution, **not** a static `tsc` type check; no static type check is configured in this dependency-free version.

## Known limits and next steps

- Mock venues are fictional. Matching means availability, not a persisted reservation; no payments or real venue integration. A production system would require transactional reservations, overlap protection, idempotency, authenticated venue management, and inventory updates.
- The local extractor covers a narrow grammar; spelling variations, multiple conflicting booking requests, negation, uncommon Arabic number words, relative hours, dates without years and unsupported sports/areas may require clarification or can be misinterpreted. Gemini can improve extraction but normalization remains deliberately bounded; full language coverage is not claimed.
- Fixed mock adjacency and weighted ranking are transparent policy decisions rather than geographic optimization.
- No conversational memory or WhatsApp integration. The demo shows a transcript for readability, but each request is processed independently. No public deployment, authentication, rate limiting, persistent logging or personal-data retention policy is implemented. Keep the demo local; harden these before exposing it to the internet.
- Live Gemini evaluation and a real browser walkthrough/recording are required before submission. The implementation environment could not reach the package registry or external APIs, so actual provider credentials and live output were not tested here. HTTP tests verified the API and static assets; the attempted Chromium browser smoke test was blocked by the environment administrator before page navigation, so visual and interactive browser verification remains pending.

## Repository map

```text
src/types.ts          Shared domain contracts
src/intent.ts         Local extraction / evidence validation / language
src/provider.ts       Structured Gemini extraction adapter
src/time.ts           Damascus calendar and time normalization
src/availability.ts   Mock inventory and deterministic ranking
src/service.ts        Orchestration and localized replies
src/server.ts         HTTP transport and static demo
public/              Browser demo (no dependencies)
tests/               Domain and HTTP / provider contract tests
scripts/             Reproducible 10-message evaluation
```

See [AI_NOTES.md](AI_NOTES.md) for a draft disclosure that should be reviewed and personalized before submission.

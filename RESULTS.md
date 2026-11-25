# Evaluation — Local rule-based baseline

Reference instant: 2026-11-25T12:00:00.000Z (15:00 Damascus). Availability is synthetic.

**10/10 passed.** This benchmark uses the rule-based extractor and measures offline pipeline behavior.

| # | Customer message | Expected | Observed | Decision / reply | Result |
|---|---|---|---|---|---|
| 01 | بدي احجز ملعب بادل بكرا الساعة 7 المسا بالمزة، نحنا 4 | NEEDS_INFO | NEEDS_INFO | قديش بدك مدة الحجز؟ | PASS |
| 02 | Any football pitch free Friday evening near Malki for 10 people? | NEEDS_INFO | NEEDS_INFO | How long would you like to book for? | PASS |
| 03 | في شي ملعب فاضي اليوم؟ | NEEDS_INFO | NEEDS_INFO | شو الرياضة اللي بدك تحجز إلها؟ | PASS |
| 04 | Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players. | MATCH | MATCH | Good news! Mezzeh Padel Club — 2026-11-26, 19:00–20:30 is available for 4 players. This confirms mock availability, not a real reservation. | PASS |
| 05 | Football in Malki tomorrow at 7 pm for 60 minutes, 10 players. | ALTERNATIVES | ALTERNATIVES | No exact match, but these are the closest available options: Malki Football Arena — 2026-11-26, 20:00–21:00; Kafr Souseh Sports Field — 2026-11-26, 19:00–20:00; Malki Football Arena — 2026-11-25, 19:00–20:00. Which works for you? | PASS |
| 06 | بدي padel بأبو رمانة بعد بكرا الساعة ٦ المسا لمدة ساعة، نحنا ٤ | MATCH | MATCH | تمام! متوفر بادل أبو رمانة — 2026-11-27, 18:00–19:00 لـ 4 لاعبين. هاد تأكيد توفر تجريبي، مو حجز فعلي. | PASS |
| 07 | بدي تنس بدمر مبارح الساعة ١٠ الصبح لمدة ساعة، نحنا ٢ | OUT_OF_RANGE | OUT_OF_RANGE | الحجوزات التجريبية من 2026-11-25 لـ 2026-12-01. أي يوم بناسبك ضمن هالفترة؟ | PASS |
| 08 | Basketball in Baramkeh tomorrow at 6 pm for 60 minutes, 14 players. | NO_AVAILABILITY | NO_AVAILABILITY | No available slot fits that sport, duration and group size in the next seven days. Could you change the group size or duration? | PASS |
| 09 | بدي بادل بكرا بالمزة الساعة ٧ لمدة ساعة، نحنا ٤ | NEEDS_INFO | NEEDS_INFO | أي ساعة بدك الحجز، الصبح ولا المسا؟ | PASS |
| 10 | Tennis in Dummar in 9 days at 10 am for an hour, 2 players. | OUT_OF_RANGE | OUT_OF_RANGE | Mock availability covers 2026-11-25 through 2026-12-01. Which day in that range works for you? | PASS |

Every expected extraction field is asserted, in addition to decision status and clarification field. Exact match venue and start are checked where specified.

## Phase 1 verification

| Check | Before | After |
| --- | --- | --- |
| `npm test` on Node.js 26.8.2 with loopback access | 57/57 passed | 73/73 passed, including 16 new HTTP regressions |
| Original `npm run eval` with the fixed Damascus clock | 10/10 passed | 10/10 passed |
| In-app browser automation against the local server | All four reported replies reproduced | Retained padel and tomorrow through all four turns |
| `npm run eval:live` | 3/10 with Flash and 8/10 with Flash-Lite before retries | 10/10 with Flash-Lite and retries |

The final suite and offline benchmark also passed on Node.js 23.5.0.

### Reported conversation in the browser

| Customer | Before | After |
| --- | --- | --- |
| i want to book tmw | Which sport would you like to book? | Which sport would you like to book? |
| padle | Which sport would you like to book? | Which area would you prefer? |
| paddle | Which day would you like to book? | Which area would you prefer? |
| tmw | Which sport would you like to book? | Which area would you prefer? |

The updated browser inspector showed `sport: padel` and `date: 2026-11-26` at the end of this exchange. The automated browser session continued with `المزة`, `8`, `pm`, `60` and `٤`. It asked whether 8 meant morning or evening, then showed Mezzeh Padel Club at 20:00–21:00 with a mock-availability message in Arabic. “Actually make it Friday” moved the date to November 27. “لا خلينا الساعة ٧” asked for AM/PM before “المسا” changed the slot to 19:00–20:00. A second tab had an empty draft, and **New booking** cleared the original transcript and fields.

The automated Gemini tests use HTTP fixtures. They verify pending-field context, evidence validation, rejection of conflicting or invented evidence, and fallback behavior.

### Live Gemini verification

**Verdict — PASS for the retry-enabled rerun.** All 10 original benchmark cases passed with `trace.source=gemini`, and all four browser turns produced the expected replies with `Extraction: gemini` in the inspector. The browser used the same fixed Damascus reference clock. The benchmark score measures the full pipeline, including bounded local recognition and deterministic checks.

| Run | Benchmark | Cases returning `EXTRACTION_ERROR` | Correct browser replies | Browser turns with validated Gemini output |
| --- | --- | --- | --- | --- |
| Flash, before retries | 3/10 | 01, 03, 05, 06, 07, 08, 10 | 4/4 | 2/4 |
| Flash-Lite, before retries | 8/10 | 04, 07 | 4/4 | 2/4 |
| **Flash-Lite, with retries** | **10/10** | None | **4/4** | **4/4** |

Benchmark cases 02 and 03 received HTTP 503 on their first attempt and returned valid output on their second. The benchmark made 12 provider attempts. Every browser turn succeeded on its first attempt. The reruns encountered zero client timeouts, and the automated suite passed **77/77**, including a fixture that recovers from a response-body timeout. The original offline benchmark passed **10/10**. [Live benchmark report](RESULTS_LIVE.md) · [Live case data](results-live.json)

| Customer | Browser reply | Flash source before retries | Flash-Lite source before retries | Flash-Lite source with retries |
| --- | --- | --- | --- | --- |
| `i want to book tmw` | Which sport would you like to book? | `gemini` | `gemini` | `gemini` |
| `padle` | Which area would you prefer? | `local-fallback` | `gemini` | `gemini` |
| `paddle` | Which area would you prefer? | `gemini` | `local-fallback` | `gemini` |
| `tmw` | Which area would you prefer? | `local-fallback` | `local-fallback` | `gemini` |

The browser retained November 26 from the first turn and padel from the second turn, then finished by asking for the area. Before the retry change, three Flash diagnostic requests hit the 12-second deadline, and Google returned HTTP 503 on a Flash-Lite diagnostic replay of case 07. The current 40-second total budget still bounds recovery during a sustained outage.

### Guided clarification

The browser replay with Gemini validated all four turns. `i want to play tmw` displayed example sport start times, `padle` narrowed the area choices to Mezzeh and Abu Rummaneh, and `Mazzeh` displayed 09:00–12:00 and 18:00–22:00. The next reply stored `18:00` and asked for duration. The automated suite passed **79/79**, and the original offline benchmark passed **10/10**.

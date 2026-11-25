# Evaluation — Local rule-based baseline

Reference instant: 2026-11-25T12:00:00.000Z (15:00 Damascus). Availability is synthetic.

**10/10 passed.** This benchmark uses the rule-based extractor and measures offline pipeline behavior.

| # | Customer message | Expected | Observed | Decision / reply | Result |
|---|---|---|---|---|---|
| 01 | بدي احجز ملعب بادل بكرا الساعة 7 المسا بالمزة، نحنا 4 | NEEDS_INFO | NEEDS_INFO | قديش بدك مدة الحجز؟ | PASS |
| 02 | Any football pitch free Friday evening near Malki for 10 people? | NEEDS_INFO | NEEDS_INFO | How long would you like to book for? | PASS |
| 03 | في شي ملعب فاضي اليوم؟ | NEEDS_INFO | NEEDS_INFO | شو الرياضة اللي بدك تحجز إلها؟ | PASS |
| 04 | Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players. | MATCH | MATCH | Good news! Top Academy Courts — 2026-11-26, 19:00–20:30 is available for 4 players. This confirms mock availability, not a real reservation. | PASS |
| 05 | Football in Malki tomorrow at 7 pm for 60 minutes, 10 players. | ALTERNATIVES | ALTERNATIVES | No exact match in the mock schedule. The closest options are Top Academy Courts — 2026-11-26, 20:00–21:00; Top Academy Courts — 2026-11-25, 19:00–20:00; Top Academy Courts — 2026-11-27, 19:00–20:00. Which works for you? | PASS |
| 06 | بدي padel بأبو رمانة بعد بكرا الساعة ٦ المسا لمدة ساعة، نحنا ٤ | ALTERNATIVES | ALTERNATIVES | ما في موعد مطابق بالتوفر التجريبي. أقرب الخيارات: Top Academy Courts — 2026-11-27, 18:00–19:00؛ Ace Padel — 2026-11-27, 18:00–19:00؛ G.M Padel — 2026-11-27, 18:00–19:00. أي واحد بناسبك؟ | PASS |
| 07 | بدي تنس بدمر مبارح الساعة ١٠ الصبح لمدة ساعة، نحنا ٢ | OUT_OF_RANGE | OUT_OF_RANGE | الحجوزات التجريبية من 2026-11-25 لـ 2026-12-01. أي يوم بناسبك ضمن هالفترة؟ | PASS |
| 08 | Basketball in Baramkeh tomorrow at 6 pm for 60 minutes, 14 players. | NO_AVAILABILITY | NO_AVAILABILITY | The mock schedule has no slot that fits that sport, duration and group size. Could you change the group size or duration? | PASS |
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

The updated browser inspector showed `sport: padel` and `date: 2026-11-26` at the end of this exchange. The automated browser session continued with `المزة`, `8`, `pm`, `60` and `٤`. It asked whether 8 meant morning or evening, then displayed a mock slot in Mezzeh at 20:00–21:00. “Actually make it Friday” moved the date to November 27. “لا خلينا الساعة ٧” asked for AM/PM before “المسا” changed the slot to 19:00–20:00. A second tab had an empty draft, and **New booking** cleared the original transcript and fields.

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

The tappable version was also verified in the browser with **4/4** validated Gemini responses. The replay entered the first message, selected **Padel** with the keyboard, and clicked **Mezzeh** and **18:00**. The draft retained all three choices and removed the previous buttons after each turn. The demo footer links to the verified [FitCircle court directory](https://www.fitcircleapp.com/courts).

### Official court guide

The current browser flow types a date-first request and taps **Padel** then **Mezzeh**. It shows named court links and no synthetic times. All three turns used validated Gemini responses. Opening the emitted link showed Top Academy Courts and its time picker on the selected date, Thursday, November 26. The automated suite passed **82/82**, and the original stateless exercise benchmark passed **10/10**. [Top Academy Courts](https://www.fitcircleapp.com/padel/top-academy-courts?date=2026-11-26)

The Arabic browser replay verified that typing the first Arabic letter translated the controls and mirrored the workspace. All **3/3** chat turns used validated Gemini responses. **حجز جديد** kept Arabic active, typing a time left the language in Arabic, and typing an English message restored the left-to-right layout.

### Submission fixture

The original ten messages were rerun against synthetic schedules for five verified FitCircle venues. Case 06 now ranks alternatives because the fixture has no padel venue in Abu Rummaneh. The offline pipeline passed **10/10** and the suite passed **83/83**. The full live run passed **9/10**, with an extraction error on case 07 followed by a successful isolated retry. [Live results](RESULTS_LIVE.md) · [FitCircle venue directory](https://www.fitcircleapp.com/courts/padel)

### Performance and extraction review

| Check | Baseline at `d8505e3` | Updated |
|---|---|---|
| Automated tests | 83/83 | 85/85 |
| Original offline benchmark | 10/10 | 10/10 |
| Original live Gemini benchmark | 9/10 in a fresh baseline run | 10/10 in each of two consecutive runs |
| Matcher median for 1,200 calls | 1,089.5 ms | 38.7 ms |

The matcher benchmark cycles through an exact padel match, football alternatives and mixed-language padel alternatives. Both versions ran locally on Node.js 26.8.2 for five samples with a warm-up. The roughly 28× result measures matcher CPU time. A separate comparison checked 2,160 exact results and ranked lists across four sports, six area choices, three durations, three date offsets, five time requests and two clock instants.

In case 07, Gemini sometimes returned `دمشق` for `بدمر`. The schema now accepts the actual neighborhood quote or null when the recognizer identifies a single neighborhood. The verifier still rejects unsupported quotes. The two updated live runs had 10 and 12 provider attempts, respectively. Their median end-to-end latencies were 2,984 ms and 1,382 ms, and their p95s were 5,377 ms and 9,354 ms. These are small live samples with variable upstream latency. [First live run per-case results](RESULTS_LIVE.md)

Chrome replayed `i want to book tmw` → `padle` → `paddle` → `tmw`. All four turns used validated Gemini output. The court guide retained November 26 and padel, then switched to RTL when `المزة` was entered. The fifth turn also used Gemini and produced the dated Top Academy Courts link. [Court link from the replay](https://www.fitcircleapp.com/padel/top-academy-courts?date=2026-11-26)

### Chat latency

The before run used commit `afa57aa`. Both browser runs used fresh Chrome profiles, the same live Gemini model and the same laptop. The timer started at Send and ended after the reply and inspector had rendered. Times include browser overhead.

| Browser turn | Before | After | After extraction |
|---|---:|---:|---|
| `i want to book tmw` | 1,257 ms | 1,919 ms | Gemini |
| `padle` | 5,867 ms | 1,097 ms | Gemini |
| `paddle` | 1,679 ms | 3,023 ms | Local fallback |
| `tmw` | 3,166 ms | 1,205 ms | Gemini |
| `المزة` | 873 ms | 3,033 ms | Local fallback |
| `بدي ألعب padel بكرا بدمر` after reset | — | 1,129 ms | Gemini |

The original four replies passed in both runs. Their median fell from **2,423 ms to 1,562 ms**, and the slowest fell from **5,867 ms to 3,023 ms**. Three of the four updated turns used Gemini. The Arabic follow-up kept the dated Top Academy Courts link and RTL layout. The additional mixed-language turn produced the dated Trio Padel Arena link. Six of six updated browser turns returned the expected behavior, with four validated Gemini responses.

| Stateless live runs with ten original inputs | Median | p95 | Validated Gemini responses |
|---|---:|---:|---:|
| Fresh baseline diagnostic | 2,539 ms | 7,268 ms | 10/10 |
| Updated assignment benchmark | 1,544 ms | 7,941 ms | 10/10 |

The earlier baseline repeat reached **9,354 ms** p95. The new stateless run passed all ten cases, with a retry after HTTP 503 on case 09. The tail still varies across live runs. The three-second deadline applies to chat, where a slow or failed provider call triggers the local interpreter without clearing the draft. The latest automated suite passed **88/88** and the offline benchmark passed **10/10**. [Updated live per-case results](RESULTS_LIVE.md)

### Gemini model comparison

Each Chrome replay used a fresh profile, the same fixed Damascus clock, the same six inputs, and the three-second Gemini deadline. The two finalists were tested in both orders. The first four turns were the original replay. The last two checked Arabic RTL and the Mezzeh court link, then a mixed-language Dummar request after reset.

| Model | Replay 1 Gemini | Replay 2 Gemini | Gemini on original turns | Median browser reply |
|---|---:|---:|---:|---:|
| 3.5 Flash-Lite | 2/6 | 0/6 | 1/8 | 3,021 ms |
| 3.1 Flash-Lite | 4/6 | 3/6 | 5/8 | 2,343 ms |
| 3.6 Flash | 1/6 | — | 1/4 | 3,026 ms |
| 2.5 Flash-Lite | 0/6 | — | 0/4 | — |

The 2.5 Flash-Lite requests returned HTTP 404 with the configured credential. Its fast fallbacks are excluded from the latency comparison. The 3.1 browser replies were correct on all 12 turns. Both Arabic follow-ups used fallback, preserved RTL and linked to Top Academy Courts. Both mixed-language follow-ups used Gemini and linked to Trio Padel Arena. The earlier 3.5 Flash-Lite replay in the preceding section had 4/6 Gemini responses, which illustrates how much coverage can vary across live runs of this size. [Gemini 3.1 Flash-Lite model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)

| Model on the ten original stateless cases | Passed with Gemini | Median | p95 |
|---|---:|---:|---:|
| 3.5 Flash-Lite from the preceding benchmark | 10/10 | 1,544 ms | 7,941 ms |
| 3.1 Flash-Lite rerun | 10/10 | 1,646 ms | 8,983 ms |

The 3.1 run includes a retry after HTTP 503 on the Arabic past-date case. The other nine cases succeeded on their first request. The browser now defaults to 3.1 and the stateless API uses 3.5 by default. [3.1 per-case results](RESULTS_LIVE.md)

The final app was started with its regular local configuration and replayed once more. All six checks passed, with **5/6** Gemini responses and a **1,225 ms** median. The final `tmw` used fallback and retained the date and sport. The Arabic Mezzeh turn used Gemini in **1,122 ms** and preserved RTL. The mixed-language Dummar turn used Gemini in **1,327 ms**. The automated suite passed **90/90** and the offline benchmark passed **10/10**.

### Browser deadline replay

The replay used real Gemini calls, fresh Chrome profiles and the fixed Damascus benchmark clock. The previous implementation had fallen back on `tmw`. In a fresh before run on that implementation, `tmw` succeeded and the mixed-language turn hit the provider timeout. The updated chat starts a second model after 650 ms if validation is still pending. Both models share the three-second deadline.

| Browser input | Fresh before | Updated run 1 | Updated run 2 |
|---|---:|---:|---:|
| `i want to book tmw` | 1,863 ms | 1,683 ms | 1,097 ms |
| `padle` | 1,453 ms | 1,354 ms | 1,070 ms |
| `paddle` | 1,103 ms | 1,205 ms | 1,133 ms |
| `tmw` | 1,229 ms | 1,126 ms | 1,209 ms |
| `المزة` | 1,523 ms | 1,428 ms | 1,602 ms |
| `بدي ألعب padel بكرا بدمر` | 3,020 ms, fallback | 1,554 ms | 1,291 ms |
| Validated Gemini replies | 5/6 | 6/6 | 6/6 |

All 12 updated replies passed, with a median of **1,250 ms** and a slowest turn of **1,683 ms**. In both updated runs, Gemini quoted `tmw` verbatim, Arabic preserved RTL and the Top Academy Courts link, and the mixed-language turn returned Trio Padel Arena. Diagnostics showed 12 primary and 12 backup attempts. The backup won once, recovering the mixed-language turn when 3.1 Flash-Lite returned HTTP 503. The other 11 backup requests were canceled. The automated suite passed **92/92** and the offline benchmark passed **10/10**.

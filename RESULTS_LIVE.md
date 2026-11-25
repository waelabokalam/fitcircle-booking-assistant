# Evaluation — Provider-enabled pipeline with live Gemini

Model `gemini-3.5-flash-lite` returned validated responses for 10 of 10 cases.

Reference instant: 2026-11-25T12:00:00.000Z (15:00 Damascus). Availability is synthetic.

**10/10 passed.** This measures the full pipeline with real Gemini requests, local recognition, and deterministic checks.

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

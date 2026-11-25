# AI assistance — draft disclosure for candidate review

ChatGPT helped scaffold the implementation, generate test cases, implement the date and availability engine and Gemini adapter, and draft the README. Gemini is the optional runtime language extractor. The application code calculates dates and decides availability. Verification includes offline tests, fixture tests, and real Gemini requests.

During review I spotted a fabricated Abu Rummaneh venue in the ranked alternatives. I asked Codex to check FitCircle’s published listings and use verified venue names. The seven-day schedule and player limits remain synthetic, as the exercise requires.

Engineering decisions and corrections recorded during implementation:

- The proposed Next.js / external-package stack was replaced with native Node.js TypeScript because package installation was unavailable. This preserved runnable, testable code instead of shipping an unverified scaffold.
- A raw Arabic clock marker (`الساعة`) must not be mistaken for an hour-long booking. The evidence validator removes a duration claim that is contained inside the clock phrase, and the behavior has a regression test.
- The public mock inventory was adjusted to exclude elapsed portions of today's intervals. Matching already rejected past starts.
- Local and live evaluation scores are kept separate; a mock HTTP test is not proof of actual LLM performance.

## Phase 1 conversational reliability

Codex reproduced the four-turn failure in the original browser UI before editing. The browser had a visible transcript, while the backend processed every message independently. The offline recognizer also missed `tmw` and `padle`.

Codex implemented a separate in-memory chat endpoint and retained the stateless assignment contract. Chat stores normalized fields, keeps a relative date fixed across midnight, and preserves an unresolved hour until the user supplies AM or PM. The Gemini adapter now accepts the current pending field as context. Local recognition checks known phrases and conflicts, and validated provider phrases can fill evidence gaps. The existing engine still calculates dates and makes every availability and ranking decision.

Verification ran 73 automated tests and the original ten-message offline benchmark. In-app browser automation verified the original bug, the updated transcript, corrections, mock confirmation, tab isolation, and reset. Automated transport and failure tests used fixtures.

With a valid Gemini credential, Codex ran the original benchmark and browser conversation against Google. Before retries, Gemini 3.5 Flash passed 3 of 10 cases and Flash-Lite passed 8 of 10. Both browser runs produced four correct replies, with two validated Gemini responses each.

Codex added bounded retries for temporary provider errors and deadlines, then verified the changes against the same cases. The retry-enabled Flash-Lite run passed 10 of 10 cases with validated Gemini responses and recovered from two upstream HTTP 503s. In the browser replay, Gemini backed all four turns and the draft retained the supplied sport and date. The 77 automated tests include fixtures for retry exhaustion, `Retry-After`, timeout recovery and validation failures. [Live verification results](RESULTS.md#live-gemini-verification)

## Performance and extraction review

The live diagnostic showed Gemini replacing the written neighborhood `بدمر` with `دمشق`. The original validator correctly rejected the invented quote. I used Codex to reproduce the issue, consult Google's structured output documentation and review LangExtract's approach to grounding responses in source text. The updated adapter restricts a recognized neighborhood to a literal quote or null and still validates all fields on the server. The live score describes the hybrid pipeline with Gemini enabled. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [LangExtract](https://github.com/google/langextract)

Codex also traced redundant time-zone conversion and response formatting in the matcher. It moved those calculations out of the candidate loop and checked the old and new implementations against 2,160 inputs. [Performance results](RESULTS.md#performance-and-extraction-review)

## Chat latency

I used Codex to time the full browser replay and compare live Gemini request options. Individual requests still showed long delays with minimal thinking, the default model already typically generated no thinking tokens, and stateless Interactions also saw slow responses and retries in the pilot. The adapter uses a shorter prompt and explicitly requests minimal thinking for Flash-Lite. Chat limits the full provider wait to three seconds and then uses the existing local interpreter and draft. The tests verify that the deadline cancels a slow response body and that a subsequent Arabic turn can use Gemini. [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking) · [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions)

I used Codex to compare four model IDs with the same live browser inputs and deadline. I selected 3.1 Flash-Lite for chat because more replies used Gemini in the paired replays. Both Flash-Lite finalists passed all ten live stateless cases, and 3.5 had the shorter stateless times in these samples. Arabic and mixed-language browser cases also checked the court links and page direction. [Model comparison](RESULTS.md#gemini-model-comparison)

Codex reproduced the provider timeout on a different turn in a fresh replay, then added a delayed second model within the same deadline. The app accepts the first validated quote and cancels the other attempt. The additional request recovered an upstream 503 in one live replay. Tests check cancellation and verify that an invalid quote cannot win. [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) · [Deadline replay](RESULTS.md#browser-deadline-replay)

I used Codex to exercise the real chat UI with both provider calls failing. The replay exposed a missing AM/PM question in the court guide. Codex fixed that question, added a localized fallback notice, and verified the draft through Arabic and mixed-language corrections and simulated provider recovery. [Outage replay](RESULTS.md#dual-model-outage-in-chrome)

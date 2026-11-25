# AI assistance — draft disclosure for candidate review

ChatGPT helped scaffold the implementation, generate test cases, implement the date and availability engine and Gemini adapter, and draft the README. Gemini is the optional runtime language extractor. The application code calculates dates and decides availability. Verification includes offline tests, fixture tests, and real Gemini requests.

Engineering decisions and corrections recorded during implementation:

- The proposed Next.js / external-package stack was replaced with native Node.js TypeScript because package installation was unavailable. This preserved runnable, testable code instead of shipping an unverified scaffold.
- A raw Arabic clock marker (`الساعة`) must not be mistaken for an hour-long booking. The evidence validator removes a duration claim that is contained inside the clock phrase, and the behavior has a regression test.
- The public mock inventory was adjusted to exclude elapsed portions of today's intervals. Matching already rejected past starts.
- Local and live evaluation scores are kept separate; a mock HTTP test is not proof of actual LLM performance.

## Phase 1 conversational reliability

Codex reproduced the four-turn failure in the original browser UI before editing. The browser had a visible transcript, while the backend processed every message independently. The offline recognizer also missed `tmw` and `padle`.

Codex implemented a separate in-memory chat endpoint and retained the stateless assignment contract. Chat stores normalized fields, keeps a relative date fixed across midnight, and preserves an unresolved hour until the user supplies AM or PM. The Gemini adapter now accepts the current pending field as context. Local recognition checks known phrases and conflicts, and validated provider phrases can fill evidence gaps. The existing engine still calculates dates and makes every availability and ranking decision.

Verification ran 73 automated tests and the original ten-message offline benchmark. In-app browser automation verified the original bug, the updated transcript, corrections, mock confirmation, tab isolation, and reset. Automated transport and failure tests used fixtures.

With a valid Gemini credential, Codex reran the original benchmark and browser conversation against Google. Gemini 3.5 Flash passed 3 of 10 cases, and Gemini 3.5 Flash-Lite passed 8 of 10. Both browser runs preserved the draft and produced all four expected replies. Each had two turns with accepted Gemini evidence and two with local fallback. The live findings and remaining failures are recorded in [RESULTS.md](RESULTS.md#live-gemini-verification).

# AI assistance — draft disclosure for candidate review

ChatGPT helped scaffold the implementation, generate test cases, implement the date/availability engine and Gemini adapter, and draft the README. Gemini is the optional runtime language extractor; it does not decide availability or compute dates. Offline tests and evaluation were executed in the implementation environment; no real Gemini API call has been made there.

Engineering decisions and corrections recorded during implementation:

- The proposed Next.js / external-package stack was replaced with native Node.js TypeScript because package installation was unavailable. This preserved runnable, testable code instead of shipping an unverified scaffold.
- A raw Arabic clock marker (`الساعة`) must not be mistaken for an hour-long booking. The evidence validator removes a duration claim that is contained inside the clock phrase, and the behavior has a regression test.
- The public mock inventory was adjusted to exclude elapsed portions of today's intervals. Matching already rejected past starts.
- Local and live evaluation scores are kept separate; a mock HTTP test is not proof of actual LLM performance.

Before submitting: run the live evaluation yourself, review the actual extraction failures, record which suggestions you corrected and why, and update this disclosure in your own words. Do not claim manual corrections or live verification that you did not personally perform.

## Phase 1 conversational reliability

Codex reproduced the four-turn failure in the original browser UI before editing. The browser had a visible transcript, while the backend processed every message independently. The offline recognizer also missed `tmw` and `padle`.

Codex implemented a separate in-memory chat endpoint and retained the stateless assignment contract. Chat stores normalized fields, keeps a relative date fixed across midnight, and preserves an unresolved hour until the user supplies AM or PM. The Gemini adapter now accepts the current pending field as context. Local recognition checks known phrases and conflicts, and validated provider phrases can fill evidence gaps. The existing engine still calculates dates and makes every availability and ranking decision.

Verification ran 73 automated tests and the original ten-message offline benchmark. In-app browser automation verified the original bug, the updated transcript, corrections, mock confirmation, tab isolation, and reset. Gemini transport and provider failure tests used fixtures. The live benchmark stopped before sending requests because there was no configured API key. The executed findings are in [RESULTS.md](RESULTS.md).

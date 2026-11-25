# AI assistance — draft disclosure for candidate review

ChatGPT helped scaffold the implementation, generate test cases, implement the date/availability engine and Gemini adapter, and draft the README. Gemini is the optional runtime language extractor; it does not decide availability or compute dates. Offline tests and evaluation were executed in the implementation environment; no real Gemini API call has been made there.

Engineering decisions and corrections recorded during implementation:

- The proposed Next.js / external-package stack was replaced with native Node.js TypeScript because package installation was unavailable. This preserved runnable, testable code instead of shipping an unverified scaffold.
- A raw Arabic clock marker (`الساعة`) must not be mistaken for an hour-long booking. The evidence validator removes a duration claim that is contained inside the clock phrase, and the behavior has a regression test.
- The public mock inventory was adjusted to exclude elapsed portions of today's intervals. Matching already rejected past starts.
- Local and live evaluation scores are kept separate; a mock HTTP test is not proof of actual LLM performance.

Before submitting: run the live evaluation yourself, review the actual extraction failures, record which suggestions you corrected and why, and update this disclosure in your own words. Do not claim manual corrections or live verification that you did not personally perform.

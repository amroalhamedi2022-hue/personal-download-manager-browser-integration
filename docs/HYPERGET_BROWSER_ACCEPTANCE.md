# HyperGet browser integration — source-only acceptance (2026-10-24)

**Branch:** `automation/hyperget-browser-lifecycle-branding` (separate browser repository; not merged).

## Implemented source changes
- User-visible extension name, browser-action title and English UI strings now say **HyperGet**. Technical native host `app.personaldownloadmanager`, Firefox ID, Chrome public key, browser storage keys and message protocol are unchanged.
- Native port messages are scoped to the port that created them. Delayed disconnects or messages from an old port cannot affect a new port.
- Explicit disconnect immediately rejects and clears outstanding request promises; current-port disconnect rejects all outstanding requests and allows a clean reconnect.
- Console no longer dumps arbitrary native-message payloads, which may contain signed links, cookies or tokens.

## Source-only evidence
- **PASS (8/8 isolated in-memory source-model checks):** explicit disconnect, stale disconnect, stale message, multi-request disconnect, timeout/late reply, no secret logging, one-shot request, and stable browser identities. The actual GitHub TypeScript source was fetched, TypeScript-only syntax stripped for isolated V8 execution, and behavior exercised with a mocked native port. **This is not a TypeScript typecheck, npm test run, real browser test, or packaged extension.**
- **PASS 15/15 static assertions on re-fetched GitHub files:** port ownership, stale-event guard, immediate pending rejection, clearing, no sensitive native payload logs, unchanged native host/Firefox ID/Chrome public key, HyperGet manifest/package/English locale, Apache-2.0 attribution and presence of source-only regression harness. Static checks are not a typecheck or runtime test.
- **ADDED, NOT EXECUTED in npm/Node:** `scripts/tests/HyperGetNativeTransportSourceSmoke.cjs`, which transpiles the real TypeScript file in memory using the existing TypeScript devDependency and runs the same behavioral scenarios with Node's built-in test runner. Run after `npm ci`: `node --test scripts/tests/HyperGetNativeTransportSourceSmoke.cjs`.
- **NOT TESTED:** Chrome/Edge/Firefox extension builds, actual browser-native-host exchange, Windows upgrade, captured cookies/headers, permission prompts, HTTP fallback and real download completion.

## Security, licensing and build restrictions
- No new dependencies or paid API. Existing Apache-2.0 attribution and LICENSE preserved.
- No Vite, npm build, extension packaging, EXE/installer, release, GitHub Actions trigger, main-branch write or auto-merge in this round.
- Do not call this release-ready until the Windows HyperGet host and extension are tested together and independently rechecked.

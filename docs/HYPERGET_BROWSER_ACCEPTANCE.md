## 2026-10-25 — one-shot native host liveness milestone (pending exact-SHA CI)

**Required behavior:** The existing connected-port native messaging path already rejects after its configured timeout, but the connectionless `sendNativeMessage` path could await a nonresponding host indefinitely. Production now races the one-shot browser promise against the same configured request timeout, clears the timer on every outcome, and preserves existing response/error validation. This bounds the extension caller, **not** the native host process lifetime; the browser controls that. No protocol/host ID, storage key, user data, dependency or permissions change.

**Regression:** Three new Node tests cover a host that never responds, an immediate native-host rejection, and a late reply after timeout. Expected total **11/11** tests, plus strict TypeScript typecheck and both Chrome/Firefox Vite builds. Existing package-lock dependencies and Apache-2.0 project code are reused; official MDN `runtime.sendNativeMessage` API documentation confirms the Promise-based connectionless behavior. No external code was copied.

**Purposeful build question, recorded before CI:** Does the updated TypeScript compile, do all 11 source-executed native-port tests pass, and do both real browser-extension bundles generate valid HyperGet manifests without changing nativeMessaging permission? Source-only text assertions cannot prove TypeScript types or Vite packaging. One PR-scoped free GitHub Actions workflow runs `npm ci`, Node tests, `tsc --noEmit`, both Vite builds, and manifest checks. **NOT TESTED until the exact-head run finishes.** Browser ↔ installed Windows host E2E, actual downloads, user-profile upgrade and final app packaging remain NOT TESTED.

---

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

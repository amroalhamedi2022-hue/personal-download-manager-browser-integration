# HyperGet browser integration — Big Boss handoff

Snapshot: 2026-11-28. Documentation only; README/open PR metadata reviewed, not full code audit or fresh CI/device certification.

## Product and constraints
Browser extension fork still has upstream AB branding in main README; must preserve compatibility with HyperGet desktop native messaging.

## Observed development checkpoint
PR #2 6e478c776172f8d60f9f037351364495b0258b07; PR #1 0fb5a304cbde07a9758d2b42417e7a8a85cba0f2. Both based on main; compare overlap before merging.

## Authoritative plans and evidence
README.md; desktop repository personal-download-manager; PR #2 and #1.

## Execution sequence and acceptance
1. Verify reply correlation, disconnect/reconnect, timeout and duplicate prevention. 2. Validate native host registration and browser IDs against actual Windows installer; avoid breaking old installs. 3. Test capture, context menu and selected links in Chrome/Firefox; no browser secrets/logged auth URLs. 4. Rebrand visible UI only once compatibility is confirmed.

## Build and test
npm i; npm run pack:firefox; npm run pack:chrome; output dist/<browser_name>.zip. Real browser + installed host smoke required.

## Resume procedure
Read AGENTS.md if present, original plans, current default branch, open PR heads/base/ancestry, exact SHA Actions and artifacts; compare against this snapshot. Choose the newest compatible cumulative implementation, never overwrite newer changes. Record completed / remaining / blocked with exact commit and test evidence. Work in substantial nonduplicate batches; build at meaningful milestones, not each change. Before publishing, check package/version/signing continuity, licenses, offline/privacy policy and real-device acceptance where applicable. Do not infer completion from PR title or CI alone.

## Private handoff boundary
Owner-only material (keys, passwords, private data, ROMs, personal documents, original restricted assets) stays outside GitHub in access-restricted owner storage. Consult the private Big Boss Drive register. No secret values or private links are included here. If missing, record blocker; do not generate replacement keys for installed apps.

## Cross-project law
A lot of work to reach our goal as perfect as possible and as masterpiece as possible at best time. Master functionality in a masterpiece app. Evidence over claims; optimize time/cost; no duplicated work.

# HyperGet Browser Integration

Browser companion for **HyperGet** on Windows. Captures selected links and supported browser downloads, then forwards user-approved requests to the installed HyperGet application.

## Compatibility and privacy

- The native-messaging host identifier remains `app.personaldownloadmanager` and the Firefox extension ID remains `browser-integration@personaldownloadmanager.local` for upgrade compatibility. Do not rename either without a tested migration.
- This extension can optionally forward request headers/cookies when the corresponding user setting is enabled. Avoid sharing secrets in logs. Native messaging responses are correlated by request ID.
- The source-only native-port regression checks are in `scripts/tests/HyperGetNativeTransportSourceSmoke.cjs`. After installing the existing npm dependencies, run `node --test scripts/tests/HyperGetNativeTransportSourceSmoke.cjs`. This is **not** a browser build or an end-to-end Windows test.
- Actual Chrome/Edge/Firefox integration, permission behavior, upgrades and signed-link downloads remain **NOT TESTED** on this branch.

## Upstream credit

This fork derives from [AB Download Manager Browser Integration](https://github.com/amir1376/ab-download-manager-browser-integration) under **Apache-2.0**. See `LICENSE` and `FORK-NOTICE.md`. HyperGet is a separate product and is not endorsed by the upstream authors.

The existing GitHub repository path is retained for continuity; it is not the product name.

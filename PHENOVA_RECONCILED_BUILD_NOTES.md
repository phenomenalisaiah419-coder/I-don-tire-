# PHENOVA Reconciled Build — 2026-09-22

This archive is a clean, reconciled engineering build assembled from the strongest PHENOVA code line and the relevant specification/release material in the PHENOVA Library.

## Source basis

The primary code base is `PHENOVA_CODE_INTEGRATED_FINAL.zip` from 2026-09-22. Its current integrated source contains the latest clarification-answer flow, provider-neutral AI edit constraints, validated execution surfaces, real-media/rendering components, and production-oriented build configuration.

Additional material was selected from the older PHENOVA production/reconciliation archives only when it added non-duplicative value:

- Production audit/remediation and release verification material.
- The free-first provider registry and provider environment example.
- The historical deep-check report, kept under `docs/history/` rather than treated as current source authority.
- Three canonical specification PDFs under `docs/spec/`.

## Deliberate exclusions

The archive does not copy obsolete duplicate implementations merely because an older archive is larger. In particular, older provider-client/provider-router modules and older backend module paths were not overlaid on the current architecture where they would create competing implementations.

Generated Python bytecode and test caches were removed. The archive contains source, tests, documentation, configuration, lockfiles, and the selected specifications—not build-cache output.

The old capability-registry test was also excluded because it targets a superseded `app.services.capability_registry` module path that does not exist in the current source tree.

## Fix included in this reconciliation

The current backend clarification engine now suppresses every question already present in the supplied answer set. This makes adaptive follow-up behavior enforceable server-side rather than relying only on the client.

## Verification performed in this environment

- Python AST parse: 223 Python files checked, 0 syntax errors.
- Focused clarification/constraint tests: 5 passed, 0 failed.
- Suspicious secret-pattern scan: 0 matching files for common AWS/OpenAI/GitHub/Slack token formats.
- Package metadata presence: `package.json`, `package-lock.json`, `backend/requirements.txt`, and `packages/client/pubspec.yaml` verified.
- Archive hygiene: Python bytecode/cache directories removed before packaging.

## Verification not claimed

This environment did not provide a full Flutter SDK/device build or a complete clean Node/TypeScript dependency installation. Therefore this archive is not represented as having a verified signed APK/AAB, physical-device acceptance, or full production end-to-end media/provider verification.

The included release checklist records the remaining release acceptance work.

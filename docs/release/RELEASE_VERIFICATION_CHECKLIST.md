# PHENOVA Release Verification Checklist

## Local commands

```bash
npm ci
npm run build
npm test
cd backend && pytest
cd ../packages/client
flutter pub get
flutter analyze
flutter test
flutter build apk --release
flutter build appbundle --release
```

## Required manual verification

- [ ] Register/login/logout/session revocation
- [ ] Ownership isolation across two accounts
- [ ] Upload validation and resumable upload recovery
- [ ] Create/save/reopen/version/restore project
- [ ] Manual multi-track edit and undo/redo
- [ ] Real audio mix and rendered output inspection
- [ ] AI plan inspection and targeted correction
- [ ] User-only/no-generation policy
- [ ] Explicit generation authorization
- [ ] Media acquisition provenance and rights metadata
- [ ] Quota accounting and UTC reset
- [ ] Render progress/cancel/retry/failure cleanup
- [ ] Offline/IFEC-unavailable behavior
- [ ] Production HTTPS/CORS/rate limits
- [ ] Signed APK/AAB installation on physical Android devices

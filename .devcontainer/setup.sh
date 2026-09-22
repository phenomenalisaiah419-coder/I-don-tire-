#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing system media/database tools"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg postgresql-client > /dev/null

echo "==> Checking toolchain"
node --version
npm --version
python3 --version
flutter --version | head -3
ffmpeg -version | head -1

echo "==> Installing Node workspace dependencies"
npm ci

echo "==> Installing backend Python dependencies"
if [ -f backend/requirements.txt ]; then
  python3 -m pip install --user -r backend/requirements.txt
fi

echo "==> Installing Flutter dependencies"
cd packages/client
flutter pub get
cd ../..

echo "==> Running TypeScript build"
npm run build

echo "==> Environment ready"
echo "Run: npm test"
echo "Flutter: cd packages/client && flutter analyze && flutter test"

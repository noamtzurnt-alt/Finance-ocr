#!/bin/bash
# Archive NoamFinance + Notes and upload both to TestFlight. Manual run only.
# Credentials live outside the repo in ~/.appstoreconnect/config:
#   KEY_ID=...  ISSUER_ID=...  KEY_PATH=/Users/<you>/.appstoreconnect/AuthKey_XXXX.p8
set -euo pipefail

IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$HOME/.appstoreconnect/config"
TEAM_ID="W8P2Q5W8GA"

[ -f "$CONFIG" ] || { echo "Missing $CONFIG"; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${KEY_ID:?}" "${ISSUER_ID:?}" "${KEY_PATH:?}"
[ -f "$KEY_PATH" ] || { echo "Key file not found: $KEY_PATH"; exit 1; }

BUILD="$(date +%Y%m%d%H%M)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cat >"$WORK/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST

AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER_ID")

for SCHEME in NoamFinance Notes; do
  echo "--- $SCHEME (build $BUILD)"
  xcodebuild archive -project "$IOS_DIR/NoamFinance.xcodeproj" -scheme "$SCHEME" \
    -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$WORK/$SCHEME.xcarchive" CURRENT_PROJECT_VERSION="$BUILD" "${AUTH[@]}"
  xcodebuild -exportArchive -archivePath "$WORK/$SCHEME.xcarchive" \
    -exportOptionsPlist "$WORK/ExportOptions.plist" -exportPath "$WORK/export-$SCHEME" "${AUTH[@]}"
done

echo "Uploaded both apps to TestFlight."

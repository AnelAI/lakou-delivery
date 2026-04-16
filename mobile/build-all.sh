#!/bin/bash
# Lakou Delivery — Build toutes les apps pour distribution interne (APK Android)
# Usage: bash mobile/build-all.sh

set -e

echo ""
echo "======================================"
echo "  Lakou Delivery — EAS Build Preview"
echo "======================================"
echo ""

# Vérifier eas-cli
if ! command -v eas &> /dev/null; then
  echo "Installation de eas-cli..."
  npm install -g eas-cli
fi

echo "Connexion EAS requise (une seule fois) :"
eas login

echo ""
echo "📦 Build App COURSIER (Android APK)..."
cd "$(dirname "$0")/courier"
npm install --silent
eas build --platform android --profile preview --non-interactive
echo "✅ App Coursier buildée"

echo ""
echo "🛵 Build App CLIENT (Android APK)..."
cd "../customer"
npm install --silent
eas build --platform android --profile preview --non-interactive
echo "✅ App Client buildée"

echo ""
echo "📊 Build App ADMIN (Android APK)..."
cd "../admin"
npm install --silent
eas build --platform android --profile preview --non-interactive
echo "✅ App Admin buildée"

echo ""
echo "======================================"
echo "  Builds terminés !"
echo "  Consultez expo.dev pour les liens"
echo "  de téléchargement APK."
echo "======================================"

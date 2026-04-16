# Lakou Delivery — Applications Mobile

Trois applications Expo (React Native + TypeScript) pour iOS, Android et Web.

## Structure

```
mobile/
  courier/    → Application coursier (GPS tracking, gestion des courses)
  customer/   → Application client (commander, suivre sa livraison)
  admin/      → Application admin (tableau de bord, courses, coursiers, carte)
```

## Prérequis

```bash
node >= 18
npm install -g expo-cli eas-cli
```

## Démarrage rapide (dev avec Expo Go)

### App Coursier
```bash
cd mobile/courier
npm install
npx expo start
```
Scanner le QR code avec **Expo Go** sur votre téléphone.

### App Client
```bash
cd mobile/customer
npm install
npx expo start
```

### App Admin
```bash
cd mobile/admin
npm install
npx expo start
```

## Build APK Android (sans Mac)

```bash
# 1. Se connecter à EAS
eas login

# 2. Initialiser le projet (une seule fois)
cd mobile/courier
eas build:configure

# 3. Lancer le build APK
eas build --platform android --profile preview
```

Le fichier `.apk` sera disponible en téléchargement sur expo.dev.

## Build iOS (nécessite un compte Apple Developer)

```bash
eas build --platform ios
```

## Variables de configuration

Modifier `lib/config.ts` dans chaque app si l'URL du backend change :

```ts
export const API_BASE = "https://lakou-delivery.vercel.app";
export const PUSHER_KEY = "0b9de637df3d2ea72e8b";
export const PUSHER_CLUSTER = "eu";
```

## Fonctionnalités par app

### 🏍️ App Coursier (`mobile/courier`)
- Connexion par identifiant coursier
- Tracking GPS en temps réel (envoi toutes les 5 secondes)
- Carte OpenStreetMap avec position + waypoints des courses
- Dashboard vitesse / distance / ETA
- Détection automatique d'arrivée (vibration + alerte à 150m)
- Actions : Colis récupéré, Course livrée
- Mises à jour en temps réel via Pusher

### 🛵 App Client (`mobile/customer`)
- Liste des marchands avec recherche et filtres par catégorie
- Page marchand : formulaire de commande complet
- Sélection de zone de livraison (dropdown Bizerte) ou adresse libre
- Suivi de commande en temps réel (statut Pusher)
- Appel direct du coursier en un tap

### 📊 App Admin (`mobile/admin`)
- Tableau de bord : stats en temps réel, coursiers actifs, courses en attente
- Gestion des courses : tabs Attente / En cours / Historique
  - Assigner un coursier (modal avec liste)
  - Marquer collectée / livrée
  - Annuler une course
- Gestion des coursiers : statut GPS, stats du jour, appel direct
- Carte : WebView de la carte admin web (Leaflet + OSRM)
- Créer une nouvelle course : formulaire complet avec recherche marchand

## Architecture technique

| Lib | Rôle |
|-----|------|
| `expo-router` | Navigation fichier (comme Next.js App Router) |
| `expo-location` | GPS haute précision (coursier) |
| `react-native-maps` | Carte OSM avec tiles URL (coursier) |
| `react-native-webview` | Carte Leaflet admin (admin) |
| `pusher-js` | Temps réel (courses, positions, statuts) |
| `expo-haptics` | Retour haptique sur actions |
| `expo-notifications` | Notifications push |
| `@react-native-async-storage` | Persistance locale (session coursier) |
| `date-fns` | Formatage dates (partagé avec le backend) |

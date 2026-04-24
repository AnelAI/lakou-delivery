---
title: "Rapport Technique — Lakou Delivery"
subtitle: "Analyse complète du projet pour développeur senior"
author: "Généré le 2026-04-23"
date: "Version analysée : commit 8408b16"
lang: fr
geometry: "top=2.5cm, bottom=2.5cm, left=2.5cm, right=2.5cm"
fontsize: 11pt
colorlinks: true
linkcolor: "NavyBlue"
toccolor: "NavyBlue"
urlcolor: "NavyBlue"
toc: true
toc-depth: 3
number-sections: true
---

\newpage

# Vue d'ensemble du projet

## Objectif principal

**Lakou Delivery** est une plateforme de dispatch de livraison en temps réel conçue pour une entreprise de livraison basée à **Bizerte (Tunisie)**. Elle permet à un administrateur de :

- Dispatcher des livraisons à des coursiers disponibles
- Suivre les coursiers sur une carte interactive en temps réel
- Détecter automatiquement des anomalies (pauses non autorisées, déviations de route)
- Offrir aux clients un suivi de leur commande sans authentification

## Fonctionnalités clés

| Fonctionnalité | Description |
|---|---|
| **Dashboard admin** | Carte interactive, statistiques, gestion des livraisons et coursiers |
| **Suivi GPS temps réel** | Positions des coursiers mises à jour toutes les 5–30s via l'API Geolocation |
| **Dispatch automatique** | Assignation de livraisons + optimisation de route (algorithme TSP nearest-neighbor) |
| **Détection d'anomalies** | Pauses > 5 min, déviation de route → génération automatique d'alertes |
| **App coursier (PWA)** | Interface mobile avec GPS, Service Worker, vibration sur nouvelle assignation |
| **Suivi client** | Page publique `/track/[orderNumber]` sans authentification |
| **Répertoire marchands** | Import depuis OpenStreetMap via Overpass API |
| **Gestion des commandes** | Placement de commande par le client avec sélection du marchand |

\newpage

# Stack technique

## Langages

- **TypeScript** (strict mode, cible ES2017)
- **CSS** via Tailwind v4

## Frameworks et bibliothèques

| Catégorie | Outil | Version |
|---|---|---|
| Framework Web | Next.js (App Router) | 16.2.3 |
| UI | React | 19.2.4 |
| ORM | Prisma | 5.22.0 |
| Real-time | Pusher (serveur + client) | 5.3.3 / 8.5.0 |
| Carte principale | Google Maps (`@react-google-maps/api`) | 2.20.8 |
| Carte alternative | Leaflet + React-Leaflet | 1.9.4 / 5.0.0 |
| Routing routier | OSRM (API publique open-source) | — |
| Icônes | Lucide React | 1.8.0 |
| Dates | date-fns | 4.1.0 |
| CSS Framework | Tailwind CSS | v4 |

## Outils et infrastructure

| Outil | Usage |
|---|---|
| **Vercel** | Déploiement (avec `vercel.json`) |
| **Neon PostgreSQL** | Base de données cloud (pgbouncer + direct URL) |
| **Pusher Channels** | WebSocket managé pour les événements temps réel |
| **OpenStreetMap / Overpass API** | Import de marchands géolocalisés |
| **tsx** | Exécution de scripts TypeScript (`npm run seed`) |

> **Note :** Il n'existe pas de configuration Docker ni de pipeline CI/CD explicite. Vercel gère le build et le déploiement automatiquement via le fichier `vercel.json`.

\newpage

# Architecture

## Description globale

L'architecture est **monolithique Next.js** (App Router) avec une séparation logique en couches. Le serveur Next.js gère à la fois le rendu des pages et les routes API. La synchronisation temps réel est déléguée à Pusher Channels.

```
┌────────────────────────────────────────────────────┐
│                  Navigateur / App                  │
│   Admin Dashboard  │  Courier PWA  │   Customer    │
└─────────┬──────────┴──────┬────────┴──────┬────────┘
          │ HTTP/REST        │ Pusher sub    │ HTTP
          ▼                 ▼               ▼
┌────────────────────────────────────────────────────┐
│             Next.js App Router (Vercel)            │
│  ┌─────────────────┐   ┌────────────────────────┐  │
│  │  Pages (RSC)    │   │     API Routes         │  │
│  │  /              │   │  /api/couriers         │  │
│  │  /courier/[id]  │   │  /api/deliveries       │  │
│  │  /alerts        │   │  /api/tracking         │  │
│  │  /track/[order] │   │  /api/track/[order]    │  │
│  └─────────────────┘   └───────────┬────────────┘  │
│                                    │               │
│  ┌─────────────────┐               │               │
│  │     lib/        │               │               │
│  │  auth.ts        │               │               │
│  │  geo.ts         │               │               │
│  │  osrm.ts        │               │               │
│  │  pusher.ts      │               │               │
│  └─────────────────┘               │               │
└────────────────────────────────────┼───────────────┘
          │                          │
          ▼                          ▼
┌──────────────────┐    ┌────────────────────────┐
│  Neon PostgreSQL  │    │    Pusher Channels     │
│  (via Prisma)    │    │  channel: admin        │
│                  │    │  channel: courier-{id} │
│  Courier         │    │  channel: order-{num}  │
│  Delivery        │    └────────────────────────┘
│  Merchant        │
│  Alert           │    ┌────────────────────────┐
│  CourierLocation │    │    Services externes   │
└──────────────────┘    │  - Google Maps API     │
                        │  - OSRM Routing        │
                        │  - OSM Overpass API    │
                        └────────────────────────┘
```

## Organisation des dossiers

```
lakou-delivery/
├── app/                        # Next.js App Router
│   ├── api/                    # Routes API (server-side)
│   │   ├── auth/               # login, logout
│   │   ├── couriers/[id]/      # CRUD coursiers + stats
│   │   ├── deliveries/[id]/    # CRUD livraisons
│   │   ├── merchants/          # Lecture marchands
│   │   ├── alerts/             # Gestion alertes
│   │   ├── tracking/           # Réception GPS
│   │   ├── track/[order]/      # Suivi public client
│   │   ├── stats/              # Statistiques dashboard
│   │   └── admin/seed-osm/     # Import OSM
│   ├── (pages)/                # login, courier, couriers, alerts, etc.
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── courier/                # CourierPanel, AddCourierForm, CourierLiveMap
│   ├── delivery/               # DeliveryPanel, AddDeliveryForm, DeliveryDetailModal
│   ├── map/                    # DeliveryMap (Google Maps)
│   └── ui/                     # Toast, Modal, StatsBar, StatusBadge, AlertBanner
├── lib/
│   ├── auth.ts                 # HMAC session auth
│   ├── geo.ts                  # Calculs géo, optimisation TSP
│   ├── osrm.ts                 # Routing via OSRM
│   ├── pusher.ts               # Client Pusher serveur
│   ├── pusher-client.ts        # Client Pusher navigateur
│   ├── osm-merchants.ts        # Import OpenStreetMap
│   ├── types.ts                # Interfaces TypeScript
│   ├── useGpsTracking.ts       # Hook GPS + Service Worker
│   └── seed.ts                 # Script seed BDD
├── prisma/
│   └── schema.prisma           # Schéma Prisma (PostgreSQL)
├── mobile/                     # Apps mobiles (admin, courier, customer)
├── public/                     # Assets statiques
├── vercel.json                 # Config déploiement
└── next.config.ts              # Config Next.js
```

\newpage

# Base de données

## Type

**PostgreSQL** hébergé sur **Neon** (serverless PostgreSQL), accès via **Prisma ORM** v5.

- Connexion principale : `DATABASE_URL` (avec pgbouncer pour le pooling)
- Connexion directe : `DIRECT_URL` (pour les migrations)

## Schéma des tables

### Table `Courier`

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | String (UUID) | PK | Identifiant unique |
| `name` | String | NOT NULL | Nom du coursier |
| `phone` | String | NOT NULL | Numéro de téléphone |
| `photo` | String | nullable | URL photo |
| `status` | String | default: "offline" | offline / available / busy / paused |
| `currentLat` | Float | nullable | Latitude GPS actuelle |
| `currentLng` | Float | nullable | Longitude GPS actuelle |
| `lastSeen` | DateTime | nullable | Dernier signal GPS |
| `speed` | Float | nullable | Vitesse en km/h |
| `heading` | Float | nullable | Direction en degrés |

### Table `Delivery`

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | String (UUID) | PK | Identifiant unique |
| `orderNumber` | String | UNIQUE | Format : `ORD-{timestamp}-{seq}` |
| `customerName` | String | NOT NULL | Nom du client |
| `customerPhone` | String | NOT NULL | Téléphone du client |
| `pickupAddress` | String | NOT NULL | Adresse de collecte |
| `pickupLat` | Float | NOT NULL | Latitude collecte |
| `pickupLng` | Float | NOT NULL | Longitude collecte |
| `deliveryAddress` | String | NOT NULL | Adresse de livraison |
| `deliveryLat` | Float | NOT NULL | Latitude livraison |
| `deliveryLng` | Float | NOT NULL | Longitude livraison |
| `status` | String | default: "pending" | pending/assigned/picked_up/delivered/cancelled |
| `courierId` | String (FK) | nullable | Référence `Courier.id` |
| `merchantId` | String (FK) | nullable | Référence `Merchant.id` |
| `priority` | Int | default: 0 | Priorité de dispatch |
| `estimatedTime` | Int | nullable | Temps estimé (minutes) |
| `distance` | Float | nullable | Distance (km) |
| `assignedAt` | DateTime | nullable | Horodatage assignation |
| `pickedUpAt` | DateTime | nullable | Horodatage collecte |
| `deliveredAt` | DateTime | nullable | Horodatage livraison |
| `createdAt` | DateTime | default: now() | Création |

### Table `Merchant`

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | String (UUID) | PK | Identifiant unique |
| `osmId` | String | UNIQUE, nullable | ID OpenStreetMap |
| `name` | String | NOT NULL | Nom du marchand |
| `category` | String | NOT NULL | Catégorie métier |
| `address` | String | nullable | Adresse textuelle |
| `lat` | Float | NOT NULL | Latitude |
| `lng` | Float | NOT NULL | Longitude |
| `phone` | String | nullable | Téléphone |
| `website` | String | nullable | Site web |
| `active` | Boolean | default: true | Marchand actif |

### Table `Alert`

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | String (UUID) | PK | Identifiant unique |
| `courierId` | String (FK) | NOT NULL | Référence `Courier.id` |
| `type` | String | NOT NULL | unauthorized_pause / route_deviation / speed_violation / offline |
| `message` | String | NOT NULL | Message descriptif |
| `severity` | String | default: "warning" | info / warning / critical |
| `resolved` | Boolean | default: false | Statut de résolution |
| `resolvedAt` | DateTime | nullable | Horodatage résolution |
| `createdAt` | DateTime | default: now() | Création |

### Table `CourierLocation` (historique GPS)

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | String (UUID) | PK | Identifiant unique |
| `courierId` | String (FK) | NOT NULL | Référence `Courier.id` |
| `lat` | Float | NOT NULL | Latitude |
| `lng` | Float | NOT NULL | Longitude |
| `speed` | Float | nullable | Vitesse |
| `heading` | Float | nullable | Direction |
| `timestamp` | DateTime | default: now() | Horodatage |

## Relations importantes

```
Courier  1 ──── 0..* Delivery         (Delivery.courierId → Courier.id)
Courier  1 ──── 0..* Alert            (Alert.courierId → Courier.id)
Courier  1 ──── 0..* CourierLocation  (CourierLocation.courierId → Courier.id)
Merchant 1 ──── 0..* Delivery         (Delivery.merchantId → Merchant.id)
```

\newpage

# Diagrammes UML

## Diagramme de classes

```
┌─────────────────────────────┐
│           Courier           │
├─────────────────────────────┤
│ + id: String (UUID)         │
│ + name: String              │
│ + phone: String             │
│ + status: CourierStatus     │
│ + currentLat: Float?        │
│ + currentLng: Float?        │
│ + lastSeen: DateTime?       │
│ + speed: Float?             │
└──────────┬──────────────────┘
           │ 1
           ├──────────────────────────────────────────┐
           │ 0..*                                      │ 0..*
           ▼                                           ▼
┌──────────────────────┐              ┌───────────────────────────────┐
│       Delivery       │              │             Alert             │
├──────────────────────┤              ├───────────────────────────────┤
│ + id: String         │              │ + id: String                  │
│ + orderNumber: String│              │ + courierId: String           │
│ + customerName       │              │ + type: AlertType             │
│ + customerPhone      │              │ + severity: AlertSeverity     │
│ + pickupAddress      │              │ + message: String             │
│ + deliveryAddress    │              │ + resolved: Boolean           │
│ + status: DelivStatus│              └───────────────────────────────┘
│ + courierId: String? │
│ + merchantId: String?│                  CourierLocation
└────────┬─────────────┘          ┌──────────────────────────────┐
         │ 0..*                   │ + id: String                 │
         │                        │ + courierId: String          │
┌────────▼─────────────┐          │ + lat: Float                 │
│       Merchant       │          │ + lng: Float                 │
├──────────────────────┤          │ + speed: Float?              │
│ + id: String         │          │ + timestamp: DateTime        │
│ + osmId: String?     │          └──────────────────────────────┘
│ + name: String       │
│ + category: String   │
│ + lat: Float         │
│ + lng: Float         │
│ + active: Boolean    │
└──────────────────────┘
```

## Diagramme de séquence — Flux GPS temps réel

```
Courier App       /api/tracking        PostgreSQL          Pusher         Admin Dashboard
     │                  │                  │                 │                  │
     │  POST position   │                  │                 │                  │
     │─────────────────>│                  │                 │                  │
     │                  │ INSERT Location  │                 │                  │
     │                  │─────────────────>│                 │                  │
     │                  │ UPDATE Courier   │                 │                  │
     │                  │─────────────────>│                 │                  │
     │                  │ Check pause?     │                 │                  │
     │                  │─────────────────>│                 │                  │
     │                  │                  │                 │                  │
     │          [Si pause > 5 min]         │                 │                  │
     │                  │ INSERT Alert     │                 │                  │
     │                  │─────────────────>│                 │                  │
     │                  │                  │  ALERTS_NEW     │                  │
     │                  │──────────────────│────────────────>│                  │
     │                  │                  │                 │ WebSocket event  │
     │                  │                  │                 │─────────────────>│
     │                  │                  │                 │                  │
     │          [En mouvement]             │                 │                  │
     │                  │ LOCATION_UPDATE  │                 │                  │
     │                  │──────────────────│────────────────>│                  │
     │                  │                  │                 │ marker update    │
     │                  │                  │                 │─────────────────>│
     │  HTTP 200        │                  │                 │                  │
     │<─────────────────│                  │                 │                  │
```

## Diagramme de séquence — Assignation d'une livraison

```
Admin               /api/deliveries/[id]       PostgreSQL          Pusher         Courier App
  │                         │                       │                 │                │
  │  PATCH action:"assign"  │                       │                 │                │
  │  {courierId}            │                       │                 │                │
  │────────────────────────>│                       │                 │                │
  │                         │  UPDATE Delivery      │                 │                │
  │                         │  status=assigned      │                 │                │
  │                         │──────────────────────>│                 │                │
  │                         │  UPDATE Courier       │                 │                │
  │                         │  status=busy          │                 │                │
  │                         │──────────────────────>│                 │                │
  │                         │                       │  DELIVERY_      │                │
  │                         │                       │  ASSIGNED       │                │
  │                         │───────────────────────│────────────────>│                │
  │                         │                       │                 │  WebSocket     │
  │                         │                       │                 │───────────────>│
  │                         │                       │                 │                │
  │                         │                       │                 │  Vibration +   │
  │                         │                       │                 │  Notification  │
  │  HTTP 200               │                       │                 │                │
  │<────────────────────────│                       │                 │                │
```

## Diagramme de composants

```
┌──────────────────────────────────────────────────────────────────┐
│                    Admin Dashboard (app/page.tsx)                │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ StatsBar │  │ CourierPanel│  │DeliveryPanel│  │AlertBanner│  │
│  └──────────┘  └──────┬──────┘  └──────┬──────┘  └──────────┘  │
│                       │                │                         │
│  ┌────────────────────▼────────────────▼──────────────────────┐ │
│  │               DeliveryMap (Google Maps)                     │ │
│  │   Markers coursiers │ Markers livraisons │ Polylines OSRM  │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Toast Container                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│   Courier App (app/courier/[id])     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   useGpsTracking Hook        │    │
│  │   - watchPosition()          │    │
│  │   - WakeLock API             │    │
│  │   - Adaptive intervals       │    │
│  └──────────┬───────────────────┘    │
│             │                        │
│  ┌──────────▼───────┐  ┌──────────┐ │
│  │  Service Worker  │  │  Pusher  │ │
│  │  /sw.js          │  │  Client  │ │
│  └──────────────────┘  └──────────┘ │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│   API Layer                          │
│                                      │
│  /api/couriers  ──────────────────┐  │
│  /api/deliveries  ────────────┐   │  │
│  /api/tracking  ──────────┐   │   │  │
│  /api/stats  ─────────┐   │   │   │  │
│                        ▼   ▼   ▼   ▼  │
│                      PostgreSQL/Neon  │
│                      (Prisma ORM)    │
└──────────────────────────────────────┘
```

\newpage

# Flux de fonctionnement

## Cycle de vie d'une livraison

```
[Client] Place commande sur /order
         ↓
  Delivery créée → status: "pending"
         ↓
[Admin] Sélectionne livraison + coursier
  PATCH /api/deliveries/[id] {action: "assign", courierId}
         ↓
  status: "assigned" | Pusher notifie le coursier
         ↓
[Coursier] Confirme prise en charge
  PATCH /api/deliveries/[id] {action: "confirm-pickup"}
         ↓
[Admin] Valide (acknowledgement)
  PATCH /api/deliveries/[id] {action: "acknowledge"}
         ↓
[Coursier] Lance le suivi GPS (useGpsTracking)
  Positions envoyées à /api/tracking toutes les 5-30s
         ↓
[Coursier] Récupère le colis physiquement
  PATCH /api/deliveries/[id] {action: "pickup"}
         ↓
  status: "picked_up"
         ↓
[Coursier] Livre le colis
  PATCH /api/deliveries/[id] {action: "deliver"}
         ↓
  status: "delivered" | Pusher notifie admin + client
         ↓
[Client] Voit mise à jour sur /track/[orderNumber]
```

## Détection automatique d'anomalies

```
/api/tracking reçoit une position GPS
         ↓
Calcule distance vs. dernière position connue
         ↓
  [distance < 0.05 km ET durée > 5 min ?]
         ↓
         OUI                        NON
          ↓                          ↓
  Créer Alert                Supprimer alertes
  type: unauthorized_pause    pause actives
  - severity: "warning"       (auto-résolution)
    si durée < 10 min
  - severity: "critical"
    si durée >= 10 min
         ↓
  Pusher → Admin reçoit
  l'alerte en temps réel
```

## Flux d'optimisation de route

```
Admin assigne plusieurs livraisons à un coursier
         ↓
lib/geo.ts : optimizeRoute() [TSP Nearest-Neighbor]
  - Calcule distances Haversine entre tous les points
  - Sélectionne itérativement le point le plus proche
  - Retourne ordre optimisé des livraisons
         ↓
lib/osrm.ts : getOsrmTrip() [Appel API OSRM publique]
  - Envoie les waypoints ordonnés
  - Reçoit polyline encodée (route réelle sur réseau routier)
  - Calcule distance totale et temps estimé
         ↓
DeliveryMap.tsx : Affiche polyline sur Google Maps
```

\newpage

# API et intégrations

## Endpoints principaux

### Authentification

| Méthode | Endpoint | Description | Auth requise |
|---|---|---|---|
| POST | `/api/auth/login` | Login admin, retourne cookie HMAC | Non |
| POST | `/api/auth/logout` | Supprime le cookie de session | Non |

### Coursiers

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/couriers` | Liste avec livraisons actives et alertes |
| POST | `/api/couriers` | Créer un nouveau coursier |
| GET | `/api/couriers/[id]` | Détail + 100 dernières positions GPS |
| PATCH | `/api/couriers/[id]` | Modifier (status, infos personnelles) |
| DELETE | `/api/couriers/[id]` | Supprimer (cascade alertes + locations) |
| GET | `/api/couriers/[id]/stats` | Statistiques du coursier |

### Livraisons

| Méthode | Endpoint | Action body | Effet |
|---|---|---|---|
| GET | `/api/deliveries` | — | Liste filtrée (status, courierId) |
| POST | `/api/deliveries` | — | Créer une livraison |
| GET | `/api/deliveries/[id]` | — | Détail d'une livraison |
| PATCH | `/api/deliveries/[id]` | `assign` | Assigner à un coursier |
| PATCH | `/api/deliveries/[id]` | `pickup` | Marquer colis récupéré |
| PATCH | `/api/deliveries/[id]` | `deliver` | Marquer livré |
| PATCH | `/api/deliveries/[id]` | `cancel` | Annuler |
| PATCH | `/api/deliveries/[id]` | `acknowledge` | Admin valide la prise en charge |
| PATCH | `/api/deliveries/[id]` | `confirm-location` | Confirmer l'adresse de livraison |
| DELETE | `/api/deliveries/[id]` | — | Supprimer définitivement |

### Autres endpoints

| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/tracking` | Réception position GPS coursier | Non |
| GET | `/api/track/[orderNumber]` | Suivi public client | Non |
| GET | `/api/stats` | Statistiques dashboard admin | Oui |
| GET | `/api/merchants` | Liste marchands actifs | Non |
| PATCH | `/api/alerts/[id]` | Résoudre une alerte | Oui |
| GET | `/api/admin/seed-osm` | Import marchands OpenStreetMap | Oui |

## Services externes

| Service | Usage | Variable d'env |
|---|---|---|
| **Pusher Channels** | WebSocket managé pour événements temps réel | `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY` |
| **Google Maps API** | Rendu carte interactive côté admin | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| **OSRM** (API publique) | Calcul de routes routières réelles | Aucune (API publique) |
| **Neon PostgreSQL** | Base de données serverless | `DATABASE_URL`, `DIRECT_URL` |
| **OpenStreetMap / Overpass** | Import des marchands géolocalisés | Aucune (API publique) |

## Canaux Pusher et événements

| Canal | Événement | Déclencheur | Abonné |
|---|---|---|---|
| `admin` | `COURIER_LOCATION_UPDATE` | POST /api/tracking | Dashboard admin |
| `admin` | `COURIERS_UPDATED` | CRUD coursier | Dashboard admin |
| `admin` | `DELIVERIES_NEW` | Création livraison | Dashboard admin |
| `admin` | `DELIVERIES_UPDATED` | Modification livraison | Dashboard admin |
| `admin` | `ALERTS_NEW` | Détection anomalie | Dashboard admin |
| `admin` | `ALERTS_UPDATED` | Résolution alerte | Dashboard admin |
| `courier-{id}` | `DELIVERY_ASSIGNED` | Action assign | App coursier |
| `order-{orderNumber}` | `DELIVERY_STATUS_UPDATE` | Changement statut | Page suivi client |

\newpage

# Système d'authentification

## Mécanisme

L'authentification admin est basée sur un **cookie HMAC-SHA256** :

```
1. POST /api/auth/login {password}
       ↓
2. timingSafeEqual(input, ADMIN_PASSWORD)  [anti timing-attack]
       ↓
3. Générer token = HMAC-SHA256(timestamp, ADMIN_SECRET)
       ↓
4. Stocker dans cookie "lakou_admin_session" (HttpOnly, 7 jours)
       ↓
5. Chaque route protégée : verifySessionToken(cookie)
   - Vérifie la signature HMAC
   - Vérifie l'expiration (7 jours)
```

## Variables d'environnement requises

| Variable | Description | Obligatoire |
|---|---|---|
| `DATABASE_URL` | PostgreSQL avec pgbouncer | Oui |
| `DIRECT_URL` | PostgreSQL direct (migrations) | Oui |
| `PUSHER_APP_ID` | ID application Pusher | Oui |
| `PUSHER_SECRET` | Clé secrète Pusher | Oui |
| `NEXT_PUBLIC_PUSHER_KEY` | Clé publique Pusher | Oui |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Cluster Pusher (ex: eu) | Oui |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Clé API Google Maps | Oui |
| `ADMIN_SECRET` | Secret HMAC pour les sessions | Oui |
| `ADMIN_PASSWORD` | Mot de passe admin | Oui |
| `NEXT_PUBLIC_MANAGER_PHONE` | Numéro téléphone manager | Non |

\newpage

# Points critiques

## Complexités techniques

**1. Synchronisation temps réel multi-acteurs**

Le dashboard admin, les coursiers et les clients reçoivent des événements Pusher distincts sur des canaux différents. Toute modification de la logique d'événement doit être propagée à tous les abonnés. Le `DeliveryMap.tsx` maintient un state complexe avec les positions de tous les coursiers simultanément.

**2. GPS adaptatif avec Service Worker**

Le hook `useGpsTracking` gère un intervalle d'envoi adaptatif :

| Vitesse | Intervalle d'envoi |
|---|---|
| > 20 km/h | 5 secondes |
| > 3 km/h | 10 secondes |
| < 3 km/h (idle) | 30 secondes |

La **WakeLock API** est utilisée pour maintenir l'écran actif — comportement non standardisé sur tous les navigateurs mobiles.

**3. Double couche de routing**

Deux systèmes de routing coexistent :

- `lib/geo.ts` → TSP nearest-neighbor local (rapide, approximatif, sans API)
- `lib/osrm.ts` → OSRM API publique (précis, route réelle, dépend d'un service externe sans SLA)

**4. Gestion des états de livraison**

Le workflow comporte 7 actions possibles sur une livraison (`assign`, `pickup`, `deliver`, `cancel`, `confirm-location`, `confirm-pickup`, `acknowledge`). Les transitions d'état ne sont pas modélisées explicitement avec une machine à états.

## Risques potentiels

| Risque | Sévérité | Mitigation recommandée |
|---|---|---|
| OSRM API publique sans clé ni SLA | Haute | Héberger OSRM en propre ou migrer vers Mapbox/Google Directions |
| Plan Pusher gratuit (limites connexions) | Haute | Surveiller quota, prévoir upgrade ou migrer vers Ably/Socket.io |
| `ADMIN_PASSWORD` stocké en plaintext dans l'env | Moyenne | Migrer vers hash bcrypt avec salt |
| Pas de rate-limiting sur `/api/tracking` | Moyenne | Ajouter middleware Upstash ou similaire |
| Pas de validation des coordonnées GPS | Faible | Ajouter validation `lat ∈ [-90,90]`, `lng ∈ [-180,180]` |
| `CourierLocation` croît sans limite | Faible | Ajouter un job de purge (ex: garder 30 jours) |

## Dette technique

| Problème | Impact |
|---|---|
| **Aucun test** (unitaire, intégration, E2E) | Risque élevé lors des refactors |
| **Auth inline** dans chaque route API | Duplication, risque d'oubli sur une route |
| **`next@16.2.3`** — version très récente (potentiellement beta/RC) | Breaking changes probables |
| **Pas de logging structuré** | Pas de Sentry/Datadog — debugging difficile en prod |
| **Mobile apps** présentes mais non intégrées au build principal | Ambiguïté sur leur statut et leur framework |
| **Pas de machine à états** pour les livraisons | Transitions invalides possibles |

\newpage

# Instructions pour continuer le projet

## Setup local (étape par étape)

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd lakou-delivery

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
# Créer un fichier .env à la racine avec :
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://user:pass@host/db"
PUSHER_APP_ID="votre-app-id"
PUSHER_SECRET="votre-secret"
NEXT_PUBLIC_PUSHER_KEY="votre-cle-publique"
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="votre-cle-google-maps"
ADMIN_SECRET="un-secret-fort-aleatoire"
ADMIN_PASSWORD="votre-mot-de-passe-admin"

# 4. Initialiser la base de données
npx prisma migrate dev      # Applique les migrations
npm run seed                # Insérer des données de test (optionnel)

# 5. Générer le client Prisma
npx prisma generate

# 6. Lancer en développement
npm run dev
# → http://localhost:3000       (Dashboard admin)
# → http://localhost:3000/login (Login)

# 7. Accéder à l'interface admin
# URL : http://localhost:3000/login
# Mot de passe : valeur de ADMIN_PASSWORD dans .env
```

## Points d'entrée du code

| Fonctionnalité | Fichier |
|---|---|
| **Dashboard admin principal** | `app/page.tsx` |
| **App coursier** | `app/courier/[id]/page.tsx` |
| **Carte temps réel** | `components/map/DeliveryMap.tsx` |
| **Hook GPS coursier** | `lib/useGpsTracking.ts` |
| **Authentification session** | `lib/auth.ts` |
| **Réception positions GPS** | `app/api/tracking/route.ts` |
| **Logique livraisons** | `app/api/deliveries/[id]/route.ts` |
| **Schéma base de données** | `prisma/schema.prisma` |
| **Types TypeScript** | `lib/types.ts` |
| **Calculs géographiques** | `lib/geo.ts` |
| **Routing OSRM** | `lib/osrm.ts` |

## Recommandations pour les prochaines améliorations

### Priorité haute

1. **Ajouter des tests** — Commencer par les routes API critiques (`/api/tracking`, `/api/deliveries/[id]`) avec Vitest ou Jest. Ajouter des tests E2E avec Playwright pour le workflow principal.

2. **Middleware d'authentification centralisé** — Créer un vrai `middleware.ts` Next.js qui vérifie le cookie de session pour toutes les routes `/api/*` (sauf `/api/auth/*`, `/api/track/*`, `/api/tracking`).

3. **Rate limiting sur `/api/tracking`** — Utiliser Upstash Redis (compatible Vercel Edge) pour limiter à 1 requête/5s par `courierId`.

4. **Validation des inputs avec Zod** — Ajouter des schémas de validation sur toutes les routes API pour éviter les données corrompues en base.

### Priorité moyenne

5. **OSRM self-hosted ou API payante** — Migrer vers Mapbox Directions API ou déployer une instance OSRM pour garantir la disponibilité en production.

6. **Hash du mot de passe admin** — Stocker `bcrypt.hash(ADMIN_PASSWORD)` et comparer avec `bcrypt.compare()` au lieu d'une comparaison directe.

7. **Logging structuré** — Intégrer Sentry pour le tracking des erreurs en production. Ajouter des logs structurés (JSON) sur les événements critiques.

8. **Machine à états pour les livraisons** — Implémenter une FSM (ex: XState) pour modéliser explicitement les transitions valides entre statuts de livraison.

### Priorité basse

9. **Multi-admin avec rôles** — Ajouter une table `User` avec rôles (dispatcher, manager, viewer) et migrer vers NextAuth.js.

10. **Notifications push natives** — Implémenter Web Push API pour les coursiers (VAPID keys), remplacer la dépendance à Pusher pour les notifications.

11. **Export des données** — Permettre l'export CSV/PDF des livraisons du jour et des statistiques par coursier.

12. **Purge automatique de CourierLocation** — Ajouter un cron job (via Vercel Cron ou pg_cron) pour supprimer les positions de plus de 30 jours.

13. **Clarifier le dossier `mobile/`** — Déterminer le framework utilisé (React Native, Expo, Flutter ?) et intégrer au processus de build principal.

---

\vspace{2cm}

\begin{center}
\textcolor{darkgray}{\rule{0.5\textwidth}{0.4pt}}

\textcolor{darkgray}{\small Rapport généré par analyse statique du code source}

\textcolor{darkgray}{\small Dernière version analysée : commit \texttt{8408b16} — fix: toast notification persists until manually closed}

\textcolor{darkgray}{\small Lakou Delivery — Bizerte, Tunisie — 2026}
\end{center}

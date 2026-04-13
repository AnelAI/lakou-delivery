# Spécification Fonctionnelle — Lakou Delivery Admin
**Version :** 2.0  
**Date :** 13 avril 2026  
**Statut :** Implémenté — déployé sur Vercel  

---

## 1. Contexte et objectifs

### 1.1 Contexte

Lakou Delivery est une société de livraison de courses opérant en zone urbaine. Les coursiers se déplacent principalement en moto. L'administration reçoit des demandes de livraison et doit les dispatcher aux coursiers disponibles en temps réel.

**Problèmes identifiés à résoudre :**
- Absence de visibilité sur la position des coursiers en temps réel
- Attribution des courses sans optimisation des trajets (perte de temps, de carburant)
- Comportements non conformes : pauses non autorisées pendant les courses, déviations d'itinéraire
- Aucun système d'alerte automatique pour détecter ces anomalies

### 1.2 Objectifs du système

| Priorité | Objectif |
|----------|----------|
| P1 | Visualiser en temps réel la position de chaque coursier sur une carte |
| P1 | Affecter les courses aux coursiers depuis l'interface admin |
| P1 | Détecter et alerter les pauses non autorisées (> 5 minutes sans mouvement pendant une course) |
| P1 | Détecter et alerter les déviations d'itinéraire |
| P2 | Optimiser l'ordre des courses assignées à chaque coursier (distance + temps) |
| P2 | Permettre aux coursiers de mettre à jour l'état de leurs livraisons depuis leur téléphone |

### 1.3 Utilisateurs

| Profil | Accès | Description |
|--------|-------|-------------|
| Administrateur | Interface web (PC) | Dispatching, surveillance, gestion des coursiers |
| Coursier | Page mobile (`/courier/[id]`) | Activation du tracking GPS, suivi de ses courses |

---

## 2. Modèle de données

### 2.1 Entités

#### Coursier (`Courier`)
| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique |
| `name` | String | Nom complet |
| `phone` | String | Numéro de téléphone |
| `status` | Enum | `offline` / `available` / `busy` / `paused` |
| `currentLat` | Float? | Latitude actuelle |
| `currentLng` | Float? | Longitude actuelle |
| `lastSeen` | DateTime? | Dernière émission GPS |
| `speed` | Float | Vitesse en km/h |
| `heading` | Float | Cap en degrés |

#### Course (`Delivery`)
| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique |
| `orderNumber` | String | Numéro de commande (format `ORD-{timestamp}-{seq}`) |
| `customerName` | String | Nom du client |
| `customerPhone` | String | Téléphone du client |
| `pickupAddress` | String | Adresse de collecte |
| `pickupLat/Lng` | Float | Coordonnées de collecte |
| `deliveryAddress` | String | Adresse de livraison |
| `deliveryLat/Lng` | Float | Coordonnées de livraison |
| `notes` | String? | Instructions spéciales |
| `status` | Enum | `pending` / `assigned` / `picked_up` / `delivered` / `cancelled` |
| `courierId` | UUID? | Coursier assigné |
| `priority` | Int | 0 = normale, 1 = haute, 2 = urgente |
| `estimatedTime` | Int? | Temps estimé en minutes |
| `distance` | Float? | Distance totale en km |
| `assignedAt` | DateTime? | Horodatage d'affectation |
| `pickedUpAt` | DateTime? | Horodatage de collecte |
| `deliveredAt` | DateTime? | Horodatage de livraison |

#### Position (`CourierLocation`)
Historique complet des positions GPS. Chaque point contient : `lat`, `lng`, `speed`, `heading`, `timestamp`.

#### Alerte (`Alert`)
| Champ | Type | Valeurs possibles |
|-------|------|-------------------|
| `type` | Enum | `unauthorized_pause` / `route_deviation` / `speed_violation` / `offline` |
| `severity` | Enum | `info` / `warning` / `critical` |
| `resolved` | Boolean | `false` = active, `true` = résolue |

### 2.2 Cycle de vie d'une course

```
pending → assigned → picked_up → delivered
   ↓          ↓
cancelled  cancelled
```

### 2.3 Cycle de vie d'un coursier

```
offline ←──────────────────────────────────────┐
   ↓ (tracking activé)                          │ (tracking arrêté)
available ──→ busy (course assignée) ──────────→ available
              ↕ (si pause détectée)
            paused (alerte générée)
```

---

## 3. Fonctionnalités — Interface Administrateur

### 3.1 Dashboard principal (`/`)

Le dashboard est la vue centrale de l'application. Il est divisé en trois zones :

#### 3.1.1 Barre de statistiques (haut de page)

Affichage en temps réel (mise à jour via WebSocket + polling 30s) :

| Indicateur | Description |
|-----------|-------------|
| Coursiers actifs | Nombre de coursiers `available` ou `busy` / total |
| En attente | Courses au statut `pending` |
| En cours | Courses au statut `assigned` ou `picked_up` |
| Livrées aujourd'hui | Courses livrées depuis 00:00 du jour courant |
| Alertes actives | Nombre d'alertes non résolues |

#### 3.1.2 Panel des coursiers (gauche)

- Liste triée par priorité de statut : `busy` > `available` > `paused` > `offline`
- Champ de recherche par nom ou téléphone
- Pour chaque coursier : avatar coloré selon statut, badge de statut, nombre de courses en cours, icône d'alerte active si applicable, horodatage "vu il y a X"
- Clic → centre la carte sur ce coursier et ouvre son popup
- Bouton "Ajouter" → formulaire de création de coursier

**Couleurs des statuts :**
| Statut | Couleur | Signification |
|--------|---------|---------------|
| `offline` | Gris | Tracking désactivé |
| `available` | Vert | Disponible pour une course |
| `busy` | Bleu | En cours de livraison |
| `paused` | Jaune | Pause détectée (alerte possible) |

#### 3.1.3 Carte temps réel (centre)

- Fond : OpenStreetMap (sans clé API)
- Icône moto 🏍️ pour chaque coursier avec sa position GPS actuelle
- Icône rouge superposée sur l'icône si alerte active non résolue
- Marqueur 📦 (violet) pour les points de collecte des courses actives
- Marqueur 🏠 (orange) pour les adresses de livraison des courses actives
- Ligne pointillée bleue entre collecte et livraison pour les courses `assigned`/`picked_up`
- Popup au clic sur un coursier : nom, téléphone, statut, vitesse, nombre de courses

#### 3.1.4 Panel des courses (droite)

Trois onglets :
- **En attente** : courses `pending` à dispatcher
- **En cours** : courses `assigned` ou `picked_up`
- **Historique** : courses `delivered` ou `cancelled`

Pour chaque course :
- Numéro de commande, nom client, adresses de collecte et livraison (tronquées)
- Badge de statut coloré, coursier assigné si applicable, temps estimé
- Expandable (clic) → détails + actions contextuelles

**Actions disponibles selon le statut :**
| Statut | Actions |
|--------|---------|
| `pending` | Assigner à un coursier (select) |
| `assigned` | Marquer comme récupérée / Annuler |
| `picked_up` | Marquer comme livrée |
| `pending` ou `assigned` | Annuler |

**Assignation :** La liste des coursiers proposés inclut ceux au statut `available` et `busy` (un coursier occupé peut recevoir une course supplémentaire qui sera mise en file).

### 3.2 Gestion des coursiers (`/couriers`)

Vue en grille de fiches coursiers. Pour chaque fiche :
- Initiale en avatar coloré selon statut
- Nom, téléphone
- Statistiques : courses en cours, alertes actives, vitesse actuelle
- Coordonnées GPS actuelles et heure de dernière mise à jour
- Résumé des alertes actives non résolues
- Sélecteur de statut manuel (utile pour passer un coursier en `offline` à distance)
- Bouton de suppression (avec confirmation)
- Lien vers la page de tracking mobile du coursier (`/courier/[id]`)

### 3.3 Centre d'alertes (`/alerts`)

Liste des alertes avec filtrage (actives / toutes / résolues). Pour chaque alerte :
- Nom du coursier, type d'alerte, message détaillé
- Badge de sévérité (warning / critical)
- Horodatage relatif et absolu
- Bouton de résolution individuelle
- Bouton "Tout résoudre" (si alertes actives)

**Types d'alertes :**
| Type | Déclencheur | Sévérité |
|------|-------------|----------|
| `unauthorized_pause` | Immobilité > 5 min pendant une course | `warning` (<10 min) / `critical` (≥10 min) |
| `route_deviation` | Distance au trajet prévu > 300 m | `warning` |
| `speed_violation` | Vitesse anormale | `info` |
| `offline` | Perte de signal | `warning` |

---

## 4. Fonctionnalités — Interface Coursier Mobile (`/courier/[id]`)

Page responsive optimisée pour mobile (thème sombre). Accessible via le lien fourni par l'admin.

### 4.1 Activation du tracking

- Bouton "▶ Démarrer le tracking" → demande la permission GPS au navigateur
- Utilise l'API `navigator.geolocation.watchPosition()` avec haute précision
- Envoie la position toutes les fois que le GPS détecte un changement (≥ 5 secondes, ≥ 10 mètres selon le navigateur)
- Bascule le statut coursier de `offline` → `available` automatiquement
- Affiche la position actuelle (latitude, longitude) et la vitesse en km/h
- Bouton "⏹ Arrêter le tracking" → arrête l'envoi, bascule en `offline`

### 4.2 Suivi des courses assignées

Liste des courses au statut `assigned` ou `picked_up` :
- Adresse de collecte et adresse de livraison
- Nom du client, temps estimé, distance
- Notes spéciales (si présentes)
- Actions rapides :
  - "Colis récupéré" (`assigned` → `picked_up`)
  - "Course livrée !" (`picked_up` → `delivered`)

---

## 5. Surveillance et détection des anomalies

### 5.1 Détection de pause non autorisée

**Condition de déclenchement :**
1. Le coursier est au statut `busy` (course en cours)
2. La distance parcourue entre deux positions consécutives est < 50 mètres
3. L'analyse des 20 dernières positions montre une immobilité continue ≥ 5 minutes

**Comportement :**
- Création d'une alerte `unauthorized_pause`
- Sévérité `warning` si durée entre 5 et 10 minutes
- Sévérité `critical` si durée ≥ 10 minutes
- Notification instantanée à tous les admins connectés via WebSocket
- Bannière d'alerte affichée sur la carte du dashboard
- **Une seule alerte active à la fois** par coursier pour ce type (pas de doublon)

**Auto-résolution :**
- Dès que le coursier recommence à se déplacer (déplacement ≥ 50 m détecté)
- Toutes ses alertes `unauthorized_pause` non résolues passent à `resolved`
- Les alertes disparaissent du dashboard en temps réel

### 5.2 Détection de déviation d'itinéraire

**Algorithme :**
- Calcul de la distance minimale entre la position du coursier et chaque segment du trajet prévu (formule point-segment avec Haversine)
- Si cette distance dépasse 300 mètres → alerte `route_deviation`

**Note :** Le trajet de référence est une ligne directe entre les points (collecte → livraison). Dans une version future, ce trajet sera calculé via une API de routage.

### 5.3 Protocole de transmission GPS

Chaque mise à jour de position envoyée par un coursier déclenche :
1. Enregistrement en base (`CourierLocation`) pour l'historique
2. Mise à jour des champs temps réel du coursier (`currentLat`, `currentLng`, `speed`, `heading`, `lastSeen`)
3. Analyse comportementale (pause, déviation)
4. Diffusion aux admins connectés via Pusher Channels

**Paramètres de seuil configurables dans `app/api/tracking/route.ts` :**
```
PAUSE_THRESHOLD_MINUTES = 5    // minutes d'immobilité avant alerte
MOVEMENT_THRESHOLD_KM   = 0.05 // 50 m = considéré "en mouvement"
```

---

## 6. Optimisation des routes

### 6.1 Algorithme d'affectation

Lors de l'assignation d'une course à un coursier, le système calcule automatiquement :

- **Distance totale** = distance(position coursier → collecte) + distance(collecte → livraison)
- **Temps estimé** = distance totale / vitesse moyenne de 30 km/h en ville

Ces valeurs sont stockées dans la course et affichées au coursier.

### 6.2 Optimisation de file (TSP Nearest-Neighbor)

Lorsqu'un coursier a plusieurs courses en attente, l'ordre optimal est calculé par l'algorithme du plus proche voisin (*nearest-neighbor*) :

1. Point de départ = position actuelle du coursier
2. Sélectionner la collecte la plus proche parmi les courses restantes
3. Se déplacer vers la livraison de cette course (nouveau point courant)
4. Répéter jusqu'à épuisement des courses

Cet algorithme donne une approximation raisonnable en O(n²) sans les contraintes de calcul du TSP exact.

---

## 7. Architecture technique

### 7.1 Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (REST, serverless) |
| Temps réel | **Pusher Channels** (WebSocket managé, serverless-compatible) |
| Base de données | **Neon PostgreSQL** (serverless, cloud) via Prisma 5 |
| Cartographie | Leaflet.js 1.9 + OpenStreetMap (sans clé API) |
| Hébergement | **Vercel** (serverless, déploiement continu depuis Git) |
| PWA | Manifest + Service Worker + WakeLock API |

**Pourquoi Pusher ?** Les fonctions serverless Vercel ne peuvent pas maintenir de connexions persistantes. Pusher est un service managé qui reçoit un `trigger()` HTTP depuis chaque fonction et diffuse aux clients connectés via WebSocket.

**Pourquoi Neon ?** SQLite utilise le système de fichiers local, incompatible avec les fonctions serverless éphémères. Neon offre un PostgreSQL compatible serverless avec pool de connexions (`pgbouncer`) et une URL directe pour les migrations Prisma.

### 7.2 Communication temps réel (Pusher Channels)

**Canaux :**
| Canal | Abonnés | Usage |
|-------|---------|-------|
| `admin` | Tous les admins connectés | Broadcast général |
| `courier-{id}` | Coursier spécifique | Notifications ciblées |

**Événements :**
| Événement | Canal | Émetteur | Description |
|-----------|-------|----------|-------------|
| `courier-location-update` | `admin` | API `/tracking` | Nouvelle position GPS d'un coursier |
| `couriers-updated` | `admin` | API `/couriers` | Ajout / modification / suppression de coursier |
| `deliveries-new` | `admin` | API `/deliveries` | Nouvelle course créée |
| `deliveries-updated` | `admin` | API `/deliveries/[id]` | Course modifiée (statut, assignation) |
| `alerts-new` | `admin` | API `/tracking` | Nouvelle alerte détectée |
| `alerts-updated` | `admin` | API `/alerts/[id]` | Alerte résolue |
| `delivery-assigned` | `courier-{id}` | API `/deliveries/[id]` | Notification push d'une nouvelle course au coursier |

**Flux GPS :** Le coursier envoie sa position via `POST /api/tracking` (HTTP). La route serverless persiste en base et appelle `pusher.trigger()` pour diffuser aux admins. Il n'y a pas de connexion WebSocket côté backend.

### 7.3 API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/couriers` | Liste des coursiers avec courses et alertes actives |
| POST | `/api/couriers` | Créer un coursier |
| GET | `/api/couriers/[id]` | Détail + historique positions |
| PATCH | `/api/couriers/[id]` | Mettre à jour (statut, position...) |
| DELETE | `/api/couriers/[id]` | Supprimer un coursier |
| GET | `/api/deliveries` | Liste des courses (filtrable par statut, courierId) |
| POST | `/api/deliveries` | Créer une course |
| PATCH | `/api/deliveries/[id]` | Changer statut (action: assign/pickup/deliver/cancel) |
| DELETE | `/api/deliveries/[id]` | Supprimer une course |
| POST | `/api/tracking` | Réception position GPS + analyse comportementale |
| GET | `/api/alerts` | Liste des alertes (filtrable par resolved, courierId) |
| PATCH | `/api/alerts/[id]` | Résoudre une alerte |
| GET | `/api/stats` | Statistiques agrégées du dashboard |

---

## 8. Déploiement (Vercel + Neon + Pusher)

### 8.1 Variables d'environnement requises

| Variable | Source | Usage |
|----------|--------|-------|
| `DATABASE_URL` | Neon → *Connection pooling URL* | Requêtes Prisma en production |
| `DIRECT_URL` | Neon → *Direct connection URL* | Migrations Prisma (`prisma migrate deploy`) |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher dashboard | Clé publique côté client |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher dashboard | Région (ex: `eu`) |
| `PUSHER_APP_ID` | Pusher dashboard | Déclenchement serveur |
| `PUSHER_SECRET` | Pusher dashboard | Authentification serveur |

### 8.2 Procédure de mise en production

1. **Neon** → créer un projet PostgreSQL, copier les deux URLs de connexion
2. **Pusher** → créer une app Channels, noter les 4 clés
3. **Vercel** → importer le dépôt Git, renseigner toutes les variables d'environnement
4. **Migrations** → exécuter `prisma migrate deploy` (automatisé via `vercel.json` : `buildCommand: "prisma generate && next build"`)
5. Le fichier `vercel.json` est minimal — Vercel détecte automatiquement Next.js

### 8.3 Architecture serverless

```
Coursier (mobile)          Admin (browser)
     │                          │
     │ POST /api/tracking        │ subscribe(ADMIN_CHANNEL)
     ▼                          │
┌─────────────┐    trigger()    │
│  Vercel Fn  │──────────────►  Pusher ──► WebSocket ──► browser
│  (serverless)│                │
└──────┬──────┘                 │
       │ prisma                 │
       ▼                        │
  Neon PostgreSQL               │
```

Chaque requête HTTP déclenche une fonction Vercel indépendante. Pusher joue le rôle de bus événementiel entre les fonctions et les clients.

---

## 9. Règles métier (inchangées)

| Règle | Description |
|-------|-------------|
| RG-01 | Un coursier `offline` passe automatiquement à `available` dès réception de sa première position GPS |
| RG-02 | Un coursier passe à `busy` dès qu'une course lui est assignée |
| RG-03 | Un coursier revient à `available` quand sa dernière course active est marquée `delivered` |
| RG-04 | Une alerte `unauthorized_pause` ne peut être créée qu'une fois par coursier tant qu'elle n'est pas résolue |
| RG-05 | Une alerte `unauthorized_pause` est automatiquement résolue dès que le coursier se remet en mouvement |
| RG-06 | Seuls les coursiers au statut `available` ou `busy` sont proposés lors de l'assignation |
| RG-07 | Une course `cancelled` ne peut plus changer de statut |
| RG-08 | L'annulation d'une course libère automatiquement le coursier si c'était sa seule course active |
| RG-09 | Le numéro de commande est généré automatiquement : `ORD-{timestamp}-{random}` |
| RG-10 | La distance et le temps estimé sont calculés à l'assignation, basés sur la position GPS actuelle du coursier |

---

## 10. Évolutions prévues (hors périmètre v1)

| Fonctionnalité | Priorité | Notes |
|----------------|----------|-------|
| Authentification admin (login/logout) | P1 | Actuellement accessible sans authentification |
| Authentification coursier (PIN ou lien signé) | P1 | La page `/courier/[id]` est accessible par URL |
| Calcul de trajet réel (API OSRM ou Google Maps) | P2 | Remplace la ligne droite actuelle |
| Notifications push SMS/WhatsApp aux coursiers | P2 | Pour l'assignation de nouvelles courses |
| Application mobile native (React Native) | P2 | Plus fiable que le GPS navigateur |
| Tableau de bord analytique | P3 | Performance coursiers, volumes, zones chaudes |
| Gestion multi-équipes / zones | P3 | Segmentation par quartier ou équipe |
| Intégration avec système de caisse / bon de livraison | P3 | Génération PDF, signature électronique |
| Configuration des seuils d'alerte via interface | P3 | Actuellement hardcodé dans le code |

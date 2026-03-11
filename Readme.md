# 💕 CoupleQuest

Quiz de couple avec révélation — mode blind, lettres secrètes, récap intelligent.

---

## Structure du projet

```
couplequest/
├── frontend/
│   ├── index.html       ← App complète (auth + quiz + résultats)
│   ├── style.css        ← Tous les styles
│   ├── script.js        ← Logique frontend + appels API
│   └── assets/          ← Dossier pour les images statiques si besoin
├── backend/
│   ├── server.js        ← Point d'entrée Express
│   ├── db.js            ← Connexion Supabase
│   ├── middleware/
│   │   └── auth.js      ← Vérification JWT
│   └── routes/
│       ├── auth.js      ← Inscription / Connexion
│       ├── couples.js   ← Créer / Rejoindre un couple
│       └── answers.js   ← Sauvegarder / Récupérer les réponses
├── supabase_schema.sql  ← Schéma à exécuter dans Supabase
├── package.json
├── .env.example
└── .gitignore
```

---

## Installation

### 1. Cloner et installer les dépendances

```bash
git clone <ton-repo>
cd couplequest
npm install
```

### 2. Configurer Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project**
2. Choisis un nom, un mot de passe, une région (Europe West de préférence)
3. Une fois créé, va dans **SQL Editor** et colle le contenu de `supabase_schema.sql` → **Run**
4. Va dans **Storage** → **New bucket** → Nom : `avatars` → cocher **Public** → Save
5. Va dans **Settings > API** → copie :
   - `Project URL`
   - `service_role` key (pas l'anon key — la service role)

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Édite `.env` :

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...   ← service_role key
JWT_SECRET=mets-une-longue-chaine-aleatoire-ici
PORT=3000
FRONTEND_URL=http://localhost:5500
```

> ⚠️ Ne committe jamais le fichier `.env` — il est dans `.gitignore`

### 4. Lancer le projet en local

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
# Ouvre frontend/index.html avec Live Server (VS Code)
# ou n'importe quel serveur statique sur le port 5500
```

Le backend tourne sur `http://localhost:3000`
Le frontend tourne sur `http://localhost:5500`

---

## Routes API

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Créer un compte (multipart/form-data : prenom, email, password, photo) |
| POST | `/api/auth/login` | Se connecter (JSON : email, password) |
| GET | `/api/auth/me` | Profil de l'utilisateur connecté (JWT requis) |

### Couples
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/couples/create` | Créer un couple → reçoit un code (JWT requis) |
| POST | `/api/couples/join` | Rejoindre un couple avec un code (JWT requis) |
| GET | `/api/couples/me` | Récupérer son couple + statut des réponses (JWT requis) |

### Answers
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/answers` | Sauvegarder ses réponses + lettre (JWT requis) |
| GET | `/api/answers` | Récupérer les réponses des deux (JWT requis, les deux doivent avoir répondu) |

---

## Déploiement sur Render (gratuit)

### Backend

1. Va sur [render.com](https://render.com) → **New Web Service**
2. Connecte ton repo GitHub
3. Configure :
   - **Build Command** : `npm install`
   - **Start Command** : `node backend/server.js`
   - **Environment** : Node
4. Dans **Environment Variables**, ajoute les mêmes variables que ton `.env`
5. Change `FRONTEND_URL` avec l'URL de ton frontend déployé

### Frontend

Option A — Render Static Site :
1. **New Static Site** sur Render
2. Root directory : `frontend`
3. No build command needed

Option B — Vercel :
```bash
npm i -g vercel
cd frontend
vercel
```

### Après déploiement

Dans `script.js`, la ligne suivante gère automatiquement l'URL API :
```js
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';
```
En production, les requêtes vont vers `/api` — assure-toi que le frontend et le backend sont sur le même domaine, ou configure un proxy Render.

---

## Flux utilisateur

```
1. Personne 1 crée un compte → upload photo → reçoit le code couple (ex: K7X4NP)
2. Personne 2 crée un compte → entre le code K7X4NP → couple lié
3. Personne 1 commence le quiz → répond aux 52 questions → écrit sa lettre secrète → scelle
4. Personne 2 fait pareil sur son appareil (même heure ou plus tard)
5. Les deux voient le bouton "Révélation" → cliquent ensemble
6. Résultats : convergences ✅ / à surveiller 👀 / à discuter 🔥 + gages + lettres
```

---

## Personnalisation rapide

- **Couleurs** → `style.css` lignes 1-15 (variables CSS `:root`)
- **Questions** → bloc `<script>` dans `frontend/index.html` (tableau `QUESTIONS`)
- **Gages** → tableau `GAGES` dans `frontend/script.js`
- **Nom de l'app** → chercher "CoupleQuest" dans `index.html`
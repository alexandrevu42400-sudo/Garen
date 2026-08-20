# LoL Coach

Une petite app statique (HTML/CSS/JS, sans build) pour t'aider sur League of Legends :

- Liste de **tous les champions**, chargée en direct depuis l'API officielle **Data Dragon** de Riot — toujours synchronisée avec le dernier patch, aucune mise à jour manuelle nécessaire.
- **Coach de matchup** : guide détaillé écrit à la main pour **Garen** contre 60 adversaires de top lane (rating du matchup, difficulté de lane, ordre de compétences, sorts d'invocateur, objet de départ, astuces, comment jouer le matchup, vidéo si disponible). Pour les autres champions, l'app affiche des conseils génériques basés sur les classes des champions, en attendant que tu enrichisses la base.
- **Compo & Build** : indique ton champion et jusqu'à 5 champions adverses, l'app analyse la compo (dégâts magiques/physiques, CC, sustain, risque de dive) et te propose des pistes de build.
- **Apparence** : choisis n'importe quel champion et n'importe lequel de ses skins comme fond d'écran de l'application (splash art officiel), avec un réglage d'opacité du voile pour garder le texte lisible. Ton choix est mémorisé sur cet appareil.

## Déployer sur GitHub Pages

1. Crée un nouveau dépôt GitHub (ou utilise un dépôt existant) et pousse le contenu de ce dossier à la racine (ou dans un sous-dossier, voir plus bas).
   ```bash
   git init
   git add .
   git commit -m "Initial commit — LoL Coach"
   git branch -M main
   git remote add origin https://github.com/<ton-user>/<ton-repo>.git
   git push -u origin main
   ```
2. Dans le dépôt GitHub : **Settings → Pages**.
3. Sous "Build and deployment", choisis **Source: Deploy from a branch**, puis branche `main` et dossier `/ (root)` (ou `/site` si tu as gardé ce dossier tel quel dans un mono-repo — adapte en conséquence).
4. Enregistre. Après une minute ou deux, ton app sera disponible à `https://<ton-user>.github.io/<ton-repo>/`.

Aucune étape de build n'est nécessaire : c'est du HTML/CSS/JS pur, les modules ES sont chargés directement par le navigateur.

### Tester en local avant de déployer

Comme le site utilise des modules JavaScript (`type="module"`), tu ne peux pas juste double-cliquer sur `index.html` (les navigateurs bloquent les modules en `file://`). Lance un petit serveur local à la place, par exemple :

```bash
# Python
python3 -m http.server 8000

# ou Node (si tu as npx)
npx serve .
```

Puis ouvre `http://localhost:8000`.

## Structure du projet

```
index.html          → structure de la page, 4 onglets
css/style.css        → thème visuel (Hextech sombre/or) + fond d'écran personnalisable
js/ddragon.js         → accès à l'API Data Dragon (champions, images, skins, dernier patch)
js/garenData.js       → base de données des 64 matchups Garen (rédigée à la main)
js/heuristics.js       → conseils génériques (classes de champions) + analyse de compo adverse
js/app.js              → logique de l'application (navigation, rendu, état, sauvegarde locale)
```

## Étendre la base de données à d'autres champions

Pour l'instant, seul Garen a un guide de matchup détaillé. Pour ajouter un champion :

1. Crée un nouveau fichier `js/<nomChampion>Data.js` sur le modèle de `js/garenData.js` (même structure d'objet : `name`, `rating`, `laning`, `skillOrder`, `altSkillOrder`, `summoners`, `starterItem`, `tips`, `howTo`, `video`).
2. Importe-le dans `js/app.js`, indexe-le comme `state.garenIndex` (renomme en quelque chose de plus générique, par exemple `state.matchupData = { Garen: garenIndex, Ahri: ahriIndex, ... }`).
3. Adapte `renderMatchup()` pour choisir l'index correspondant au champion sélectionné (`myId`) au lieu de ne vérifier que `"Garen"`.

La liste `RATING_META` et le mapping `GAREN_ABILITIES` peuvent être renommés/généralisés (ou dupliqués par champion, chaque champion ayant ses propres sorts Q/W/E) selon tes besoins.

## Notes

- Ce projet n'est pas affilié à Riot Games. Les images et données de champions proviennent de l'API publique Data Dragon.
- Le guide de matchup Garen a été rédigé par l'auteur du projet.
- Les conseils de l'onglet "Compo & Build" sont des heuristiques générales (basées sur les classes de champions et quelques listes maison pour le CC/sustain/burst) — pas une base de données exhaustive par champion.

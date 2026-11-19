# liens.annecharlotte.be

Les liens courts d'Anne-Charlotte, avec le nombre de clics et d'où ils viennent.

- **Tableau** : https://liens.annecharlotte.be/stats/ (la clé est dans le favori, `#cle=…`, et dans le trousseau Mac : `liens-annecharlotte-cle-tableau`). On y crée aussi les nouveaux liens : ils marchent tout de suite.
- **Un lien par contenu** : depuis /stats/, « + Nouveau lien » → page d'arrivée (liste `destinations`, complétable : « + Une nouvelle page ») + plateforme + titre du contenu. L'outil crée `liens.annecharlotte.be/<page>/<id>` (5 caractères) et ajoute à la destination `utm_source` (plateforme), `utm_medium`, `utm_campaign` (titre) et `utm_content` (id). QR code en PNG/SVG pour le papier. Les anciens liens à nom choisi (`/bingo`) restent valables.
- **Redirection** : la page du lien compte le clic (sendBeacon vers `go`) et redirige aussitôt ; les paramètres reçus (`?utm_…`) passent à la destination et `utm_campaign` est comptée. Sur annecharlotte.be, la destination reçoit `?via=<lien>` : `public/js/liens-suivi.js` du site (chargé par Base.astro et les pages statiques /bingo, /bingo/suite, /novembre, /lunchbox) compte alors le 1er clic sur un PDF, vers RDV (/bilan/ ou cal.com) et sur WhatsApp. **Toute nouvelle page statique de lead magnet doit charger `/js/liens-suivi.js`.**
- **Données** : Supabase « Liens annecharlotte » (`bgenoxwpwhqvsqdupnub`, Paris, organisation gratuite « Anne-Charlotte - liens »). Tables `liens` et `clics`, aucun accès public direct ; seules les fonctions `go` (ouverte) et `tableau` (clé `CLE_TABLEAU`) y touchent. Ni IP, ni cookie : source, appareil, pays déduit du fuseau horaire. Mot de passe de la base : trousseau Mac, `supabase-liens-annecharlotte`.
- **Publication** : GitHub Pages via `.github/workflows/publier.yml` (à chaque push + chaque nuit à 4 h 15 UTC). `site/build.mjs` lit les liens dans Supabase et génère `_site/`. Secret GitHub requis : `CLE_TABLEAU`.
- **Aperçu local** : `CLE_TABLEAU=… node site/build.mjs && node site/serveur-local.mjs` → http://localhost:4407
- **Fonctions** : `supabase functions deploy go tableau --use-api` ; base : `supabase db push`.

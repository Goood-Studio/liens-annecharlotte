# liens.annecharlotte.be

Les liens courts d'Anne-Charlotte, avec le nombre de clics et d'où ils viennent.

- **Tableau** : https://liens.annecharlotte.be/stats/ (la clé est dans le favori, `#cle=…`, et dans le trousseau Mac : `liens-annecharlotte-cle-tableau`). On y crée aussi les nouveaux liens : ils marchent tout de suite.
- **Un lien** : `liens.annecharlotte.be/<nom>` → page qui compte le clic (sendBeacon vers la fonction `go`) et redirige aussitôt. Sur annecharlotte.be, la destination reçoit `?via=<nom>` : la page /bingo/ s'en sert pour compter les téléchargements du PDF.
- **Données** : Supabase « Liens annecharlotte » (`bgenoxwpwhqvsqdupnub`, Paris, organisation gratuite « Anne-Charlotte - liens »). Tables `liens` et `clics`, aucun accès public direct ; seules les fonctions `go` (ouverte) et `tableau` (clé `CLE_TABLEAU`) y touchent. Ni IP, ni cookie : source, appareil, pays déduit du fuseau horaire. Mot de passe de la base : trousseau Mac, `supabase-liens-annecharlotte`.
- **Publication** : GitHub Pages via `.github/workflows/publier.yml` (à chaque push + chaque nuit à 4 h 15 UTC). `site/build.mjs` lit les liens dans Supabase et génère `_site/`. Secret GitHub requis : `CLE_TABLEAU`.
- **Aperçu local** : `CLE_TABLEAU=… node site/build.mjs && node site/serveur-local.mjs` → http://localhost:4407
- **Fonctions** : `supabase functions deploy go tableau --use-api` ; base : `supabase db push`.

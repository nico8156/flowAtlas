# Présentation FlowAtlas — publication et exploitation

État : **publié le 1er octobre 2026**, sur
[flowatlas.anchor-event.fr](https://flowatlas.anchor-event.fr/).
Les commandes npm de ce dossier construisent et testent les artefacts locaux ;
elles ne modifient ni AWS, ni Caddy distant, ni les DNS.

Le domaine confirmé est **`flowatlas.anchor-event.fr`**. Il est renseigné
dans l’overlay Compose actif sur le serveur partagé.

## Modèle repris

Les références locales inspectées sont :

- Dogsout : `deployment/ec2/Caddyfile.dogsout-site`,
  `compose.caddy-site-overlay.yaml`, `README.md` et `deployment/dns-ovh.md` ;
- Fragments : `infra/aws/compose/platform/staging/Caddyfile` et
  `docker-compose.yml`.

Le site utilise le Caddy partagé du projet Compose `platform-staging`, sur
l’hôte existant. Il possède un vhost dédié et un montage en lecture seule.
Aucun conteneur Node, backend, réseau applicatif ou nouvelle base de données
n’est nécessaire. Le modèle CloudFront du Studio Fragments ne concerne pas
ce site de présentation.

## Préparation locale

Depuis la racine du dépôt, après `npm install` :

```sh
npm run site
npm run site:test:hosting
npm run site:package
shasum -a 256 dist-site.tar.gz
```

- Prévisualisation : `http://localhost:5174`.
- Artefacts statiques : `dist-site/`.
- Archive à transférer ultérieurement : `dist-site.tar.gz`.
- Le test utilise un Caddy Docker temporaire, lié uniquement à `127.0.0.1`,
  puis supprime son conteneur et ses volumes.
- L’archive contient exclusivement le résultat de Vite ; ne pas transférer
  le dépôt complet dans la racine web.

La CSP autorise les feuilles Google Fonts et leurs polices. Aucun script,
traceur, formulaire ou cookie applicatif n’est utilisé. Les polices locales
prennent le relais si Google Fonts est inaccessible.

## Procédure d’intégration initiale

Cette intégration a été effectuée après autorisation de publication. Les
sauvegardes et vérifications de la première release figurent plus bas.

1. Relire l’état réel du serveur partagé,
   ses fichiers Compose, ses overlays actifs et son Caddyfile. Les fichiers
   des dépôts décrivent le modèle, pas une inspection actuelle du serveur.
2. Préparer une release dans `/srv/flowatlas/public/releases/<release-id>`
   via le canal SSM déjà utilisé par la plateforme. Vérifier l’empreinte de
   l’archive avant extraction. Le répertoire `public` ne contient que des
   fichiers destinés au web. Conserver la release précédente.
3. Créer le lien relatif `/srv/flowatlas/public/current` vers
   `releases/<release-id>`. Le montage parent permet au conteneur de voir
   les changements du lien. Les bascules ultérieures doivent remplacer ce
   lien atomiquement ; ne pas monter le lien lui-même comme volume Docker.
4. Installer `Caddyfile.flowatlas` et `compose.caddy-overlay.yaml` dans
   `/srv/flowatlas/`. L’overlay fournit déjà
   `FLOWATLAS_SITE_DOMAIN=flowatlas.anchor-event.fr` au conteneur Caddy.
5. Sauvegarder le Caddyfile principal et la liste complète des fichiers
   Compose actifs. Ajouter seulement cet import au candidat :

   ```caddyfile
   import /etc/caddy/Caddyfile.flowatlas
   ```

6. Ajouter l’overlay FlowAtlas à la commande Compose existante en conservant
   **tous** les overlays Dogsout, Fragments et Anchor. Utiliser explicitement
   `docker compose -p platform-staging`. L’overlay n’est pas autonome et
   n’ajoute aucun port. Valider la configuration Compose fusionnée puis le
   Caddyfile complet dans un conteneur de validation avec tous ses imports,
   variables et montages avant de modifier le service actif.
7. L’ajout initial des montages et de la variable nécessite de recréer le
   service Caddy partagé, ce qu’un simple `caddy reload` ne fait pas.
   Planifier cette courte interruption et garder la configuration précédente
   prête à être réappliquée. Vérifier les vhosts existants avant et après.
8. Au créneau de publication convenu, effectuer le geste DNS ci-dessous et
   activer la configuration validée. Vérifier HTTPS, `/`, les assets, les
   réponses 404 et les autres sites. Caddy gère le certificat du vhost.

Aucun workflow de publication automatique n’est ajouté. La première activation
a suivi la vérification de l’instance, la préparation de la release, la
validation Caddy et la publication de l’entrée DNS par l’utilisateur.

## OVH — configuration active

Entrée créée par l’utilisateur et vérifiée sur `dns109.ovh.net` et
`ns109.ovh.net` le 1er octobre 2026 :

| Champ        | Valeur à préparer     |
| ------------ | --------------------- |
| Zone         | `anchor-event.fr`     |
| Type         | `A`                   |
| Sous-domaine | `flowatlas`           |
| Cible        | `13.39.97.191`        |
| TTL          | Valeur par défaut OVH |

L’adresse a été confirmée par AWS `describe-instances` et `describe-addresses` :
Elastic IP `eipalloc-0d710fc0623c8a76d`, instance `i-004d3e9cbca327d01`,
région `eu-west-3`. Aucune autre entrée DNS n’a été modifiée dans cette opération.

Dans l’espace OVHcloud, ouvrir la zone DNS de `anchor-event.fr`, vérifier
l’absence de conflit A/AAAA/CNAME pour `flowatlas`, puis ajouter uniquement
l’entrée dédiée. Ne modifier ni `dogsout`, ni `api.dogsout`, ni Fragments,
ni le domaine racine, `www`, les MX ou les enregistrements SES/DKIM.

Après propagation, vérifier la réponse DNS auprès des serveurs faisant
actuellement autorité et l’accès HTTPS. Aucun CNAME ACM n’est requis par ce
modèle Caddy ; ce serait une autre procédure avec CloudFront.

## Retour arrière

Pour une mise à jour de contenu, rétablir atomiquement `current` vers la release
précédente puis vérifier la page et ses assets. Pour une première activation,
restaurer le Caddyfile et la liste Compose sauvegardés, valider puis réappliquer
le service Caddy partagé. Les fichiers et volumes des autres produits restent
inchangés. Conserver les artefacts de release pour le diagnostic.

Référence de syntaxe : [serveur de fichiers Caddy](https://caddyserver.com/docs/caddyfile/directives/file_server).

## Première release et vérifications

- Release : `20261001-a14b895`, contenu du commit `a14b895`.
- Répertoire : `/srv/flowatlas/public/releases/20261001-a14b895`.
- Lien actif : `/srv/flowatlas/public/current` vers `releases/20261001-a14b895`.
- Sauvegarde avant activation : `/srv/flowatlas/backups/20261001-a14b895/`.
- Commande SSM d’activation réussie : `a3bb7229-e68c-4be3-8731-4a4f28b4f090`.
- SHA-256 de l’archive : `723336070e88888f766399b20ec0f2121d31089c1a7ee289086e57675a6fae1f`.
- SHA-256 de la page HTTPS servie : `706b8eda708bd975c3a11d13a27ed84fbbe96db1470744bd57498d6bc568e146`.

Le candidat Compose a été comparé au proxy actif : seul l’environnement
FlowAtlas et ses deux montages s’ajoutent. Le Caddyfile complet a passé
`caddy validate` dans un conteneur temporaire utilisant les volumes existants
en lecture seule. Le point de montage vide `/srv/platform/data/flowatlas-public`
a été créé pour permettre cette validation sous `/data` en lecture seule.

Seul le conteneur Caddy a été recréé, avec la même image déjà installée.
Les identifiants et dates de démarrage des autres conteneurs sont restés
identiques. Les réponses des hôtes existants sont restées inchangées :
Dogsout, Fragments et Fragments staging en 200 ; `anchor-event.fr` en 308 ;
la racine de l’API Dogsout en 404. Ce dernier contrôle ne teste pas les routes
métier de l’API. Les anciens noms Anchor staging présents dans l’environnement
ne sont pas des vhosts actifs et n’ont pas été modifiés.

La page FlowAtlas répond en HTTPS 200 avec un certificat vérifié et un contenu
identique au build. Les assets sont identiques aux fichiers locaux, les chemins
API et dépôt renvoient 404, et HTTP redirige vers HTTPS.

Pour toute opération ultérieure sur le proxy partagé, conserver les **trois**
fichiers Compose actifs :

```sh
docker compose -p platform-staging \
  --env-file /srv/platform/.env \
  -f /srv/platform/docker-compose.yml \
  -f /srv/dogsout/compose.caddy-overlay.yaml \
  -f /srv/flowatlas/compose.caddy-overlay.yaml \
  config --quiet
```

Une recréation avec seulement les anciens overlays retirerait les montages de
FlowAtlas. La sauvegarde contient la liste précédente des fichiers Compose,
le Caddyfile précédent, l’image Caddy et les contrôles des autres conteneurs.

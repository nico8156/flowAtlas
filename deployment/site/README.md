# Présentation FlowAtlas — préparation de publication

État : **préparé en local, non publié**. Aucune modification AWS, Caddy distant
ou DNS n’est effectuée par les commandes npm de ce dossier.

Le domaine reste à confirmer : `dogsout.anchor-event.fr` a été demandé, mais
il est déjà affecté à Dogsout dans son dépôt. Ne pas utiliser ce nom pour
FlowAtlas sans décision explicite de remplacement. `flowatlas.anchor-event.fr`
est l’alternative proposée, pas encore confirmée.

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

## Intégration candidate — après autorisation de publication

1. Confirmer le domaine dédié et relire l’état réel du serveur partagé,
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
   `/srv/flowatlas/`. Renseigner `FLOWATLAS_SITE_DOMAIN` avec le nom confirmé.
   La variable est obligatoire et aucun domaine n’est fixé par défaut.
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

Aucune commande de déploiement automatique ni workflow de publication n’est
ajouté. L’ordre exact d’activation serveur/DNS sera arrêté après inspection
réelle du serveur, lorsque la publication sera autorisée.

## OVH — rien à faire maintenant

Au moment de la publication, après confirmation du domaine et de l’IP :

| Champ        | Valeur à préparer                                    |
| ------------ | ---------------------------------------------------- |
| Zone         | `anchor-event.fr`                                    |
| Type         | `A`                                                  |
| Sous-domaine | Le sous-domaine FlowAtlas confirmé                   |
| Cible        | L’Elastic IP actuelle du Caddy partagé, à revérifier |
| TTL          | 300 secondes pour les premiers contrôles             |

Le guide Dogsout mentionne `13.39.97.191` comme Elastic IP vérifiée le
22 septembre 2026. Cette adresse est une référence historique : la confirmer
sur AWS avant de donner le feu vert OVH. Ne pas recopier une IP supposée.

Dans l’espace OVHcloud, ouvrir la zone DNS de `anchor-event.fr`, vérifier
l’absence de conflit A/AAAA/CNAME pour le nom retenu, puis ajouter uniquement
l’entrée dédiée. Ne modifier ni `dogsout`, ni `api.dogsout`, ni Fragments,
ni le domaine racine, `www`, les MX ou les enregistrements SES/DKIM.
Si le remplacement de Dogsout était finalement demandé, cette procédure ne
s’appliquerait pas : les liens mobiles et pages existantes nécessiteraient
une décision distincte.

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

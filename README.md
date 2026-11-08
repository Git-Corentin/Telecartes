# Collection de télécartes

Site statique (GitHub Pages) avec Supabase pour les données, la connexion et les images.
Pas de compilation : les fichiers du dépôt sont le site.

## Mise en ligne

**1. Supabase.** Créez un projet gratuit, puis dans *SQL Editor* collez et exécutez `supabase/schema.sql`.

**2. Votre compte.** Dans *Authentication > Users*, créez votre utilisateur (e-mail et mot de passe).
Dans *Authentication > Sign In / Providers*, désactivez **Allow new users to sign up**.
Puis dans *SQL Editor* :

```sql
insert into public.admins (user_id)
  select id from auth.users where email = 'votre-adresse@exemple.fr';
```

**3. Réglages.** Dans *Project Settings > API*, copiez l'URL et la clé `anon` dans `config.js`.
Cette clé est publique par conception : ce sont les règles de `schema.sql` qui protègent la base.
Ne mettez jamais la clé `service_role` dans le dépôt.

**4. GitHub Pages.** Poussez ce dossier sur un dépôt, puis *Settings > Pages > Deploy from a branch*, branche `main`, dossier `/ (root)`.

**5. Import.** Ouvrez le site, *Connexion* en bas de page, puis *Atelier > Importer la collection*.
Une fois fait, l'Excel n'est plus nécessaire. Passez ensuite par *Atelier > À vérifier*.

Tant que `supabaseUrl` est vide, le site tourne en démonstration sur `data/seed.json`.
Pour l'essayer sur votre machine : `python3 -m http.server`, puis http://localhost:8000.

## Images et catalogue

Trois sources, de la plus simple à la plus complète :

- **Vos photos ou scans.** Atelier > Visuels : déposez plusieurs fichiers nommés `F998.jpg`, `F998_verso.jpg`. Ils sont réduits, puis rattachés à la référence. Sur téléphone, le bouton Photo ouvre l'appareil.
- **Un CSV.** Atelier > Catalogue. Colonnes : `reference;nom;unites;puce;date;tirage;cote;image`.
- **Colnect**, dont le catalogue français porte les références Phonecote (F998 y est `Pho:0998`).
  Demandez une clé sur https://colnect.com/en/capi/apply_for_key, puis :

  ```
  COLNECT_APP_ID=… COLNECT_APP_SECRET=… node tools/colnect-sync.mjs data/catalogue-colnect.csv
  ```

  Importez le CSV dans l'atelier, puis cliquez sur *Reprendre les visuels du catalogue*.
  Le formulaire d'ajout proposera alors toutes les références. Lisez les conditions données avec la clé. Gardez la mention de Colnect en pied de page et ne versez pas la clé dans le dépôt.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `config.js` | Titre, connexion Supabase, cases par page, contact |
| `js/` | `store` données, `collection`, `classeur`, `doublons` et `pdf`, `chiffres`, `admin` |
| `supabase/schema.sql` | Tables et droits |
| `data/seed.json` | Collection issue de l'Excel |
| `tools/` | Conversion de l'Excel, synchronisation Colnect |

Le classeur suit la formule de l'Excel : `page = (indice − 1) ÷ 25 + 1`, `case = reste + 1`.
Une carte cédée libère sa case, et le prochain ajout la reprend.

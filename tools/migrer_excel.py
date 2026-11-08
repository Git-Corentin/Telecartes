#!/usr/bin/env python3
"""Convertit Collection_télécartes.xlsm en data/seed.json.

Usage : python3 tools/migrer_excel.py chemin/vers/le.xlsm data/seed.json

Une ligne de l'onglet « Inventaire complet » est un exemplaire physique.
Les exemplaires sont regroupés par référence + puce + unités.
Les différences entre lignes d'un même groupe (nom, tirage, date, cote) ne sont
jamais perdues : la valeur la plus fréquente est retenue et les autres sont
listées dans `a_verifier`, à trancher dans l'atelier du site.
"""
import collections
import json
import re
import sys
import unicodedata

import openpyxl

SERIES = [
    (r"figures?\s+t[ée]l[ée]com", "Figures Télécom"),
    (r"col(\.|lection)\s*hist", "Collection Historique"),
    (r"cin[ée]ma\s*\d+", "Cinéma"),
    (r"^x+e\s+si[èe]cle", "XXe siècle"),
    (r"^bd\s*\d", "BD"),
    (r"tour de france", "Tour de France"),
    (r"roland garros", "Roland Garros"),
    (r"instantan[ée]s de cabines", "Instantanés de cabines"),
    (r"les m[ée]tiers de la rue", "Les métiers de la rue"),
    (r"les petits gestes", "Les petits gestes"),
    (r"les moments critiques", "Les moments critiques"),
    (r"mode d.emploi", "Mode d'emploi"),
    (r"peugeot assistance", "Peugeot Assistance"),
    (r"call home", "Call Home"),
    (r"signal d.appel", "Signal d'appel"),
    (r"transfert d.appel", "Transfert d'appel"),
    (r"^danse", "Danse"),
    (r"cool tranquille", "Cool tranquille"),
    (r"^(\d+ )?(juin|ao[uû]t) 44", "Débarquement 1944"),
    (r"puzzle", "Puzzle"),
    (r"collection joueur", "Collection Joueur"),
    (r"seigneur des anneaux", "Le Seigneur des anneaux"),
    (r"^ville\b|la ville", "La Ville"),
    (r"^bercy", "Bercy"),
    (r"les vacances", "Les vacances"),
    (r"les cabines", "Les cabines"),
]


def serie(nom):
    for motif, label in SERIES:
        if re.search(motif, nom, re.I):
            return label
    return None


def plat(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def iso(d, jour=False):
    if d is None:
        return None
    return d.date().isoformat()


def majoritaire(lignes, cle):
    """Valeur la plus fréquente ; à égalité, la plus récemment saisie."""
    c = collections.Counter(cle(l) for l in lignes if cle(l) is not None)
    if not c:
        return None
    top = max(c.values())
    candidats = {v for v, n in c.items() if n == top}
    for l in sorted(lignes, key=lambda x: (x["date_ajout"], x["indice"]), reverse=True):
        if cle(l) in candidats:
            return cle(l)


def main(src, dst):
    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb["Inventaire complet"]
    it = ws.iter_rows(values_only=True)
    h = list(next(it))
    ix = {n: h.index(n) for n in h}
    lignes = []
    for r in it:
        if r[ix["Indice"]] is None:
            continue
        lignes.append(
            dict(
                indice=r[ix["Indice"]],
                reference=str(r[ix["Référence"]]).strip(),
                nom=str(r[ix["Nom"]]).strip(),
                unites=r[ix["Unités"]],
                puce=str(r[ix["Puce"]]).strip(),
                date=iso(r[ix["Date"]]),
                tirage=r[ix["Tirage"]],
                cote=r[ix["Cote"]],
                date_ajout=iso(r[ix["Date d'ajout"]]),
                etat=r[ix["État"]],
            )
        )

    groupes = collections.defaultdict(list)
    for l in lignes:
        groupes[(l["reference"], l["puce"], l["unites"])].append(l)

    cartes = []
    for (ref, puce, unites), g in groupes.items():
        carte = dict(reference=ref, puce=puce, unites=unites)
        conflits = {}
        for champ in ("nom", "date", "tirage", "cote"):
            carte[champ] = majoritaire(g, lambda l: l[champ])
            vals = {l[champ] for l in g if l[champ] is not None}
            if len(vals) > 1:
                if champ == "nom" and len({plat(v) for v in vals}) == 1:
                    continue  # casse, accent ou ponctuation : sans enjeu
                conflits[champ] = sorted(vals, key=str)
        carte["serie"] = serie(carte["nom"])
        if conflits:
            carte["a_verifier"] = conflits
        carte["ex"] = sorted(
            [[l["indice"], l["etat"], l["date_ajout"]] for l in g], key=lambda e: e[0]
        )
        cartes.append(carte)

    puces = []
    for r in wb["Listes"].iter_rows(values_only=True):
        v = r[1]
        if v and v != "Puces":
            puces.append(str(v).strip())
    for p in sorted({l["puce"] for l in lignes}):
        if p not in puces:
            puces.append(p)

    json.dump(
        dict(cartes=cartes, puces=puces),
        open(dst, "w", encoding="utf-8"),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    total = sum(len(c["ex"]) for c in cartes)
    conflits = [c for c in cartes if c.get("a_verifier")]
    print(f"{len(lignes)} lignes, {total} exemplaires, {len(cartes)} cartes différentes")
    print(f"{len(conflits)} cartes à vérifier, {len(puces)} puces")
    print("indices uniques :", len({l['indice'] for l in lignes}) == len(lignes))
    print("cote totale :", sum(l['cote'] or 0 for l in lignes) + 0.1 * sum(1 for l in lignes if l['cote'] is None))
    for c in conflits:
        print(" ", c["reference"], c["puce"], c["a_verifier"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

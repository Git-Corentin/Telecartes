#!/usr/bin/env python3
"""Construit data/catalogue.json à partir de la page enregistrée du catalogue de bertrand.dippe.free.fr.

Usage : python3 tools/importer_dippe.py page.html data/seed.json data/catalogue.json
"""
import collections
import json
import re
import sys

# La page a perdu ses accents à l'enregistrement : ils sont rétablis mot par mot.
MOTS = {
    "priv�": "privé", "s�rie": "série", "num�ro": "numéro", "Validit�": "Validité", "�me": "ème",
    "fl�che": "flèche", "chemin�e": "cheminée", "num�rot�e": "numérotée", "num�rotation": "numérotation",
    "T�L�PH�RIQUE": "TÉLÉPHÉRIQUE", "apr�s": "après", "P�re": "Père", "M�re": "Mère", "T�l�phone": "Téléphone",
    "coll�": "collé", "XX�s": "XXès", "M�chants": "Méchants", "surcharg�e": "surchargée", "Sp�cimen": "Spécimen",
    "sign�e": "signée", "gar�on": "garçon", "dor�e": "dorée", "�vid�e": "évidée", "scell�e": "scellée",
    "num�rot": "numérot", "Sommes�": "Sommes…", "Vari�t�": "Variété", "�toile": "étoile", "Conditionn�": "Conditionné",
    "R�frig�rateur": "Réfrigérateur", "�IL": "ŒIL", "�t�": "été", "tr�s": "très",
}

# Codes du catalogue vers les libellés de l'inventaire, établis en comparant les deux sources.
PUCES = {"SC4AN": "SC4 argent-noir", "SC4AB": "SC4 argent-blanc", "SC4ON": "SC4 or-noir", "SC4OB": "SC4 or-blanc", "SC5AN": "SC5 argent-noir", "SC5ON": "SC5 or-noir", "SC7or": "SC7 or", "BU1": "BULL 1", "BU2": "BULL 2"}


def accents(s):
    s = re.sub(r"([Nn])�(?=\s*\d|\s|$)", r"\1°", s)
    s = re.sub(r"(\d)�me", r"\1ème", s)
    for faux, juste in sorted(MOTS.items(), key=lambda x: -len(x[0])):
        s = s.replace(faux, juste)
    return s.replace(" � ", " à ").replace("�", "e")


def date_iso(s):
    m = re.fullmatch(r"(\d{2})\.(\d{4}|\d{2})", s)
    if not m:
        return None
    a = m[2] if len(m[2]) == 4 else ("19" if int(m[2]) > 50 else "20") + m[2]
    return f"{a}-{m[1]}-01"


def tirage(s):
    s = s.strip()
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?) M", s)
    if m:
        return round(float(m[1].replace(",", ".")) * 1_000_000)
    if re.fullmatch(r"\d[\d ]*", s):
        return int(s.replace(" ", ""))
    return None


def reference(p):
    m = re.fullmatch(r"([A-Z])0*(\d+)(.*)", p)
    return f"{m[1]}{m[2]}{m[3]}" if m else None


def lire(chemin):
    s = open(chemin, encoding="utf-8", errors="replace").read()
    t = s[s.index("LCEP"):]
    img, lignes = None, []
    for m in re.finditer(r"<TR>(.*?)(?=<TR>|</TABLE>)", t, re.S | re.I):
        b = m[1]
        im = re.search(r'<IMG SRC="[^"]*/([^/"]+)\.jpg"', b, re.I)
        if im:
            img = im[1]
        cellules = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<TD[^>]*>(.*?)(?=</TD>)", b, re.S | re.I)]
        if im:
            cellules = cellules[1:]
        if len(cellules) == 9:
            lignes.append((img, cellules))
    return lignes


def main(page, seed, sortie):
    brut = lire(page)
    mes = json.load(open(seed, encoding="utf-8"))
    cat = collections.defaultdict(list)
    ignorees = 0
    for img, c in brut:
        r = reference(c[1])
        if not r or "." in r:
            ignorees += 1
            continue
        cat[r].append((img, c))

    # Quelle puce de l'inventaire correspond à chaque code du catalogue ?
    croise = collections.defaultdict(collections.Counter)
    for carte in mes["cartes"]:
        lots = cat.get(carte["reference"], [])
        if len(lots) == 1:
            croise[lots[0][1][5]][carte["puce"]] += 1
    for code, c in croise.items():
        top, n = c.most_common(1)[0]
        if code not in PUCES and n / sum(c.values()) >= 0.9 and sum(c.values()) >= 3:
            PUCES[code] = top
    print("Puces rapprochées :", PUCES)
    print("Sans accord :", {k: dict(v) for k, v in croise.items() if k not in PUCES})

    def puce(code):
        return PUCES.get(code) or PUCES.get(code.split(" ")[0]) or ("GEM Nickel" if code == "GEM Ni" else code)

    lignes, vus = [], set()
    for r, lot in cat.items():
        for img, c in lot:
            ligne = [r, accents(c[3]), int(c[4]) if c[4].isdigit() else None, puce(c[5]), date_iso(c[6]), tirage(c[7]), img]
            cle = (r, ligne[3], ligne[2])
            if cle in vus:
                continue
            vus.add(cle)
            lignes.append(ligne)

    # Visuel de chaque référence de l'inventaire, en remontant du plus précis au numéro nu.
    visuels, exacts, proches, sans = {}, 0, 0, []
    for ref in {c["reference"] for c in mes["cartes"]}:
        essai, trouve = ref, None
        racine = re.match(r"[A-Za-z]+\d+", ref)
        while essai:
            if essai in cat:
                trouve = cat[essai][0][0]
                break
            if not racine or len(essai) <= len(racine[0]):
                break
            essai = essai[:-1]
        if not trouve and ref.upper() in cat:
            trouve = cat[ref.upper()][0][0]
        if trouve:
            visuels[ref] = trouve
            exacts += ref in cat
            proches += ref not in cat
        else:
            sans.append(ref)

    lignes.sort(key=lambda x: x[0])
    json.dump({"source": "bertrand.dippe.free.fr", "colonnes": ["reference", "nom", "unites", "puce", "date", "tirage", "image"], "lignes": lignes, "visuels": visuels},
              open(sortie, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(brut)} lignes lues, {ignorees} sans référence simple écartées, {len(lignes)} références gardées, {len({l[6] for l in lignes})} images.")
    print(f"Inventaire : {exacts} visuels exacts, {proches} par variante proche, sans visuel : {sorted(sans)}")
    print("Reste à corriger :", [l[1] for l in lignes if "�" in l[1]][:5], "années", min(l[4] for l in lignes if l[4])[:4], max(l[4] for l in lignes if l[4])[:4])


if __name__ == "__main__":
    main(*sys.argv[1:4])

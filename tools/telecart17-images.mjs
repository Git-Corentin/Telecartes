#!/usr/bin/env node
/*
 * Télécharge une fois les visuels de tes cartes depuis telecart17.free.fr,
 * sous la forme annees/{année}/{référence}.jpg, dans un dossier à déposer dans Atelier > Visuels.
 *
 *   node tools/telecart17-images.mjs            (Node 18 ou plus)
 *
 * Une requête à la fois avec une pause : c'est un site personnel, autant le ménager.
 * Si le script est interrompu, relance-le : les images déjà reçues sont conservées.
 */
import fs from "node:fs";
import path from "node:path";

const SITES = (process.env.SITES || "http://telecart17.free.fr,http://cartetel.free.fr").split(",");
const SEED = process.env.SEED || "data/seed.json";
const DOSSIER = process.env.DOSSIER || "visuels-telecart17";
const PAUSE = +(process.env.PAUSE ?? 500);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const estImage = (b) => b.length > 800 && ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x47 && b[1] === 0x49) || (b[0] === 0x89 && b[1] === 0x50));

let requetes = 0;
async function essayer(url) {
  requetes++;
  await dormir(PAUSE);
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (collection personnelle de telecartes)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return estImage(b) ? b : null;
  } catch { return null; }
}

const decoupe = (ref) => /^F(\d+)(.*)$/.exec(ref);

// Du plus exact au plus approché. Une variante (F444D) reprend en général le dessin de F444.
function noms(ref) {
  const m = decoupe(ref);
  const exacts = new Set([ref, ref.toUpperCase(), ref.replace(/\s.*$/, "")]);
  const proches = new Set();
  if (m) {
    const suffixe = m[2].replace(/\s.*$/, "");
    for (let i = suffixe.length - 1; i >= 1; i--) proches.add(`F${m[1]}${suffixe.slice(0, i)}`);
    if (suffixe) proches.add(`F${m[1]}`);
  }
  for (const e of exacts) proches.delete(e);
  return { exacts: [...exacts], proches: [...proches] };
}

function annees(carte, parNumero) {
  let a = carte.date ? +carte.date.slice(0, 4) : null;
  if (a == null) {
    const n = +decoupe(carte.reference)?.[1];
    const voisin = parNumero.filter((c) => c.date).sort((x, y) => Math.abs(+decoupe(x.reference)[1] - n) - Math.abs(+decoupe(y.reference)[1] - n))[0];
    a = voisin ? +voisin.date.slice(0, 4) : null;
  }
  if (a == null) return [];
  return carte.date ? [a, a + 1, a - 1] : [a, a + 1, a - 1, a + 2];
}

const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
const parRef = new Map();
for (const c of seed.cartes) if (decoupe(c.reference) && !parRef.has(c.reference)) parRef.set(c.reference, c);
const parNumero = [...parRef.values()];
fs.mkdirSync(DOSSIER, { recursive: true });

// On reste sur un seul site, et on ne passe au suivant que s'il ne donne rien du tout.
let site = 0, trouvees = 0, tentees = 0;

async function chercher(carte) {
  const { exacts, proches } = noms(carte.reference);
  const ans = annees(carte, parNumero);
  const base = SITES[site];
  for (const [i, an] of ans.entries()) {
    for (const nom of exacts) {
      for (const ext of i === 0 ? ["jpg", "JPG"] : ["jpg"]) {
        const url = `${base}/annees/${an}/${encodeURIComponent(nom)}.${ext}`;
        const b = await essayer(url);
        if (b) return { b, url, qualite: "exacte" };
      }
    }
  }
  for (const nom of proches) {
    const url = `${base}/annees/${ans[0]}/${encodeURIComponent(nom)}.jpg`;
    const b = await essayer(url);
    if (b) return { b, url, qualite: "approchée" };
  }
  return null;
}

const lignes = ["reference;resultat;source"];
let exactes = 0, approchees = 0, absentes = 0, deja = 0, i = 0;
for (const carte of parRef.values()) {
  i++;
  const fichier = path.join(DOSSIER, `${carte.reference}.jpg`);
  if (fs.existsSync(fichier)) { deja++; lignes.push(`${carte.reference};deja presente;`); continue; }
  const t = await chercher(carte);
  tentees++;
  if (t) trouvees++;
  if (!trouvees && tentees >= 25 && site + 1 < SITES.length) { site++; tentees = 0; console.log(`\nRien trouvé, essai sur ${SITES[site]}`); }
  if (t) {
    fs.writeFileSync(fichier, t.b);
    t.qualite === "exacte" ? exactes++ : approchees++;
    lignes.push(`${carte.reference};${t.qualite};${t.url}`);
  } else { absentes++; lignes.push(`${carte.reference};absente;`); }
  process.stdout.write(`\r${i} / ${parRef.size}  trouvées ${exactes + approchees}  absentes ${absentes}   `);
  fs.writeFileSync(path.join(DOSSIER, "_rapport.csv"), "﻿" + lignes.join("\r\n"));
}
fs.writeFileSync(path.join(DOSSIER, "_rapport.csv"), "﻿" + lignes.join("\r\n"));
console.log(`\n${exactes} exactes, ${approchees} approchées (autre variante de la même référence), ${absentes} absentes, ${deja} déjà présentes.`);
console.log(`Dépose le contenu de ${DOSSIER} dans Atelier > Visuels. Détail dans _rapport.csv.`);

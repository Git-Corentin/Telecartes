#!/usr/bin/env node
/*
 * Télécharge une fois les images du catalogue de bertrand.dippe.free.fr dans visuels-catalogue/.
 *   node tools/telecharger-visuels.mjs     (Node 18 ou plus, depuis le dossier du site)
 * Une requête à la fois. Si le script est interrompu, relance-le : il reprend où il en était.
 * Dépose ensuite tous les fichiers dans Atelier > Visuels.
 */
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.SITE || "http://bertrand.dippe.free.fr";
const DOSSIER = process.env.DOSSIER || "visuels-catalogue";
const CATALOGUE = process.env.CATALOGUE || "data/catalogue.json";
const PAUSE = +(process.env.PAUSE ?? 400);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const estImage = (b) => b.length > 500 && ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x47 && b[1] === 0x49) || (b[0] === 0x89 && b[1] === 0x50));

const { lignes, colonnes } = JSON.parse(fs.readFileSync(CATALOGUE, "utf8"));
const iImage = colonnes.indexOf("image");
const codes = [...new Set(lignes.map((l) => l[iImage]).filter(Boolean))].sort();
fs.mkdirSync(DOSSIER, { recursive: true });

let recues = 0, deja = 0;
const manquantes = [];
for (const [i, code] of codes.entries()) {
  const fichier = path.join(DOSSIER, `${code}.jpg`);
  if (fs.existsSync(fichier)) { deja++; continue; }
  await dormir(PAUSE);
  let b = null;
  for (let essai = 0; essai < 2 && !b; essai++) {
    try {
      const r = await fetch(`${SITE}/image/carte/FRA/PUB/${code}.jpg`, { headers: { "user-agent": "Mozilla/5.0 (collection personnelle de telecartes)" }, signal: AbortSignal.timeout(20000) });
      if (r.ok) { const x = Buffer.from(await r.arrayBuffer()); if (estImage(x)) b = x; }
    } catch { /* nouvel essai, puis image notée manquante */ }
  }
  if (b) { fs.writeFileSync(fichier, b); recues++; } else manquantes.push(code);
  process.stdout.write(`\r${i + 1} / ${codes.length}  reçues ${recues}  manquantes ${manquantes.length}   `);
}
console.log(`\n${recues} images reçues, ${deja} déjà présentes, ${manquantes.length} manquantes${manquantes.length ? " : " + manquantes.slice(0, 20).join(", ") : ""}.`);
console.log(`Dépose le contenu de ${DOSSIER} dans Atelier > Visuels.`);

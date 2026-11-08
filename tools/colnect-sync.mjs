#!/usr/bin/env node
/*
 * Récupère le catalogue français des télécartes (références Phonecote) depuis l'API officielle
 * de Colnect et écrit un CSV à importer dans l'atelier du site.
 *
 * 1. Demander une clé : https://colnect.com/en/capi/apply_for_key
 * 2. COLNECT_APP_ID=… COLNECT_APP_SECRET=… node tools/colnect-sync.mjs data/catalogue-colnect.csv
 * 3. Atelier > Catalogue > Importer un CSV, puis Atelier > Visuels > Reprendre les visuels du catalogue.
 *
 * Ce script n'a pas pu être essayé sans clé. Il lit les noms de colonnes à l'exécution
 * et affiche le premier enregistrement : c'est l'endroit à regarder si un champ reste vide.
 * L'API exige HTTP/2 et une mention de Colnect sur le site (le pied de page s'en charge).
 */
import http2 from "node:http2";
import crypto from "node:crypto";
import fs from "node:fs";

const { COLNECT_APP_ID: ID, COLNECT_APP_SECRET: SECRET } = process.env;
const SORTIE = process.argv[2] || "catalogue-colnect.csv";
if (!ID || !SECRET) { console.error("Définissez COLNECT_APP_ID et COLNECT_APP_SECRET."); process.exit(1); }

const HOTE = "https://api.colnect.net";
const BASE = `/fr/api/${ID}`;
const client = http2.connect(HOTE);
let signeRelatif = false;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function brut(p) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const plein = BASE + p;
  const aSigner = (signeRelatif ? p : plein) + ">|<" + ts;
  const hash = crypto.createHmac("sha256", SECRET).update(aSigner).digest("hex");
  return new Promise((ok, ko) => {
    const r = client.request({ ":method": "GET", ":path": plein, "user-agent": "CollectionTelecartesPerso/1.0", "capi-timestamp": ts, "capi-hash": hash });
    let statut = 0, c = "";
    r.setEncoding("utf8");
    r.on("response", (h) => { statut = h[":status"]; });
    r.on("data", (d) => (c += d));
    r.on("end", () => ok({ statut, c }));
    r.on("error", ko);
    r.end();
  });
}

async function api(p) {
  let { statut, c } = await brut(p);
  if ((statut === 401 || statut === 403) && !signeRelatif) {
    signeRelatif = true; // la documentation ne précise pas si le chemin signé inclut /fr/api/{id}
    ({ statut, c } = await brut(p));
    if (statut === 401 || statut === 403) signeRelatif = false;
  }
  if (statut !== 200) throw new Error(`HTTP ${statut} sur ${p} : ${c.slice(0, 300)}`);
  await pause(120);
  return JSON.parse(c);
}

const cherche = (noms, re) => noms.findIndex((n) => re.test(n));
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const image = (id, nom) => { const s = String(id); return id ? `https://i.colnect.net/images/f/${s.slice(0, -3) || "0"}/${s.slice(-3).padStart(3, "0")}/${slug(nom)}.jpg` : ""; };

export function refDepuisCode(codes) {
  const m = /Pho(?:necote)?\s*:?\s*([0-9A-Za-z][0-9A-Za-z.\-]*)/.exec(String(codes));
  if (!m) return null;
  const n = /^(\d+)(.*)$/.exec(m[1]);
  return n ? `F${+n[1]}${n[2]}` : m[1];
}
export function puceLocale(t) {
  let s = String(t || "").split(" - ").pop().replace(/\(.*\)/, "").trim();
  const g = /^GEM\s*(\d)\s*([AB])?$/i.exec(s);
  if (g) s = `GEM ${g[1]}${g[2] ? " " + g[2].toUpperCase() : ""}`;
  return s;
}

const c = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const noms = await api("/field_titles/cat/phonecards");
const titres = Array.isArray(noms) ? noms : Object.values(noms);
console.log("Champs :", titres.join(", "));
const I = { nom: cherche(titres, /^name$/i), code: cherche(titres, /catalog.*cod/i), date: cherche(titres, /issued/i), tirage: cherche(titres, /print.?run/i), puce: cherche(titres, /chip/i), valeur: cherche(titres, /face.?value/i), photo: cherche(titres, /front.*pic|^picture/i), id: cherche(titres, /^(id|item.?id)$/i) };
console.log("Colonnes retenues :", I);

const ids = await api("/list_id/cat/phonecards/country/74/catalog/7");
console.log(`${ids.length} identifiants`);
const f = fs.createWriteStream(SORTIE);
f.write("reference;nom;unites;puce;date;tirage;image;source\n");
let n = 0, sansCode = 0;
for (let i = 0; i < ids.length; i += 50) {
  const lot = ids.slice(i, i + 50);
  let rep = await api(`/item/cat/phonecards/id/${lot.join(",")}`);
  if (lot.length === 1 || !Array.isArray(rep[0])) rep = Array.isArray(rep[0]) ? rep : [rep];
  if (i === 0) console.log("Premier enregistrement :", rep[0]);
  for (const it of rep) {
    const ref = refDepuisCode(it[I.code]);
    if (!ref) { sansCode++; continue; }
    const v = String(it[I.valeur] ?? "");
    const unites = /^\d+/.exec(v)?.[0] ?? "";
    f.write([ref, it[I.nom], unites, puceLocale(it[I.puce]), it[I.date], it[I.tirage], image(it[I.photo], it[I.nom]), "Colnect"].map(c).join(";") + "\n");
    n++;
  }
  process.stdout.write(`\r${Math.min(i + 50, ids.length)} / ${ids.length}`);
}
f.end();
client.close();
console.log(`\n${n} lignes écrites dans ${SORTIE}, ${sansCode} ignorées faute de code Phonecote.`);

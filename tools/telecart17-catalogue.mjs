#!/usr/bin/env node
/*
 * Construit la liste des références publiques à partir des pages annuelles de telecart17.free.fr.
 *   node tools/telecart17-catalogue.mjs catalogue-telecart17.csv   (Node 18 ou plus)
 * Importe ensuite le CSV dans Atelier > Catalogue.
 *
 * Le découpage des pages a été écrit d'après un extrait de leur texte, sans accès au HTML complet.
 * Le script annonce le nombre de cartes lues par page : une page à 0 indique un format à adapter.
 */
import fs from "node:fs";

const SITE = process.env.SITE || "http://telecart17.free.fr";
const DEPART = process.env.DEPART || "/cote_des_telecartes.htm";
const SORTIE = process.argv[2] || "catalogue-telecart17.csv";
const PAUSE = +(process.env.PAUSE ?? 800);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(url) {
  await dormir(PAUSE);
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (collection personnelle de telecartes)" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
}

const ENT = { nbsp: " ", amp: "&", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç", ugrave: "ù", ocirc: "ô", icirc: "î", acirc: "â", euml: "ë", iuml: "ï", deg: "°", quot: '"', apos: "'", euro: "€", ucirc: "û", Eacute: "É" };
export const texte = (h) => h.replace(/<[^>]*>/g, " ").replace(/&(#\d+|\w+);/g, (m, x) => (x[0] === "#" ? String.fromCharCode(+x.slice(1)) : ENT[x] ?? m)).replace(/\s+/g, " ").trim();

function dateCourte(s) {
  const m = /(\d{1,2})\/(\d{2,4})/.exec(s);
  if (!m) return "";
  let a = +m[2];
  if (a < 100) a += a > 50 ? 1900 : 2000;
  return `${a}-${m[1].padStart(2, "0")}-01`;
}
function tirage(s) {
  if (!s) return "";
  const m = /^([\d.,]+)\s*M/i.exec(s);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e6);
  return +s.replace(/[^\d]/g, "") || "";
}

const RE_TETE = /^(F\d+[A-Za-z]*)\s+(\d{1,2}\/\d{2,4})?/;
const RE_PUCE = /\b(SC\s?\d\w*|SO\s?\d\w*|GEM\s?\d?\w*|OB\s?\d\w*|OR\s?\d|LG\s?\d|SA\s?\d|BULL\s?\d)\s+(\d+)\s*U\b\s*([\d][\d., ]*\s*M?)\s*(?:ex)?\s*(?:=\s*([\d.,]+))?/gi;

export function lirePage(html, base) {
  const images = new Map();
  for (const m of html.matchAll(/<img[^>]+src\s*=\s*["']?([^"'\s>]+)/gi)) {
    const nom = /([A-Za-z]*\d+[A-Za-z]*)\.(?:jpe?g|gif|png)$/i.exec(m[1]);
    if (nom) images.set(nom[1], new URL(m[1], base).href);
  }
  const cartes = [];
  let colonnes = null;
  for (const m of html.matchAll(/<tr[^>]*>((?:(?!<tr[\s>]).)*?)<\/tr>/gis)) {
    const cellules = [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((c) => texte(c[1]));
    if (cellules.some((c) => RE_TETE.test(c))) {
      colonnes = cellules.map((c) => { const t = RE_TETE.exec(c); return t ? { reference: t[1], date: dateCourte(t[2] || ""), variantes: [], nom: "", cote: "" } : null; });
      cartes.push(...colonnes.filter(Boolean));
      continue;
    }
    if (!colonnes) continue;
    cellules.forEach((c, i) => {
      const k = colonnes[i];
      if (!k || !c) return;
      const coteSeule = /cote\s*=\s*([\d.,]+)/i.exec(c);
      if (coteSeule) { k.cote = coteSeule[1].replace(",", "."); return; }
      const v = [...c.matchAll(RE_PUCE)];
      if (v.length) { for (const x of v) k.variantes.push({ puce: x[1], unites: x[2], tirage: tirage(x[3].trim()), cote: x[4]?.replace(",", ".") || "" }); return; }
      if (!k.nom) k.nom = c;
    });
  }
  return { cartes, images };
}

const champ = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const depart = new URL(DEPART, SITE).href;
const file = [depart], vues = new Set(file);
const toutes = new Map();
const lignes = ["reference;nom;unites;puce;date;tirage;cote;image;source"];
while (file.length) {
  const url = file.shift();
  let html;
  try { html = await page(url); } catch (er) { console.log(`Page ignorée (${er.message}) : ${url}`); continue; }
  for (const m of html.matchAll(/href\s*=\s*["']?([^"'\s>#]+)/gi)) {
    if (!/annee/i.test(m[1]) || !/\.html?$/i.test(m[1])) continue;
    const u = new URL(m[1], url).href;
    if (u.startsWith(SITE) && !vues.has(u)) { vues.add(u); file.push(u); }
  }
  const { cartes, images } = lirePage(html, url);
  let n = 0;
  for (const c of cartes) {
    const img = images.get(c.reference) || "";
    for (const v of c.variantes.length ? c.variantes : [{}]) {
      const cle = `${c.reference}|${v.puce || ""}|${v.unites || ""}`;
      if (toutes.has(cle)) continue;
      toutes.set(cle, 1); n++;
      lignes.push([c.reference, c.nom, v.unites, v.puce, c.date, v.tirage, v.cote || c.cote, img, "telecart17"].map(champ).join(";"));
    }
  }
  console.log(`${String(n).padStart(4)} cartes  ${url.replace(SITE, "")}`);
}
fs.writeFileSync(SORTIE, "﻿" + lignes.join("\r\n"));
console.log(`\n${toutes.size} lignes écrites dans ${SORTIE}, ${vues.size} pages lues.`);

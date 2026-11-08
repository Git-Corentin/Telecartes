export const CFG = window.TELECARTES;
const AMP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const e = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => AMP[c]);
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const nf = new Intl.NumberFormat("fr-FR");
export const nb = (n) => (n == null ? "" : nf.format(n));
export const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const mois = (iso) => { if (!iso) return ""; const [a, m] = iso.split("-"); return `${MOIS[+m - 1]} ${a}`; };
export const jour = (iso) => { if (!iso) return ""; const [a, m, j] = iso.split("-"); return `${+j} ${MOIS[+m - 1]} ${a}`; };
export const aujourdhui = () => new Date().toLocaleDateString("sv");

export function decoupeRef(r) {
  const m = /^([A-Za-z-]*?)(\d+)(.*)$/.exec(r || "");
  return m ? [m[1], +m[2], m[3]] : [r || "", 0, ""];
}
export function cmpRef(a, b) {
  const [pa, na, sa] = decoupeRef(a), [pb, nb_, sb] = decoupeRef(b);
  if (pa !== pb) return pa === "F" ? -1 : pb === "F" ? 1 : pa < pb ? -1 : 1;
  if (na !== nb_) return na - nb_;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
export const position = (indice) => ({ page: Math.floor((indice - 1) / CFG.casesParPage) + 1, case: ((indice - 1) % CFG.casesParPage) + 1 });
export const indiceDe = (page, c) => (page - 1) * CFG.casesParPage + c;

// Code Phonecote tel qu'il apparaît sur Colnect : F998 devient 0998.
export function codeColnect(ref) {
  const m = /^F(\d+)(.*)$/.exec(ref || "");
  return m ? m[1].padStart(4, "0") + m[2] : ref;
}

export function urlSure(u) {
  if (!u) return "";
  if (u.startsWith("blob:") || u.startsWith("data:image/")) return u;
  try { const x = new URL(u, location.href); return ["http:", "https:"].includes(x.protocol) ? x.href : ""; } catch { return ""; }
}

export function message(texte, type = "ok", action) {
  const d = document.createElement("div");
  d.className = `message ${type}`;
  d.innerHTML = `<span>${e(texte)}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.textContent = action.label;
    b.onclick = () => { d.remove(); action.fn(); };
    d.append(b);
  }
  // Un dialogue modal rend le reste de la page inerte : le message doit vivre dedans.
  ($("#fiche").open ? $("#messages-fiche") : $("#messages")).append(d);
  setTimeout(() => d.remove(), action ? 9000 : 4500);
}

export function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(contenu instanceof Blob ? contenu : new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = nom; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function csv(lignes) {
  const c = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + lignes.map((l) => l.map(c).join(";")).join("\r\n");
}

export function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

// Réduit une image avant envoi : les visuels restent légers et le quota Supabase tient longtemps.
export async function reduireImage(fichier, largeur = 1000) {
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, largeur / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, "image/webp", 0.84));
}

import { CFG, nb, eur, urlSure } from "./util.js";
import { teinte, encreSur, metalPuce } from "./face.js";
import fonts from "../vendor/cabin-pdf.js";

const CARTE = 85.6 / 54;

function rgb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }

function chargerImage(url) {
  return new Promise((ok) => {
    const u = urlSure(url);
    if (!u) return ok(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.referrerPolicy = "no-referrer";
    const t = setTimeout(() => ok(null), 8000);
    im.onload = () => {
      clearTimeout(t);
      try {
        const c = document.createElement("canvas");
        c.width = 520; c.height = Math.round(520 / CARTE);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.82));
      } catch { ok(null); }
    };
    im.onerror = () => { clearTimeout(t); ok(null); };
    im.src = u;
  });
}

export function prix(c, o) {
  if (o.mode === "aucun") return null;
  if (o.mode === "fixe") return +o.fixe || 0;
  const base = c.cote == null ? 0 : +c.cote;
  const v = o.mode === "pourcent" ? (base * (+o.pourcent || 0)) / 100 : base;
  return Math.max(Math.round(v * 20) / 20, +o.min || 0);
}

const ETAT = { U: "usagée", L: "luxe" };
export function resumeEtats(ex) {
  const m = {};
  for (const x of ex) { const k = x.etat || "?"; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).map(([k, n]) => (k === "?" ? `${n} non notée${n > 1 ? "s" : ""}` : `${n} ${ETAT[k]}${n > 1 ? "s" : ""}`)).join(", ");
}

function dessinerFace(doc, c, x, y, w, h) {
  const t = teinte(c);
  doc.setFillColor(...rgb(t)); doc.roundedRect(x, y, w, h, 1.6, 1.6, "F");
  doc.setFillColor(...rgb(metalPuce(c.puce))); doc.roundedRect(x + w * 0.08, y + h * 0.3, w * 0.17, h * 0.28, 0.8, 0.8, "F");
  const enc = rgb(encreSur(t));
  doc.setTextColor(...enc); doc.setFont("Cabin", "bold");
  doc.setFontSize(Math.max(9, w * 0.32)); doc.text(String(c.unites ?? ""), x + w - 2, y + 2.4 + w * 0.1, { align: "right" });
  doc.setFontSize(Math.max(6, w * 0.15));
  const l = doc.splitTextToSize(c.nom, w - 4).slice(0, 2);
  doc.text(l, x + 2, y + h - 2 - (l.length - 1) * w * 0.065);
}

export async function pdfDoublons(items, o, progres) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("Cabin-Regular.ttf", fonts.regular); doc.addFont("Cabin-Regular.ttf", "Cabin", "normal");
  doc.addFileToVFS("Cabin-Bold.ttf", fonts.bold); doc.addFont("Cabin-Bold.ttf", "Cabin", "bold");
  const W = 210, H = 297, M = 12, cols = o.colonnes === "liste" ? 1 : +o.colonnes || 4, gout = 4;
  const cw = (W - 2 * M - (cols - 1) * gout) / cols, ih = cw / CARTE;
  const rowH = ih + 19;
  const BLEU = rgb("#123FA8"), ENC = rgb("#14213D"), GRIS = rgb("#5B6573");
  const totalCartes = items.reduce((t, i) => t + i.ex.length, 0);
  const imgs = new Map();
  if (o.visuels && o.colonnes !== "liste") {
    let f = 0;
    const urls = [...new Set(items.map((i) => i.c.image_recto).filter(Boolean))];
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async (u) => { imgs.set(u, await chargerImage(u)); f++; }));
      progres?.(`Visuels : ${f} sur ${urls.length}`);
    }
  }
  let y = 0, colonne = 0, page = 0;
  const pied = () => {
    doc.setFont("Cabin", "normal"); doc.setFontSize(8); doc.setTextColor(...GRIS);
    if (o.contact) doc.text(doc.splitTextToSize(o.contact, 150)[0], M, H - 7);
    doc.text(`Page ${page}`, W - M, H - 7, { align: "right" });
  };
  const nouvellePage = () => {
    if (page) { pied(); doc.addPage(); }
    page++;
    if (page === 1) {
      doc.setFillColor(...BLEU); doc.rect(0, 0, W, 34, "F");
      doc.setFont("Cabin", "bold"); doc.setFontSize(27); doc.setTextColor(255, 255, 255);
      doc.text(doc.splitTextToSize(o.titre || "Télécartes à céder", W - 2 * M)[0], M, 17);
      doc.setFont("Cabin", "normal"); doc.setFontSize(11);
      doc.text(`${nb(totalCartes)} carte${totalCartes > 1 ? "s" : ""}, ${nb(items.length)} référence${items.length > 1 ? "s" : ""}, liste du ${new Date().toLocaleDateString("fr-FR")}`, M, 26);
      y = 41;
    } else y = 12;
    colonne = 0;
  };
  nouvellePage();
  if (o.colonnes === "liste") {
    const X = { ref: M, nom: M + 22, u: 112, puce: 124, an: 152, qte: 165, etat: 174 };
    const entete = () => {
      doc.setFont("Cabin", "bold"); doc.setFontSize(8.5); doc.setTextColor(...ENC);
      doc.text("Réf.", X.ref, y); doc.text("Nom", X.nom, y); doc.text("Unités", X.u, y); doc.text("Puce", X.puce, y); doc.text("Année", X.an, y); doc.text("Qté", X.qte, y);
      if (o.mode !== "aucun") doc.text("Prix", W - M, y, { align: "right" });
      y += 1.6; doc.setDrawColor(...ENC); doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 4.2;
    };
    entete();
    for (const { c, ex } of items) {
      if (y > H - 15) { nouvellePage(); entete(); }
      doc.setFont("Cabin", "bold"); doc.setFontSize(9); doc.setTextColor(...ENC); doc.text(c.reference, X.ref, y);
      doc.setFont("Cabin", "normal");
      doc.text(doc.splitTextToSize(c.nom, X.u - X.nom - 3)[0], X.nom, y);
      doc.text(String(c.unites ?? ""), X.u, y); doc.text(doc.splitTextToSize(c.puce, X.an - X.puce - 2)[0], X.puce, y); doc.text(String(c.an ?? ""), X.an, y); doc.text(String(ex.length), X.qte, y);
      const p = prix(c, o);
      if (p != null) doc.text(p ? eur(p).replace(/\u202f|\u00a0/g, " ") : "à débattre", W - M, y, { align: "right" });
      doc.setDrawColor(...rgb("#C9CFC9")); doc.setLineWidth(0.15); doc.line(M, y + 1.5, W - M, y + 1.5);
      y += 5.4;
    }
    pied();
    return doc;
  }
  for (const it of items) {
    const { c, ex } = it;
    if (y + rowH > H - 12) nouvellePage();
    const x = M + colonne * (cw + gout);
    const data = imgs.get(c.image_recto);
    if (data) doc.addImage(data, "JPEG", x, y, cw, ih, undefined, "FAST"); else dessinerFace(doc, c, x, y, cw, ih);
    let ty = y + ih + 4.3;
    doc.setFont("Cabin", "bold"); doc.setFontSize(10); doc.setTextColor(...ENC);
    doc.text(c.reference, x, ty);
    const p = prix(c, o);
    if (p != null) doc.text(p ? eur(p).replace(/ | /g, " ") : "à débattre", x + cw, ty, { align: "right" });
    ty += 3.7;
    doc.setFont("Cabin", "normal"); doc.setFontSize(8.2);
    doc.text(doc.splitTextToSize(c.nom, cw)[0], x, ty);
    ty += 3.3; doc.setTextColor(...GRIS); doc.setFontSize(7.4);
    doc.text(doc.splitTextToSize([c.unites != null ? `${c.unites} u` : "", c.puce, c.an].filter(Boolean).join(", "), cw)[0], x, ty);
    ty += 3; 
    doc.text(doc.splitTextToSize(`x${ex.length} : ${resumeEtats(ex)}`, cw)[0], x, ty);
    colonne++;
    if (colonne >= cols) { colonne = 0; y += rowH; }
  }
  pied();
  return doc;
}

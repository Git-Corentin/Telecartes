import { e, hash, urlSure } from "./util.js";
import { S } from "./store.js";

// Couleurs des cartes dont le visuel manque encore : une par année, comme un nuancier d'époque.
export const TEINTES = ["#D9352B", "#0F6E62", "#F0AE00", "#2546B8", "#E86A17", "#5F8420", "#B51F6B", "#1677AD"];
export const teinte = (c) => TEINTES[((c.an ?? 1990) + 3) % TEINTES.length];
export const encreSur = (hex) => (hex === "#F0AE00" ? "#14213D" : "#FFFFFF");

export function metalPuce(p) { return /argent/i.test(p || "") ? "#C9CED3" : /GEM|OB|OR|LG/i.test(p || "") ? "#D8B24A" : "#E2BE5A"; }
export function symbolePuce(p) {
  if (/^SC/i.test(p || "")) return "puce-sc";
  if (/^SO/i.test(p || "")) return "puce-so";
  if (/^GEM/i.test(p || "")) return "puce-gem";
  if (/^OB/i.test(p || "")) return "puce-ob";
  return "puce-autre";
}
export const svgPuce = (p, cls = "puce") => `<svg class="${cls}" style="color:${metalPuce(p)}" aria-hidden="true"><use href="#${symbolePuce(p)}"/></svg>`;

export function faceGeneree(c) {
  const t = teinte(c);
  return `<span class="face m${hash(c.reference) % 5}" style="--t:${t};--e:${encreSur(t)}">
    ${svgPuce(c.puce)}
    <span class="u">${c.unites ?? ""}</span>
    <span class="n">${e(c.nom)}</span>
  </span>`;
}

export function visuel(c, { verso = false } = {}) {
  const u = urlSure(verso ? c.image_verso : c.image_recto);
  if (u) return `<img class="photo" src="${e(u)}" alt="${e(c.reference)} ${e(c.nom)}, ${verso ? "verso" : "recto"}" loading="lazy" referrerpolicy="no-referrer" data-repli="1">`;
  if (verso) return `<span class="face dos"><span class="bande"></span><span class="mentions">${e(c.reference)}<br>${c.tirage ? `Tirage ${new Intl.NumberFormat("fr-FR").format(c.tirage)}` : ""}</span></span>`;
  return faceGeneree(c);
}

document.addEventListener("error", (ev) => {
  const img = ev.target;
  if (img.tagName === "IMG" && img.dataset.repli) {
    const span = document.createElement("span");
    span.className = "face vide"; span.textContent = "Visuel indisponible";
    img.replaceWith(span);
  }
}, true);

export function photoPuce(code) { return urlSure(S.puces.find((p) => p.code === code)?.image_url); }

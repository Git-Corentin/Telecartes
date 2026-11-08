import { e, $, CFG, position } from "./util.js";
import { S, plan } from "./store.js";
import { visuel } from "./face.js";
import { ouvrirFiche } from "./fiche.js";

const dernierePage = (p) => Math.max(1, ...[...p.keys()].map((i) => position(i).page));

export function vueClasseur(cible, page, marque) {
  const p = plan();
  const max = dernierePage(p);
  page = Math.min(Math.max(1, page || 1), max);
  const gauche = page % 2 ? page : page - 1;      // planche ouverte : impaire à gauche
  const feuille = (n) => {
    if (n > max) return `<div class="feuille absente"></div>`;
    let h = "";
    for (let c = 1; c <= CFG.casesParPage; c++) {
      const i = (n - 1) * CFG.casesParPage + c, o = p.get(i);
      const ici = marque && n === page && c === marque;
      h += o ? `<button class="poche${ici ? " marquee" : ""}" data-id="${o.carte.id}" title="${e(o.carte.reference)} ${e(o.carte.nom)}" aria-label="Case ${c} : ${e(o.carte.reference)}, ${e(o.carte.nom)}"><span class="objet">${visuel(o.carte)}</span></button>` : `<span class="poche vide" title="Case ${c} libre"></span>`;
    }
    return `<div class="feuille"><p class="folio">Page ${n}</p><div class="poches">${h}</div></div>`;
  };
  cible.innerHTML = `<div class="classeur">
    <div class="classeur-nav">
      <button class="touche" data-aller="${gauche - 2}" ${gauche <= 1 ? "disabled" : ""} aria-label="Pages précédentes">‹</button>
      <label>Page <input id="c-page" type="number" min="1" max="${max}" value="${page}"> sur ${max}</label>
      <input id="c-glisse" type="range" min="1" max="${max}" value="${page}" aria-label="Parcourir le classeur">
      <button class="touche" data-aller="${gauche + 2}" ${gauche + 1 >= max ? "disabled" : ""} aria-label="Pages suivantes">›</button>
    </div>
    <div class="planche">${feuille(gauche)}<div class="anneaux" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${feuille(gauche + 1)}</div>
  </div>`;
  const aller = (n) => { location.hash = `#/classeur/${n}`; };
  const z = $(".classeur", cible);
  z.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.id) ouvrirFiche(+b.dataset.id);
    if (b.dataset.aller) aller(Math.max(1, +b.dataset.aller));
  });
  $("#c-page").addEventListener("change", (ev) => aller(+ev.target.value));
  $("#c-glisse").addEventListener("input", (ev) => { $("#c-page").value = ev.target.value; });
  $("#c-glisse").addEventListener("change", (ev) => aller(+ev.target.value));
  if (marque) $(".marquee")?.scrollIntoView({ block: "center" });
  clavierClasseur = (ev) => {
    if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName) || $("#fiche").open) return;
    if (ev.key === "ArrowRight" && gauche + 1 < max) aller(gauche + 2);
    if (ev.key === "ArrowLeft" && gauche > 1) aller(gauche - 2);
  };
}
let clavierClasseur = null;
document.addEventListener("keydown", (ev) => { if (location.hash.startsWith("#/classeur")) clavierClasseur?.(ev); });

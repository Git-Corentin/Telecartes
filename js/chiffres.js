import { e, $, nb, eur, mois, CFG } from "./util.js";
import { S, possedees, bilan } from "./store.js";
import { ouvrirFiche } from "./fiche.js";
import { visuel } from "./face.js";

function barresV(donnees, unite) {
  const W = 880, H = 240, g = 34, b = 26, t = 12, r = 6;
  const max = Math.max(...donnees.map((d) => d.v));
  const pas = max > 200 ? 100 : max > 100 ? 50 : 20;
  const hauteur = (v) => (v / (Math.ceil(max / pas) * pas)) * (H - b - t);
  const larg = (W - g - r) / donnees.length;
  let s = "";
  for (let y = 0; y <= Math.ceil(max / pas) * pas; y += pas) {
    const py = H - b - hauteur(y);
    s += `<line x1="${g}" x2="${W - r}" y1="${py}" y2="${py}" class="grille-l"/><text x="${g - 6}" y="${py + 4}" text-anchor="end" class="axe">${y}</text>`;
  }
  donnees.forEach((d, i) => {
    const h = hauteur(d.v), x = g + i * larg, w = Math.max(2, larg - 2);
    if (h > 0) s += `<path class="marque" d="M${x + 1} ${H - b}v${-(h - Math.min(4, h))}q0-${Math.min(4, h)} ${Math.min(4, w / 2)}-${Math.min(4, h)}h${w - 2 * Math.min(4, w / 2)}q${Math.min(4, w / 2)} 0 ${Math.min(4, w / 2)} ${Math.min(4, h)}v${h - Math.min(4, h)}z"/>`;
    if (i % Math.ceil(donnees.length / 12) === 0) s += `<text x="${x + larg / 2}" y="${H - 8}" text-anchor="middle" class="axe">${e(d.l)}</text>`;
    s += `<rect x="${x}" y="${t}" width="${larg}" height="${H - b - t}" fill="transparent" data-t="${e(d.l)} : ${nb(d.v)} ${unite}"><title>${e(d.l)} : ${nb(d.v)} ${unite}</title></rect>`;
  });
  return `<svg class="graphe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogramme">${s}</svg>`;
}

function barresH(lignes) {
  const m = Math.max(...lignes.map((l) => l.v));
  return `<div class="hbarres">${lignes.map((l) => `<div class="hb"><span class="hb-l">${e(l.l)}</span><span class="hb-p"><i style="width:${(l.v / m) * 100}%"></i></span><span class="hb-v">${nb(l.v)}</span></div>`).join("")}</div>`;
}

const compte = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); if (k != null) m[k] = (m[k] || 0) + 1; } return m; };
const miniature = (c) => `<button class="mini" data-id="${c.id}"><span class="objet">${visuel(c)}</span><span><b>${e(c.reference)}</b> ${e(c.nom)}</span></button>`;
const tableAn = (d, u) => `<details class="donnees"><summary>Voir les données</summary><table class="tableau"><thead><tr><th>Année</th><th class="nbr">${u}</th></tr></thead><tbody>${d.map((x) => `<tr><td>${e(x.l)}</td><td class="nbr">${nb(x.v)}</td></tr>`).join("")}</tbody></table></details>`;

export function vueChiffres(cible) {
  const b = bilan(), cs = possedees();
  const annees = compte(cs, (c) => c.an);
  const lo = Math.min(...Object.keys(annees).map(Number)), hi = Math.max(...Object.keys(annees).map(Number));
  const ans = []; for (let a = lo; a <= hi; a++) ans.push({ l: String(a), v: annees[a] || 0 });
  const fam = compte(cs, (c) => c.fam);
  const paliers = [[10000, "jusqu'à 10 000"], [100000, "jusqu'à 100 000"], [500000, "jusqu'à 500 000"], [1000000, "jusqu'à 1 million"], [2000000, "jusqu'à 2 millions"], [Infinity, "plus de 2 millions"]];
  const tir = paliers.map(([p, l], i) => ({ l, v: cs.filter((c) => c.tirage && c.tirage <= p && c.tirage > (i ? paliers[i - 1][0] : 0)).length }));
  const moisE = compte(cs.flatMap((c) => c.actifs), (x) => x.date_ajout.slice(0, 7));
  const rares = cs.filter((c) => c.tirage).sort((x, y) => x.tirage - y.tirage).slice(0, 6);
  const cotees = cs.filter((c) => c.cote != null).sort((x, y) => y.cote - x.cote).slice(0, 6);
  const series = Object.entries(compte(cs, (c) => c.serie)).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([l, v]) => ({ l, v }));
  const par = Object.entries(moisE).sort().map(([k, v]) => ({ l: mois(k + "-01"), v }));
  cible.innerHTML = `<article class="chiffres">
    <p class="grande-phrase">${nb(b.exemplaires)} télécartes rangées sur ${b.pages} pages. ${nb(b.differentes)} sont différentes, ${nb(b.doublons)} sont des doubles, et l'ensemble vaut ${eur(b.valeur)} à la cote.</p>
    <section><h2>Cartes par année d'émission</h2>${barresV(ans, "cartes différentes")}${tableAn(ans, "Cartes")}</section>
    <div class="deux">
      <section><h2>Fabricants de puces</h2>${barresH(Object.entries(fam).sort((x, y) => y[1] - x[1]).map(([l, v]) => ({ l, v })))}</section>
      <section><h2>Tirages</h2>${barresH(tir)}</section>
    </div>
    <div class="deux">
      <section><h2>Les plus petits tirages</h2><div class="minis">${rares.map(miniature).join("")}</div></section>
      <section><h2>Les plus cotées</h2><div class="minis">${cotees.map(miniature).join("")}</div></section>
    </div>
    <div class="deux">
      <section><h2>Séries les mieux fournies</h2>${barresH(series)}</section>
      <section><h2>Entrées dans la collection</h2>${barresH(par.slice(-10).reverse())}</section>
    </div>
  </article>`;
  cible.onclick = (ev) => { const m = ev.target.closest("[data-id]"); if (m) ouvrirFiche(+m.dataset.id); };
}

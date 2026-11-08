import { e, $, $$, nb, eur, mois, norm, cmpRef, csv, telecharger, message } from "./util.js";
import { S, possedees, chargerCatalogue } from "./store.js";
import { visuel } from "./face.js";
import { ouvrirFiche } from "./fiche.js";

export const F = { portee: "", q: "", an1: null, an2: null, puces: new Set(), unites: new Set(), etat: "", dispo: "", tirage: "", cote: "", serie: "", visuel: "", tri: "ref", vue: "grille" };
const LOT = 60;
let resultat = [], affiches = 0, obs = null;
const univers = () => (F.portee === "manques" ? S.absentes : F.portee === "tout" ? [...possedees(), ...S.absentes] : possedees());

export const filtresVersParams = () => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(F)) {
    if (v instanceof Set) { if (v.size) p.set(k, [...v].join("~")); }
    else if (v !== "" && v != null && !(k === "tri" && v === "ref") && !(k === "vue" && v === "grille")) p.set(k, v);
  }
  return p;
};
export function paramsVersFiltres(p) {
  for (const k of Object.keys(F)) {
    const v = p.get(k);
    if (F[k] instanceof Set) { F[k] = new Set(v ? v.split("~") : []); }
    else if (k === "an1" || k === "an2") F[k] = v ? +v : null;
    else F[k] = v ?? (k === "tri" ? "ref" : k === "vue" ? "grille" : "");
  }
  if (F.unites.size) F.unites = new Set([...F.unites].map(String));
}

function correspond(c, sauf) {
  if (F.q) { for (const m of norm(F.q).split(/\s+/)) if (m && !c.texte.includes(m)) return false; }
  if (sauf !== "an" && F.an1 != null && (c.an == null || c.an < F.an1 || c.an > F.an2)) return false;
  if (sauf !== "puce" && F.puces.size && !F.puces.has(c.puce)) return false;
  if (sauf !== "unites" && F.unites.size && !F.unites.has(String(c.unites))) return false;
  if (F.etat) { if (!c.actifs.some((x) => (F.etat === "?" ? !x.etat : x.etat === F.etat))) return false; }
  if (F.dispo === "uniques" && c.n !== 1) return false;
  if (F.dispo === "doublons" && c.n < 2) return false;
  if (F.tirage && !(c.tirage && c.tirage <= +F.tirage)) return false;
  if (F.cote && !(c.cote != null && +c.cote >= +F.cote)) return false;
  if (F.serie && c.serie !== F.serie) return false;
  if (F.visuel === "avec" && !c.image_recto) return false;
  if (F.visuel === "sans" && c.image_recto) return false;
  return true;
}

const NUL = (v, d) => (v == null ? d : v);
const TRIS = {
  ref: ["Référence", (a, b) => cmpRef(a.reference, b.reference)],
  dateA: ["Émission, plus anciennes", (a, b) => NUL(a.date_emission, "9") < NUL(b.date_emission, "9") ? -1 : 1],
  dateD: ["Émission, plus récentes", (a, b) => NUL(a.date_emission, "0") > NUL(b.date_emission, "0") ? -1 : 1],
  tirage: ["Tirage, plus petits", (a, b) => NUL(a.tirage, 9e12) - NUL(b.tirage, 9e12)],
  cote: ["Cote, plus élevées", (a, b) => NUL(+b.cote, -1) - NUL(+a.cote, -1) || (b.cote == null) - (a.cote == null)],
  nom: ["Nom", (a, b) => norm(a.nom).localeCompare(norm(b.nom), "fr")],
  ajout: ["Dernières entrées", (a, b) => (a.dernierAjout < b.dernierAjout ? 1 : a.dernierAjout > b.dernierAjout ? -1 : 0)],
  n: ["Nombre d'exemplaires", (a, b) => b.n - a.n],
};

export function appliquer() {
  const base = univers().filter((c) => correspond(c));
  const f = TRIS[F.tri]?.[1] || TRIS.ref[1];
  resultat = base.slice().sort((a, b) => (F.tri === "cote" ? (b.cote == null ? -1 : a.cote == null ? 1 : +b.cote - +a.cote) : f(a, b)) || cmpRef(a.reference, b.reference));
  return resultat;
}
export const resultats = () => resultat;

function histo() {
  const an = {};
  const u = univers();
  for (const c of u) if (c.an && correspond(c, "an")) an[c.an] = (an[c.an] || 0) + 1;
  const toutes = u.map((c) => c.an).filter(Boolean);
  if (!toutes.length) return "";
  const min = Math.min(...toutes), max = Math.max(...toutes);
  const m = Math.max(1, ...Object.values(an));
  let h = "";
  for (let a = min; a <= max; a++) {
    const v = an[a] || 0, on = F.an1 != null && a >= F.an1 && a <= F.an2;
    h += `<button type="button" class="barre${on ? " on" : ""}" data-an="${a}" style="--h:${v ? Math.max(4, Math.round((v / m) * 100)) : 0}%" title="${a} : ${v} carte${v > 1 ? "s" : ""}" aria-label="${a}, ${v} cartes" aria-pressed="${on}"><i></i></button>`;
  }
  return `<div class="histo" id="histo">${h}</div><div class="histo-axe"><span>${min}</span><span>${F.an1 != null ? (F.an1 === F.an2 ? F.an1 : `${F.an1} à ${F.an2}`) : ""}</span><span>${max}</span></div>`;
}

function listePuces() {
  const compte = {};
  const u = univers();
  for (const c of u) if (correspond(c, "puce")) compte[c.puce] = (compte[c.puce] || 0) + 1;
  const familleDe = new Map(u.map((c) => [c.puce, c.fam]));
  const toutes = [...familleDe.keys()].filter(Boolean).sort();
  const fam = {};
  for (const p of toutes) { const f = familleDe.get(p); (fam[f] = fam[f] || []).push(p); }
  return ["Solaic", "Schlumberger", "Gemplus", "Oberthur", "Autres"].filter((f) => fam[f]).map((f) => `<div class="famille"><p>${f}</p>${fam[f].map((p) => `<label class="choix"><input type="checkbox" data-puce="${e(p)}"${F.puces.has(p) ? " checked" : ""}><span>${e(p)}</span><small>${compte[p] || 0}</small></label>`).join("")}</div>`).join("");
}

function options(val, paires) { return paires.map(([v, l]) => `<option value="${e(v)}"${String(val) === String(v) ? " selected" : ""}>${e(l)}</option>`).join(""); }

function rail() {
  const series = [...new Set(possedees().map((c) => c.serie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const unites = [...new Set(univers().map((c) => c.unites).filter((u) => u != null))].sort((a, b) => a - b);
  const portees = [["", "Les miennes"], ["tout", "Toutes"], ["manques", "Manquantes"]];
  return `<h2 class="masque">Filtres</h2>
  ${S.tailleCatalogue > 0 || S.admin ? `<fieldset><legend>Références</legend><div class="touches">${portees.map(([v, l]) => `<button type="button" class="touche${F.portee === v ? " on" : ""}" data-portee="${v}" aria-pressed="${F.portee === v}">${l}</button>`).join("")}</div></fieldset>` : ""}
  <fieldset><legend>Année d'émission</legend><div id="zone-histo">${histo()}</div></fieldset>
  <fieldset><legend>Unités</legend><div class="touches">${unites.map((u) => `<button type="button" class="touche${F.unites.has(String(u)) ? " on" : ""}" data-unites="${u}" aria-pressed="${F.unites.has(String(u))}">${u}</button>`).join("")}</div></fieldset>
  <fieldset><label for="f-dispo">Exemplaires</label><select id="f-dispo" data-f="dispo">${options(F.dispo, [["", "Toutes"], ["uniques", "Un seul"], ["doublons", "En double"]])}</select></fieldset>
  <fieldset><label for="f-etat">État</label><select id="f-etat" data-f="etat">${options(F.etat, [["", "Tous"], ["L", "Luxe"], ["U", "Usagée"], ["?", "Non noté"]])}</select></fieldset>
  <fieldset><label for="f-tirage">Tirage maximum</label><select id="f-tirage" data-f="tirage">${options(F.tirage, [["", "Tous"], ["10000", "10 000"], ["100000", "100 000"], ["500000", "500 000"], ["1000000", "1 million"]])}</select></fieldset>
  <fieldset><label for="f-cote">Cote minimum</label><select id="f-cote" data-f="cote">${options(F.cote, [["", "Toutes"], ["1", "1 €"], ["2", "2 €"], ["5", "5 €"], ["10", "10 €"]])}</select></fieldset>
  <fieldset><label for="f-serie">Série</label><select id="f-serie" data-f="serie">${options(F.serie, [["", "Toutes"], ...series.map((s) => [s, s])])}</select></fieldset>
  <fieldset><label for="f-visuel">Visuel</label><select id="f-visuel" data-f="visuel">${options(F.visuel, [["", "Tous"], ["avec", "Avec photo"], ["sans", "Sans photo"]])}</select></fieldset>
  <fieldset><legend>Puce</legend><div id="zone-puces">${listePuces()}</div></fieldset>
  <button type="button" class="lien" id="raz">Tout effacer</button>`;
}

const estFiltre = () => F.q || F.an1 != null || F.puces.size || F.unites.size || F.etat || F.dispo || F.tirage || F.cote || F.serie || F.visuel;

const tuile = (c) => `<button class="carte${c.absente ? " absente" : ""}" data-id="${c.id}">
  <span class="objet pile${c.n >= 4 ? " p3" : c.n >= 2 ? " p2" : ""}">${visuel(c)}</span>
  <span class="legende"><b>${e(c.reference)}</b>${c.absente ? `<span class="qte">manquante</span>` : c.n > 1 ? `<span class="qte">x${c.n}</span>` : ""}<span class="nom">${e(c.nom)}</span><span class="meta">${[c.an, e(c.puce), c.tirage ? tirageCourt(c.tirage) : ""].filter(Boolean).join(", ")}</span></span>
</button>`;
export function tirageCourt(t) { return t >= 1e6 ? `${String(+(t / 1e6).toFixed(2)).replace(".", ",")} M` : t >= 1000 ? `${Math.round(t / 1000)} 000` : String(t); }

const ligne = (c) => `<tr class="${c.absente ? "absente" : ""}" data-id="${c.id}" tabindex="0"><td><b>${e(c.reference)}</b></td><td>${e(c.nom)}</td><td class="nbr">${c.unites ?? ""}</td><td>${e(c.puce)}</td><td>${c.date_emission ? c.date_emission.slice(0, 7).split("-").reverse().join("/") : ""}</td><td class="nbr">${c.tirage ? nb(+c.tirage) : ""}</td><td class="nbr">${c.cote != null ? eur(+c.cote) : ""}</td><td class="nbr">${c.n}</td></tr>`;

function suite() {
  const z = $("#liste");
  if (!z) return;
  const lot = resultat.slice(affiches, affiches + LOT);
  affiches += lot.length;
  if (F.vue === "liste") $("tbody", z).insertAdjacentHTML("beforeend", lot.map(ligne).join(""));
  else z.insertAdjacentHTML("beforeend", lot.map(tuile).join(""));
  $("#sentinelle").hidden = affiches >= resultat.length;
}

export function rendreListe() {
  appliquer();
  affiches = 0;
  const z = $("#zone-liste");
  if (!z) return;
  if (!resultat.length) {
    z.innerHTML = `<div class="rien"><p>Aucune carte ne correspond à ces critères.</p><button class="bouton" id="raz2">Effacer les filtres</button></div>`;
  } else if (F.vue === "liste") {
    z.innerHTML = `<div class="defile"><table class="tableau" id="liste"><thead><tr><th>Réf.</th><th>Nom</th><th class="nbr">Unités</th><th>Puce</th><th>Émission</th><th class="nbr">Tirage</th><th class="nbr">Cote</th><th class="nbr">Ex.</th></tr></thead><tbody></tbody></table></div>`;
  } else z.innerHTML = `<div class="grille" id="liste"></div>`;
  z.insertAdjacentHTML("beforeend", `<div id="sentinelle" class="sentinelle"></div>`);
  if (resultat.length) suite();
  obs?.disconnect();
  obs = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) suite(); }, { rootMargin: "800px" });
  obs.observe($("#sentinelle"));
  const nbEx = resultat.reduce((t, c) => t + c.n, 0);
  const possede = resultat.filter((c) => !c.absente).length;
  $("#compteur").innerHTML = F.portee === "tout" ? `<b>${nb(possede)}</b> possédées sur ${nb(resultat.length)} références${resultat.length ? `, soit ${Math.floor((possede / resultat.length) * 100)} %` : ""}`
    : F.portee === "manques" ? `<b>${nb(resultat.length)}</b> référence${resultat.length > 1 ? "s" : ""} manquante${resultat.length > 1 ? "s" : ""}`
    : `<b>${nb(resultat.length)}</b> carte${resultat.length > 1 ? "s" : ""} différente${resultat.length > 1 ? "s" : ""}, ${nb(nbEx)} exemplaire${nbEx > 1 ? "s" : ""}`;
  const note = $("#note-catalogue");
  if (note) { note.hidden = !(F.portee && !S.tailleCatalogue); }
  const zh = $("#zone-histo"); if (zh) zh.innerHTML = histo();
  const zp = $("#zone-puces"); if (zp) zp.innerHTML = listePuces();
  $("#raz").hidden = !estFiltre();
  actualiser?.();
}
let actualiser = null;

export function vueCollection(cible, onChange) {
  actualiser = onChange;
  cible.innerHTML = `<div class="collection">
    <aside class="rail" id="rail">${rail()}</aside>
    <section class="resultats">
      <div class="barre-outils">
        <button class="bouton ouvrir-rail" id="ouvrir-rail" aria-expanded="false" aria-controls="rail">Filtres</button>
        <p id="compteur"></p>
        <label class="tri">Trier par <select id="tri">${options(F.tri, Object.entries(TRIS).map(([k, v]) => [k, v[0]]))}</select></label>
        <div class="touches" role="group" aria-label="Affichage">
          <button class="touche${F.vue === "grille" ? " on" : ""}" data-vue="grille" aria-pressed="${F.vue === "grille"}">Cartes</button>
          <button class="touche${F.vue === "liste" ? " on" : ""}" data-vue="liste" aria-pressed="${F.vue === "liste"}">Liste</button>
        </div>
        <button class="lien" id="csv">Exporter cette sélection (CSV)</button>
      </div>
      <p class="note" id="note-catalogue" hidden>Aucune référence n'est encore importée. <a href="#/atelier">Atelier, section Catalogue</a> : cliquez sur Importer le catalogue fourni.</p>
      <div id="zone-liste"></div>
    </section>
  </div>`;
  rendreListe();
  const preparer = async () => {
    if (!F.portee || S.catalogue) return;
    $("#compteur").textContent = "Chargement des références…";
    try { await chargerCatalogue(); } catch (er) { F.portee = ""; message(er.message, "erreur"); }
    $("#rail").innerHTML = rail();
    rendreListe();
  };
  preparer();
  const c = $(".collection", cible);
  let debut = null, glisse = false;
  c.addEventListener("pointerdown", (ev) => { const b = ev.target.closest("[data-an]"); if (b) { debut = +b.dataset.an; glisse = false; ev.preventDefault(); } });
  c.addEventListener("pointermove", (ev) => {
    if (debut == null || !ev.buttons) return;
    const b = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-an]");
    if (!b) return;
    const a = +b.dataset.an;
    if (a !== debut) glisse = true;
    if (glisse) { F.an1 = Math.min(debut, a); F.an2 = Math.max(debut, a); $$(".barre", c).forEach((x) => x.classList.toggle("on", +x.dataset.an >= F.an1 && +x.dataset.an <= F.an2)); }
  });
  c.addEventListener("pointerup", (ev) => {
    if (debut == null) return;
    if (!glisse) { if (F.an1 === debut && F.an2 === debut) F.an1 = F.an2 = null; else F.an1 = F.an2 = debut; }
    debut = null; rendreListe();
  });
  c.addEventListener("keydown", (ev) => {
    const b = ev.target.closest?.("[data-an]");
    if (b && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); const a = +b.dataset.an; if (F.an1 === a && F.an2 === a) F.an1 = F.an2 = null; else F.an1 = F.an2 = a; rendreListe(); $(`[data-an="${a}"]`, c)?.focus(); }
    const tr = ev.target.closest?.("tr[data-id]");
    if (tr && ev.key === "Enter") ouvrirFiche(+tr.dataset.id, resultat.map((x) => x.id));
  });
  c.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.f) F[t.dataset.f] = t.value;
    else if (t.dataset.puce) { t.checked ? F.puces.add(t.dataset.puce) : F.puces.delete(t.dataset.puce); }
    else if (t.id === "tri") F.tri = t.value;
    else return;
    rendreListe();
  });
  c.addEventListener("click", (ev) => {
    const t = ev.target.closest("button,tr[data-id]");
    if (!t) return;
    if (t.dataset.id) return ouvrirFiche(+t.dataset.id, resultat.map((x) => x.id));
    if (t.dataset.unites) { const v = t.dataset.unites; F.unites.has(v) ? F.unites.delete(v) : F.unites.add(v); t.classList.toggle("on"); t.setAttribute("aria-pressed", F.unites.has(v)); rendreListe(); }
    if (t.dataset.portee != null) {
      F.portee = t.dataset.portee;
      if (F.portee && !S.catalogue) preparer();
      else { $("#rail").innerHTML = rail(); rendreListe(); }
    }
    if (t.dataset.vue) { F.vue = t.dataset.vue; $$("[data-vue]", c).forEach((b) => { b.classList.toggle("on", b === t); b.setAttribute("aria-pressed", b === t); }); rendreListe(); }
    if (t.id === "raz" || t.id === "raz2") {
      Object.assign(F, { q: "", an1: null, an2: null, puces: new Set(), unites: new Set(), etat: "", dispo: "", tirage: "", cote: "", serie: "", visuel: "" });
      $("#q").value = ""; $("#rail").innerHTML = rail(); rendreListe();
    }
    if (t.id === "ouvrir-rail") { const o = $("#rail").classList.toggle("ouvert"); t.setAttribute("aria-expanded", o); t.textContent = o ? "Masquer les filtres" : "Filtres"; }
    if (t.id === "csv") exporterCsv(resultat, "selection");
  });
}

export function exporterCsv(cartes, nom) {
  const l = [["Référence", "Nom", "Unités", "Puce", "Émission", "Tirage", "Cote", "Série", "Exemplaires", "Emplacements", "États"]];
  for (const c of cartes) l.push([c.reference, c.nom, c.unites, c.puce, c.date_emission?.slice(0, 7), c.tirage, c.cote, c.serie, c.n, c.actifs.map((x) => { const p = Math.floor((x.indice - 1) / window.TELECARTES.casesParPage) + 1; return `${p}-${((x.indice - 1) % window.TELECARTES.casesParPage) + 1}`; }).join(" "), c.actifs.map((x) => x.etat || "?").join(" ")]);
  telecharger(`telecartes-${nom}.csv`, csv(l), "text/csv;charset=utf-8");
}

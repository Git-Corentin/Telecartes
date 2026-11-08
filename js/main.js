import { CFG, e, $, $$, nb, norm, message } from "./util.js";
import { S, db, surChangement, possedees, bilan } from "./store.js";
import { visuel } from "./face.js";
import { ouvrirFiche } from "./fiche.js";
import { F, vueCollection, rendreListe, filtresVersParams, paramsVersFiltres, resultats } from "./collection.js";
import { vueClasseur } from "./classeur.js";
import { vueDoublons } from "./doublons.js";
import { vueChiffres } from "./chiffres.js";
import { vueRecherchees } from "./recherchees.js";
import { vueConnexion, vueAjouter, vueModifier, vueAtelier } from "./admin.js";

const LARGEUR_LCD = 20;
const main = $("#contenu"), lcd1 = $("#lcd1"), q = $("#q");
let lectureEnCours = false;

// Dans DSEG14, « ! » est un blanc de la largeur d'un caractère.
function lcd(t) { lcd1.textContent = t.slice(0, LARGEUR_LCD).replace(/ /g, "!"); }
const lcdRepos = () => { if (!lectureEnCours) lcd(`CREDIT ${bilan().exemplaires} CARTES`); };

function nav(route) {
  const liens = [["collection", "Collection"], ["classeur", "Classeur"], ["doublons", "Doublons"], ["chiffres", "Chiffres"], ["recherchees", "Recherchées"]];
  if (S.admin) liens.push(["ajouter", "Ajouter"], ["atelier", "Atelier"]);
  $("#nav").innerHTML = liens.map(([r, l]) => `<a href="#/${r}"${route === r ? ' aria-current="page"' : ""}>${l}</a>`).join("");
}

function pied() {
  $("#pied-texte").innerHTML = S.demo ? "Démonstration : Supabase n'est pas branché, les changements disparaissent au rechargement." : `Références et cotes d'après le catalogue Phonecote.${S.tailleCatalogue ? ' Catalogue et visuels : <a href="http://bertrand.dippe.free.fr" rel="noopener">bertrand.dippe.free.fr</a>.' : ""}`;
  $("#pied-compte").innerHTML = S.user ? `<button class="lien" id="sortir">Se déconnecter</button>` : `<a href="#/connexion">Connexion</a>`;
  const b = $("#sortir"); if (b) b.onclick = async () => { await db.deconnexion(); rendre(); message("Déconnecté."); };
}

function lecteur() {
  const c = possedees().slice().sort((a, b) => (a.dernierAjout < b.dernierAjout ? 1 : a.dernierAjout > b.dernierAjout ? -1 : b.actifs.at(-1).indice - a.actifs.at(-1).indice))[0];
  $("#lecteur").innerHTML = c ? `<button class="insertion" data-id="${c.id}" aria-label="Dernière entrée : ${e(c.reference)}, ${e(c.nom)}" title="Dernière entrée : ${e(c.reference)}"><span class="objet">${visuel(c)}</span></button><span class="fente"></span>` : "";
}

const ADMIN = ["ajouter", "modifier", "atelier"];

function rendre() {
  const [chemin, qs = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [route = "collection", arg] = chemin.split("/");
  const params = new URLSearchParams(qs);
  const r = route || "collection";
  nav(r); pied(); lecteur();
  if (ADMIN.includes(r) && !S.admin) { vueConnexion(main, location.hash); return; }
  main.onclick = null;
  if (S.vide && !S.admin && r === "collection") {
    main.innerHTML = `<div class="rien"><p>La collection n'a pas encore été importée.</p><a class="bouton" href="#/connexion">Se connecter pour l'importer</a></div>`;
  } else switch (r) {
    case "collection": paramsVersFiltres(params); q.value = F.q; vueCollection(main, majUrl); break;
    case "classeur": vueClasseur(main, +arg || 1, +params.get("case") || 0); break;
    case "doublons": vueDoublons(main); break;
    case "chiffres": vueChiffres(main); break;
    case "recherchees": vueRecherchees(main); break;
    case "connexion": vueConnexion(main); break;
    case "ajouter": vueAjouter(main, params); break;
    case "modifier": vueModifier(main, arg); break;
    case "atelier": vueAtelier(main); break;
    default: location.hash = "#/collection"; return;
  }
  const c = params.get("carte");
  if (c && !$("#fiche").open) ouvrirFiche(+c);
  window.scrollTo({ top: r === "classeur" && params.get("case") ? window.scrollY : 0 });
}

function majUrl() {
  const p = filtresVersParams();
  const s = p.toString();
  history.replaceState(null, "", `${location.pathname}#/collection${s ? "?" + s : ""}`);
  if (lectureEnCours) return;
  const n = resultats().length;
  if (F.q || s) { lcd(n ? `${n} RESULTAT${n > 1 ? "S" : ""}` : "AUCUNE CARTE"); $("#annonce").textContent = `${n} résultats`; }
  else lcdRepos();
}

/* Recherche sur l'écran et clavier */
const estCollection = () => /^#\/?(collection)?(\?|$)/.test(location.hash) || !location.hash;
let t = 0;
function chercher() {
  const v = norm(q.value).toUpperCase();
  if (q.value !== v) q.value = v;
  clearTimeout(t);
  t = setTimeout(() => {
    F.q = v.trim();
    if (estCollection()) rendreListe();
    else { const p = filtresVersParams(); location.hash = `#/collection?${p}`; }
  }, 90);
}
q.addEventListener("input", chercher);
$("#ecran").addEventListener("submit", (ev) => { ev.preventDefault(); ouvrirPremier(); });
function ouvrirPremier() {
  const r = resultats();
  if (r.length && F.q) {
    const ex = r.find((c) => norm(c.reference) === norm(F.q));
    ouvrirFiche((ex || r[0]).id, r.map((c) => c.id));
  }
}
$("#clavier").addEventListener("click", (ev) => {
  const k = ev.target.dataset?.k; if (!k) return;
  if (k === "*") { q.value = ""; chercher(); return; }
  if (k === "#") { clearTimeout(t); F.q = q.value.trim(); if (estCollection()) rendreListe(); ouvrirPremier(); return; }
  q.value += k; chercher();
});
$("#lecteur").addEventListener("click", (ev) => { const b = ev.target.closest("[data-id]"); if (b) ouvrirFiche(+b.dataset.id); });

function lectureDeCarte(total) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return lcdRepos();
  lectureEnCours = true;
  document.body.classList.add("lecture");
  const debut = performance.now(), D = 1150;
  (function pas(n) {
    const k = Math.min(1, (n - debut) / D);
    lcd(`LECTURE ${String(Math.round(total * k * k)).padStart(4, " ")}`);
    if (k < 1) requestAnimationFrame(pas);
    else { lectureEnCours = false; document.body.classList.remove("lecture"); lcdRepos(); }
  })(debut);
}

async function demarrer() {
  $("#titre").textContent = CFG.titre;
  document.title = `${CFG.titre} : ${CFG.sousTitre}`;
  $("#sous-titre").textContent = CFG.sousTitre;
  $("#fantome1").textContent = "~".repeat(LARGEUR_LCD);
  $("#fantome2").textContent = "~".repeat(LARGEUR_LCD);
  lcd("PATIENTEZ");
  try {
    await db.charger();
    await db.session();
  } catch (er) {
    lcd("HORS SERVICE");
    main.innerHTML = `<div class="rien"><p>La collection n'a pas pu être chargée : ${e(er.message)}</p><button class="bouton" onclick="location.reload()">Réessayer</button></div>`;
    return;
  }
  surChangement(() => { lcdRepos(); lecteur(); nav(location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || "collection"); pied(); if (estCollection()) rendreListe(); });
  window.addEventListener("hashchange", rendre);
  rendre();
  lectureDeCarte(bilan().exemplaires);
}
demarrer();

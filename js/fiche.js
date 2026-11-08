import { e, $, $$, nb, eur, mois, jour, position, indiceDe, codeColnect, message, aujourdhui, CFG } from "./util.js";
import { S, carteParId, db, notifier, indicesOccupes } from "./store.js";
import { visuel, svgPuce, photoPuce } from "./face.js";

const dlg = $("#fiche");
let liste = [], courant = null, verso = false;

export function ouvrirFiche(id, contexte) {
  if (contexte) liste = contexte;
  courant = carteParId(id);
  if (!courant) return;
  verso = false;
  rendre();
  if (!dlg.open) dlg.showModal();
  const u = new URL(location.href);
  const [p, q = ""] = location.hash.split("?");
  const sp = new URLSearchParams(q); sp.set("carte", id);
  history.replaceState(null, "", `${u.pathname}${p || "#/collection"}?${sp}`);
}

function fermerUrl() {
  const [p, q = ""] = location.hash.split("?");
  const sp = new URLSearchParams(q); sp.delete("carte");
  const s = sp.toString();
  history.replaceState(null, "", `${location.pathname}${p}${s ? "?" + s : ""}`);
}
dlg.addEventListener("close", fermerUrl);
dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); });

function voisin(d) {
  const ids = liste.length ? liste : S.cartes.map((c) => c.id);
  const i = ids.indexOf(courant.id);
  if (i < 0) return;
  const id = ids[(i + d + ids.length) % ids.length];
  ouvrirFiche(id);
}
dlg.addEventListener("keydown", (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  if (ev.key === "ArrowRight") voisin(1);
  if (ev.key === "ArrowLeft") voisin(-1);
});

const ETATS = { U: "usagée", L: "luxe" };
const liens = (c) => {
  const q = encodeURIComponent(`télécarte ${c.reference} ${c.nom}`);
  const g = encodeURIComponent(`site:colnect.com "Pho:${codeColnect(c.reference)}"`);
  return `<a href="https://www.google.com/search?q=${g}" target="_blank" rel="noopener">Colnect</a>
    <a href="https://www.ebay.fr/sch/i.html?_nkw=${q}" target="_blank" rel="noopener">eBay</a>
    <a href="https://www.delcampe.net/fr/collections/search?term=${q}" target="_blank" rel="noopener">Delcampe</a>`;
};

function rendre() {
  const c = courant;
  if (c.absente) return rendreAbsente(c);
  const pp = photoPuce(c.puce);
  const ligneEx = (x) => {
    const p = position(x.indice);
    return `<li data-ex="${x.id}">
      <a href="#/classeur/${p.page}?case=${p.case}" data-classeur>Page ${p.page}, case ${p.case}</a>
      <span>${x.etat ? ETATS[x.etat] : "état non noté"}</span>
      <span class="discret">entrée le ${jour(x.date_ajout)}</span>
      ${S.admin ? `<span class="outils">
        <select data-etat aria-label="État"><option value="">Non noté</option><option value="U"${x.etat === "U" ? " selected" : ""}>Usagée</option><option value="L"${x.etat === "L" ? " selected" : ""}>Luxe</option></select>
        <button class="lien" data-deplacer>Déplacer</button>
        <button class="lien" data-ceder>Céder</button>
      </span>` : ""}
    </li>`;
  };
  $("#fiche-corps").innerHTML = `<div class="fiche">
    <button class="fermer" data-fermer aria-label="Fermer">×</button>
    <div class="fiche-visuel">
      <button class="retourner" data-retourner aria-label="Retourner la carte"><span class="objet grand">${visuel(c, { verso })}</span></button>
      <p class="discret">${c.image_recto ? (c.image_source && c.image_source !== "Photo personnelle" ? `Visuel : ${e(c.image_source)}. ` : "") : "Couverture provisoire, le visuel n'est pas encore ajouté. "}Touchez la carte pour la retourner.</p>
      <div class="fiche-nav">
        <button class="touche" data-prec aria-label="Carte précédente">‹</button>
        <button class="touche" data-suiv aria-label="Carte suivante">›</button>
      </div>
    </div>
    <div class="fiche-infos">
      <p class="fiche-ref">${e(c.reference)}</p>
      <h2>${e(c.nom)}</h2>
      ${c.serie ? `<p><a href="#/collection?serie=${encodeURIComponent(c.serie)}" data-fermer>Série ${e(c.serie)}</a></p>` : ""}
      <dl>
        <div><dt>Émission</dt><dd>${c.date_emission ? mois(c.date_emission) : "inconnue"}</dd></div>
        <div><dt>Unités</dt><dd>${c.unites ?? "non indiquées"}</dd></div>
        <div><dt>Tirage</dt><dd>${c.tirage ? nb(+c.tirage) : "inconnu"}</dd></div>
        <div><dt>Cote</dt><dd>${c.cote != null ? eur(+c.cote) : "non cotée"}</dd></div>
        <div class="dd-puce"><dt>Puce</dt><dd>${pp ? `<img src="${e(pp)}" alt="" class="photo-puce">` : svgPuce(c.puce, "puce-seule")}<span>${e(c.puce)}<br><small>${e(c.fam)}</small></span></dd></div>
      </dl>
      ${c.notes ? `<p>${e(c.notes)}</p>` : ""}
      <h3>${c.n > 1 ? `${c.n} exemplaires` : c.n === 1 ? "Un exemplaire" : "Plus aucun exemplaire"}</h3>
      <ul class="exemplaires">${c.actifs.map(ligneEx).join("")}</ul>
      <p class="fiche-liens">Chercher ailleurs : ${liens(c)}</p>
      ${S.admin ? `<p class="fiche-admin"><a class="bouton" href="#/modifier/${c.id}" data-fermer>Modifier la carte</a> <a class="bouton" href="#/ajouter?ref=${encodeURIComponent(c.reference)}&carte=" data-ajout="${c.id}">Ajouter un exemplaire</a></p>` : ""}
    </div>
  </div>`;
}

function rendreAbsente(c) {
  $("#fiche-corps").innerHTML = `<div class="fiche fiche-absente">
    <button class="fermer" data-fermer aria-label="Fermer">×</button>
    <div class="fiche-visuel"><span class="objet grand">${visuel(c)}</span>
      <div class="fiche-nav"><button class="touche" data-prec aria-label="Carte précédente">‹</button><button class="touche" data-suiv aria-label="Carte suivante">›</button></div></div>
    <div class="fiche-infos">
      <p class="fiche-ref">${e(c.reference)}</p>
      <h2>${e(c.nom)}</h2>
      <p><b>Pas encore dans la collection.</b></p>
      <dl>
        <div><dt>Émission</dt><dd>${c.date_emission ? mois(c.date_emission) : "inconnue"}</dd></div>
        <div><dt>Unités</dt><dd>${c.unites ?? "non indiquées"}</dd></div>
        <div><dt>Tirage</dt><dd>${c.tirage ? nb(+c.tirage) : "inconnu"}</dd></div>
        <div><dt>Cote</dt><dd>${c.cote != null ? eur(+c.cote) : "non cotée"}</dd></div>
        <div><dt>Puce</dt><dd>${e(c.puce || "inconnue")}</dd></div>
        <div><dt>Source</dt><dd>${e(c.image_source || "Catalogue")}</dd></div>
      </dl>
      <p class="fiche-liens">Chercher ailleurs : ${liens(c)}</p>
      ${S.admin ? `<p class="fiche-admin"><button class="bouton primaire" data-ajout="${c.id}">Ajouter à la collection</button> <button class="bouton" data-souhait>Ajouter aux recherchées</button></p>` : ""}
    </div></div>`;
}

async function majEx(x, patch) {
  try {
    await db.modifier("exemplaires", x.id, patch);
    Object.assign(x, patch);
    notifier();
    rendre();
  } catch (err) { message(traduire(err), "erreur"); }
}
export function traduire(err) {
  if (/exemplaires_indice_actif/.test(err.message)) return "Cet emplacement est déjà occupé.";
  if (/cartes_type_unique/.test(err.message)) return "Une carte existe déjà avec cette référence, cette puce et ces unités.";
  return err.message;
}

dlg.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,a");
  if (!t) return;
  if (t.matches("[data-fermer]")) return dlg.close();
  if (t.matches("[data-classeur]")) return dlg.close();
  if (t.matches("[data-retourner]")) { verso = !verso; const o = $(".objet", t); o.classList.add("tourne"); o.innerHTML = visuel(courant, { verso }); setTimeout(() => o.classList.remove("tourne"), 300); return; }
  if (t.matches("[data-prec]")) return voisin(-1);
  if (t.matches("[data-suiv]")) return voisin(1);
  if (t.matches("[data-ajout]")) { ev.preventDefault(); const id = t.dataset.ajout; dlg.close(); location.hash = `#/ajouter?type=${id}`; return; }
  if (t.matches("[data-souhait]")) {
    if (S.souhaits.some((s) => s.reference === courant.reference)) return message("Cette référence est déjà dans les recherchées.");
    try { const [l] = await db.ajouter("souhaits", [{ reference: courant.reference, nom: courant.nom }]); S.souhaits.push(l); message(`${courant.reference} ajoutée aux recherchées.`); } catch (er) { message(er.message, "erreur"); }
    return;
  }
  const li = t.closest("[data-ex]");
  if (!li) return;
  const x = courant.actifs.find((v) => v.id === +li.dataset.ex);
  if (t.matches("[data-ceder]")) {
    const carte = courant;
    await majEx(x, { sorti_le: aujourdhui() });
    message(`${carte.reference} : exemplaire retiré de la collection.`, "ok", { label: "Annuler", fn: () => { db.modifier("exemplaires", x.id, { sorti_le: null }).then(() => { x.sorti_le = null; notifier(); }).catch((er) => message(traduire(er), "erreur")); } });
  }
  if (t.matches("[data-deplacer]")) {
    const p = position(x.indice);
    li.querySelector(".outils").innerHTML = `<label>Page <input type="number" min="1" value="${p.page}" data-p></label> <label>Case <input type="number" min="1" max="${CFG.casesParPage}" value="${p.case}" data-c></label> <button class="lien" data-valider>Valider</button>`;
  }
  if (t.matches("[data-valider]")) {
    const n = indiceDe(+$("[data-p]", li).value, +$("[data-c]", li).value);
    if (n < 1 || +$("[data-c]", li).value > CFG.casesParPage) return message("Emplacement invalide.", "erreur");
    if (n !== x.indice && indicesOccupes().has(n)) return message("Cet emplacement est déjà occupé.", "erreur");
    await majEx(x, { indice: n });
  }
});
dlg.addEventListener("change", (ev) => {
  if (ev.target.matches("[data-etat]")) {
    const x = courant.actifs.find((v) => v.id === +ev.target.closest("[data-ex]").dataset.ex);
    majEx(x, { etat: ev.target.value || null });
  }
});

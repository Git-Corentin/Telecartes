import { e, $, $$, nb, eur, csv, telecharger, CFG, position, message } from "./util.js";
import { S, possedees, carteParId } from "./store.js";
import { visuel } from "./face.js";
import { ouvrirFiche } from "./fiche.js";
import { pdfDoublons, prix, resumeEtats } from "./pdf.js";

const RANG = { L: 0, U: 1 };
// On garde le meilleur exemplaire, les autres sont disponibles.
export function aCeder(c) {
  const t = c.actifs.slice().sort((a, b) => (RANG[a.etat] ?? 2) - (RANG[b.etat] ?? 2) || a.indice - b.indice);
  return t.slice(1);
}
const exclus = new Set();
const O = { titre: "Télécartes à céder", mode: "cote", pourcent: 50, fixe: 0.5, min: 0.2, colonnes: 4, visuels: true, tri: "ref", etat: "", contact: CFG.contact || "" };

function items() {
  let l = possedees().filter((c) => c.n > 1).map((c) => ({ c, ex: aCeder(c).filter((x) => !O.etat || x.etat === O.etat) })).filter((i) => i.ex.length);
  if (O.tri === "cote") l = l.sort((a, b) => (+b.c.cote || 0) - (+a.c.cote || 0));
  if (O.tri === "date") l = l.sort((a, b) => (a.c.date_emission || "9") < (b.c.date_emission || "9") ? -1 : 1);
  if (O.tri === "qte") l = l.sort((a, b) => b.ex.length - a.ex.length);
  return l;
}
const retenus = (l) => l.filter((i) => !exclus.has(i.c.id));

export function vueDoublons(cible) {
  cible.innerHTML = `<div class="doublons">
    <form class="reglages" id="reglages">
      <h1>Doublons</h1>
      <p id="d-total"></p>
      <label>Titre du document<input name="titre" value="${e(O.titre)}"></label>
      <label>Prix affiché<select name="mode">
        <option value="cote">La cote</option><option value="pourcent">Un pourcentage de la cote</option><option value="fixe">Un prix unique</option><option value="aucun">Pas de prix</option>
      </select></label>
      <label data-pour="pourcent">Pourcentage<input name="pourcent" type="number" min="1" max="200" value="${O.pourcent}"></label>
      <label data-pour="fixe">Prix unique (€)<input name="fixe" type="number" min="0" step="0.05" value="${O.fixe}"></label>
      <label data-pour="cote pourcent">Prix minimum (€)<input name="min" type="number" min="0" step="0.05" value="${O.min}"></label>
      <label>État<select name="etat"><option value="">Tous</option><option value="U">Usagées</option><option value="L">Luxe</option></select></label>
      <label>Ordre<select name="tri"><option value="ref">Référence</option><option value="cote">Cote décroissante</option><option value="date">Émission</option><option value="qte">Quantité</option></select></label>
      <label>Présentation<select name="colonnes"><option value="3">3 cartes par ligne</option><option value="4">4 cartes par ligne</option><option value="5">5 cartes par ligne</option><option value="liste">Liste compacte, sans visuels</option></select></label>
      <label class="choix"><input type="checkbox" name="visuels" checked><span>Inclure les visuels</span></label>
      <label>Bas de page (contact, annonce)<input name="contact" value="${e(O.contact)}" placeholder="Annonce leboncoin, e-mail…"></label>
      <button class="bouton primaire" id="d-pdf" type="button">Créer le PDF</button>
      <button class="bouton" id="d-texte" type="button">Copier un texte d'annonce</button>
      ${S.admin ? `<button class="lien" id="d-retrait" type="button">Liste de retrait des classeurs (CSV)</button>` : ""}
      <button class="lien" id="d-csv" type="button">Exporter en CSV</button>
      <p id="d-etat" class="discret" role="status"></p>
    </form>
    <section><p class="discret">Le meilleur exemplaire de chaque carte reste dans la collection. Décochez une ligne pour la retirer du document.</p><div id="d-liste" class="d-liste"></div></section>
  </div>`;
  const f = $("#reglages", cible);
  f.mode.value = O.mode; f.etat.value = O.etat; f.tri.value = O.tri; f.colonnes.value = O.colonnes;
  const dessiner = () => {
    const l = items(), r = retenus(l);
    const n = r.reduce((t, i) => t + i.ex.length, 0);
    const total = r.reduce((t, i) => t + (prix(i.c, O) || 0) * i.ex.length, 0);
    $("#d-total").innerHTML = `<b>${nb(n)}</b> cartes disponibles sur ${nb(r.length)} références${O.mode !== "aucun" ? `, soit ${eur(Math.round(total * 100) / 100)}` : ""}.`;
    $$("[data-pour]", f).forEach((x) => { x.hidden = !x.dataset.pour.split(" ").includes(O.mode); });
    $("#d-liste").innerHTML = l.map(({ c, ex }) => {
      const p = prix(c, O);
      return `<div class="d-ligne${exclus.has(c.id) ? " exclu" : ""}">
        <button class="d-case" data-basculer="${c.id}" aria-pressed="${!exclus.has(c.id)}" aria-label="Inclure ${e(c.reference)}"></button>
        <button class="d-corps" data-id="${c.id}"><span class="objet">${visuel(c)}</span><span class="d-texte"><b>${e(c.reference)}</b> ${e(c.nom)}<small>${[c.unites != null ? c.unites + " u" : "", e(c.puce), c.an].filter(Boolean).join(", ")}</small></span></button>
        <span class="d-qte">x${ex.length}<small>${resumeEtats(ex)}</small></span>
        <span class="d-prix">${p != null ? (p ? eur(p) : "à débattre") : ""}</span>
      </div>`;
    }).join("") || `<p>Aucun doublon pour ces critères.</p>`;
  };
  dessiner();
  f.addEventListener("input", () => {
    const d = new FormData(f);
    for (const k of ["titre", "mode", "pourcent", "fixe", "min", "tri", "etat", "colonnes", "contact"]) O[k] = d.get(k);
    O.visuels = f.visuels.checked;
    dessiner();
  });
  f.addEventListener("submit", (ev) => ev.preventDefault());
  $("#d-pdf").onclick = async (ev) => {
    const r = retenus(items());
    if (!r.length) return message("Aucune carte à mettre dans le document.", "erreur");
    ev.target.disabled = true;
    try {
      const doc = await pdfDoublons(r, O, (t) => { $("#d-etat").textContent = t; });
      doc.save("doublons-telecartes.pdf");
      $("#d-etat").textContent = `PDF créé, ${doc.getNumberOfPages()} page${doc.getNumberOfPages() > 1 ? "s" : ""}.`;
    } catch (er) { message(er.message, "erreur"); } finally { ev.target.disabled = false; }
  };
  $("#d-texte").onclick = async () => {
    const r = retenus(items());
    const n = r.reduce((t, i) => t + i.ex.length, 0);
    const t = `${O.titre} : ${n} télécartes françaises différentes ou en double, de ${Math.min(...r.map((i) => i.c.an || 9999))} à ${Math.max(...r.map((i) => i.c.an || 0))}.\nRéférences Phonecote : ${r.slice(0, 40).map((i) => i.c.reference).join(", ")}${r.length > 40 ? "…" : ""}\nListe complète avec visuels en PDF sur demande.${O.contact ? "\n" + O.contact : ""}`;
    try { await navigator.clipboard.writeText(t); message("Texte d'annonce copié."); } catch { message(t, "ok"); }
  };
  const lignesCsv = (avecPlace) => {
    const l = [["Référence", "Nom", "Unités", "Puce", "Émission", "Quantité", "États", "Cote", ...(avecPlace ? ["Emplacements"] : [])]];
    for (const { c, ex } of retenus(items())) l.push([c.reference, c.nom, c.unites, c.puce, c.date_emission?.slice(0, 7), ex.length, ex.map((x) => x.etat || "?").join(" "), c.cote, ...(avecPlace ? [ex.map((x) => { const p = position(x.indice); return `p${p.page} c${p.case}`; }).join(", ")] : [])]);
    return csv(l);
  };
  $("#d-csv").onclick = () => telecharger("doublons-telecartes.csv", lignesCsv(false), "text/csv;charset=utf-8");
  const rt = $("#d-retrait"); if (rt) rt.onclick = () => telecharger("retrait-classeurs.csv", lignesCsv(true), "text/csv;charset=utf-8");
  $("#d-liste").onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.basculer) { const id = +b.dataset.basculer; exclus.has(id) ? exclus.delete(id) : exclus.add(id); dessiner(); }
    if (b.dataset.id) ouvrirFiche(+b.dataset.id, retenus(items()).map((i) => i.c.id));
  };
}

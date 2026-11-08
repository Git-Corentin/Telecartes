import { e, $, message, CFG } from "./util.js";
import { S, db, notifier } from "./store.js";

export function vueRecherchees(cible) {
  const r = S.souhaits.slice().sort((a, b) => a.reference.localeCompare(b.reference, "fr", { numeric: true }));
  cible.innerHTML = `<article class="page-etroite">
    <h1>Cartes recherchées</h1>
    ${CFG.contact ? `<p>${e(CFG.contact)}</p>` : ""}
    ${r.length ? `<ul class="souhaits">${r.map((s) => `<li><b>${e(s.reference)}</b> <span>${e(s.nom || "")}</span> <small>${e(s.note || "")}</small>${S.admin ? ` <button class="lien" data-sup="${s.id}">Retirer</button>` : ""}</li>`).join("")}</ul>` : `<p>La liste est vide pour le moment.</p>`}
    ${S.admin ? `<form id="f-souhait" class="ligne-form"><label>Référence <input name="reference" required></label><label>Nom <input name="nom"></label><label>Note <input name="note"></label><button class="bouton primaire">Ajouter à la liste</button></form>` : ""}
  </article>`;
  $("#f-souhait")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    try { const [l] = await db.ajouter("souhaits", [d]); S.souhaits.push(l); vueRecherchees(cible); } catch (er) { message(er.message, "erreur"); }
  });
  cible.onclick = async (ev) => {
    const id = ev.target.dataset?.sup; if (!id) return;
    try { await db.supprimer("souhaits", +id); S.souhaits = S.souhaits.filter((s) => s.id !== +id); vueRecherchees(cible); } catch (er) { message(er.message, "erreur"); }
  };
}

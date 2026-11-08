import { e, $, $$, nb, CFG, position, indiceDe, message, reduireImage, telecharger, aujourdhui, jour, urlSure, codeColnect } from "./util.js";
import { S, db, notifier, carteParId, prochainIndice, indicesOccupes, seedVersLignes } from "./store.js";
import { visuel, faceGeneree } from "./face.js";
import { traduire, ouvrirFiche } from "./fiche.js";

const cheminSur = (s) => s.normalize("NFD").replace(/[^A-Za-z0-9_-]/g, "_");

export function vueConnexion(cible, apres) {
  cible.innerHTML = `<article class="page-etroite connexion">
    <h1>Connexion</h1>
    <p>Réservée au propriétaire de la collection.</p>
    ${S.demo ? `<p class="note">Démonstration : n'importe quelle adresse et n'importe quel mot de passe ouvrent l'atelier. Rien n'est enregistré.</p>` : ""}
    <form id="f-cx" class="pile-form">
      <label>Adresse e-mail<input name="email" type="email" autocomplete="username" required></label>
      <label>Mot de passe<input name="mdp" type="password" autocomplete="current-password" required></label>
      <button class="bouton primaire">Se connecter</button>
      <p class="erreur-texte" id="cx-err" role="alert"></p>
    </form>
  </article>`;
  $("#f-cx").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = new FormData(ev.target);
    try { await db.connexion(d.get("email"), d.get("mdp")); notifier(); const c = apres || "#/ajouter"; if (location.hash === c) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = c; }
    catch (er) { $("#cx-err").textContent = er.message; }
  });
}

const champs = (c = {}, avecExemplaire = true) => {
  const n = prochainIndice(), p = position(n);
  const dm = c.date_emission ? c.date_emission.slice(0, 7) : "";
  return `
  <div class="f-ligne">
    <label class="f-ref">Référence<input id="a-ref" name="reference" required autocomplete="off" value="${e(c.reference || "")}" placeholder="F998"></label>
    <label>Puce<input id="a-puce" name="puce" required list="l-puces" value="${e(c.puce || "")}" autocomplete="off"></label>
    <label class="f-u">Unités<input id="a-u" name="unites" type="number" min="0" list="l-unites" value="${c.unites ?? ""}"></label>
  </div>
  <div id="a-sugg" class="suggestions" hidden></div>
  <label>Nom<input id="a-nom" name="nom" required value="${e(c.nom || "")}"></label>
  <div class="f-ligne">
    <label>Émission<input name="date_emission" type="month" value="${dm}"></label>
    <label>Tirage<input name="tirage" type="number" min="0" step="1" value="${c.tirage ?? ""}"></label>
    <label>Cote (€)<input name="cote" type="number" min="0" step="0.05" value="${c.cote ?? ""}"></label>
  </div>
  <label>Série<input name="serie" list="l-series" value="${e(c.serie || "")}"></label>
  <label>Notes<textarea name="notes" rows="2">${e(c.notes || "")}</textarea></label>
  <div class="f-ligne f-images">
    <label class="depot">Recto<input type="file" name="f_recto" accept="image/*" capture="environment"></label>
    <label class="depot">Verso<input type="file" name="f_verso" accept="image/*" capture="environment"></label>
  </div>
  <label>Ou adresse d'une image<input name="image_recto" type="url" value="${e(c.image_recto?.startsWith("blob:") ? "" : c.image_recto || "")}" placeholder="https://…"></label>
  ${avecExemplaire ? `<fieldset class="f-ex"><legend>Exemplaire</legend>
    <div class="f-ligne">
      <label>État<select name="etat"><option value="U">Usagée</option><option value="L">Luxe</option><option value="">Non noté</option></select></label>
      <label>Quantité<input name="qte" type="number" min="1" value="1"></label>
      <label>Page<input name="page" type="number" min="1" value="${p.page}"></label>
      <label>Case<input name="case" type="number" min="1" max="${CFG.casesParPage}" value="${p.case}"></label>
    </div></fieldset>` : ""}
  <datalist id="l-puces">${S.puces.map((x) => `<option value="${e(x.code)}">`).join("")}</datalist>
  <datalist id="l-unites"><option value="50"><option value="120"><option value="5"><option value="25"></datalist>
  <datalist id="l-series">${[...new Set(S.cartes.map((x) => x.serie).filter(Boolean))].sort().map((x) => `<option value="${e(x)}">`).join("")}</datalist>`;
};

const lireForm = (f) => {
  const d = new FormData(f), v = (k) => String(d.get(k) ?? "").trim();
  const num = (k) => (v(k) === "" ? null : +v(k));
  return { reference: v("reference"), puce: v("puce"), unites: num("unites"), nom: v("nom"), date_emission: v("date_emission") ? v("date_emission") + "-01" : null, tirage: num("tirage"), cote: num("cote"), serie: v("serie") || null, notes: v("notes") || null, image_recto: urlSure(v("image_recto")) || null };
};
const trouver = (l) => S.cartes.find((c) => c.reference === l.reference && c.puce === l.puce && (c.unites ?? null) === l.unites);

async function poserImages(f, ligne) {
  const out = {};
  for (const [k, champ] of [["f_recto", "image_recto"], ["f_verso", "image_verso"]]) {
    const fic = f[k]?.files?.[0];
    if (fic) {
      const b = await reduireImage(fic);
      out[champ] = await db.envoyerImage(`cartes/${cheminSur(ligne.reference)}-${cheminSur(ligne.puce)}-${k.slice(2)}-${Date.now()}.webp`, b);
      out.image_source = "Photo personnelle";
    }
  }
  return out;
}

function apercu(f) {
  const z = $("#a-apercu"); if (!z) return;
  const l = lireForm(f);
  const ex = trouver(l);
  const c = { ...(ex || {}), ...l, an: l.date_emission ? +l.date_emission.slice(0, 4) : null, image_recto: l.image_recto || ex?.image_recto };
  const memes = S.cartes.filter((x) => x.reference === l.reference && x.n > 0);
  z.innerHTML = `<span class="objet grand">${l.reference || l.nom ? visuel(c) : `<span class="face vide">Aperçu</span>`}</span>
    ${ex ? `<p><b>Déjà ${ex.n} exemplaire${ex.n > 1 ? "s" : ""}.</b> Cet ajout en fera un de plus.</p><ul class="exemplaires">${ex.actifs.slice(0, 5).map((x) => { const p = position(x.indice); return `<li>Page ${p.page}, case ${p.case}</li>`; }).join("")}</ul>` : memes.length ? `<p>Cette référence existe avec une autre puce : ${memes.map((m) => `<b>${e(m.puce)}</b> (${m.unites ?? "?"} u)`).join(", ")}.</p>` : l.reference ? `<p>Nouvelle carte dans la collection.</p>` : `<p class="discret">Tapez une référence pour reprendre les informations connues.</p>`}`;
}

function remplir(f, c) {
  for (const [k, v] of Object.entries({ reference: c.reference, puce: c.puce, unites: c.unites, nom: c.nom, tirage: c.tirage, cote: c.cote, serie: c.serie, image_recto: c.image_url || c.image_recto })) if (f[k] && v != null) f[k].value = v;
  if (c.date_emission) f.date_emission.value = c.date_emission.slice(0, 7);
}

export function vueAjouter(cible, params) {
  const pre = params.get("type") ? carteParId(params.get("type")) : null;
  cible.innerHTML = `<div class="atelier-form">
    <form id="f-a" class="pile-form"><h1>Ajouter une carte</h1>${champs({}, true)}
      <button class="bouton primaire">Ajouter à la collection</button></form>
    <aside id="a-apercu" class="apercu"></aside>
  </div>`;
  const f = $("#f-a"), sug = $("#a-sugg");
  if (pre) remplir(f, pre);
  apercu(f);
  let jeton = 0;
  const proposer = async () => {
    const q = f.reference.value.trim();
    apercu(f);
    if (q.length < 2) { sug.hidden = true; return; }
    const t = ++jeton;
    const n = q.toLowerCase();
    const miens = S.cartes.filter((c) => c.reference.toLowerCase().startsWith(n)).slice(0, 8);
    let cat = [];
    try { cat = await db.chercherCatalogue(q); } catch { /* le catalogue est un confort, la saisie continue sans lui */ }
    if (t !== jeton) return;
    const connu = new Set(miens.map((c) => `${c.reference}|${c.puce}|${c.unites}`));
    cat = cat.filter((c) => !connu.has(`${c.reference}|${c.puce}|${c.unites}`));
    const tout = [...miens.map((c) => ({ o: c, src: `${c.n} en collection` })), ...cat.map((c) => ({ o: c, src: c.source || "Catalogue" }))];
    sug.hidden = !tout.length;
    sug.innerHTML = tout.map((x, i) => `<button type="button" data-s="${i}"><b>${e(x.o.reference)}</b> ${e(x.o.nom || "")} <small>${e(x.o.puce || "")}, ${x.o.unites ?? "?"} u</small> <small>${e(x.src)}</small></button>`).join("");
    sug.onclick = (ev) => { const b = ev.target.closest("[data-s]"); if (!b) return; remplir(f, tout[+b.dataset.s].o); sug.hidden = true; apercu(f); f.etat.focus(); };
  };
  f.reference.addEventListener("input", proposer);
  f.addEventListener("input", (ev) => { if (ev.target !== f.reference) apercu(f); });
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const b = $("button.primaire", f); b.disabled = true;
    try {
      const l = lireForm(f);
      const qte = Math.max(1, +f.qte.value || 1);
      let n = indiceDe(+f.page.value, +f.case.value);
      if (+f.case.value > CFG.casesParPage) throw new Error(`Une page compte ${CFG.casesParPage} cases.`);
      const occupes = indicesOccupes();
      if (occupes.has(n)) throw new Error(`La page ${f.page.value}, case ${f.case.value} est déjà occupée.`);
      const images = await poserImages(f, l);
      let c = trouver(l);
      const patch = { ...l, ...images };
      if (!patch.image_recto) delete patch.image_recto;
      if (c) {
        // Un champ laissé vide ne doit pas effacer ce qu'on sait déjà de la carte.
        for (const k of Object.keys(patch)) if (patch[k] == null) delete patch[k];
        await db.modifier("cartes", c.id, patch);
        Object.assign(c, patch);
      } else {
        const [nv] = await db.ajouter("cartes", [patch]);
        c = { ...patch, ...nv, exemplaires: [] };
        S.cartes.push(c);
      }
      if (!S.puces.some((p) => p.code === l.puce)) { await db.modifierPuce(l.puce, {}); S.puces.push({ code: l.puce }); }
      const lignes = [];
      for (let i = 0; i < qte; i++) {
        lignes.push({ carte_id: c.id, indice: n, etat: f.etat.value || null, date_ajout: aujourdhui() });
        occupes.add(n);
        while (occupes.has(n)) n++;
      }
      const crees = await db.ajouter("exemplaires", lignes);
      c.exemplaires.push(...crees);
      notifier();
      const p = position(crees[0].indice);
      message(`${l.reference} ajoutée, page ${p.page}, case ${p.case}.`, "ok", { label: "Voir", fn: () => ouvrirFiche(c.id) });
      const et = f.etat.value;
      f.reset(); f.etat.value = et;
      const s = position(prochainIndice()); f.page.value = s.page; f.case.value = s.case;
      apercu(f); f.reference.focus();
    } catch (er) { message(traduire(er), "erreur"); } finally { b.disabled = false; }
  });
}

export function vueModifier(cible, id) {
  const c = carteParId(id);
  if (!c) { cible.innerHTML = `<p class="page-etroite">Cette carte n'existe plus.</p>`; return; }
  cible.innerHTML = `<div class="atelier-form">
    <form id="f-m" class="pile-form"><h1>Modifier ${e(c.reference)}</h1>${champs(c, false)}
      <div class="rangee"><button class="bouton primaire">Enregistrer les modifications</button>
      <button type="button" class="bouton danger" id="m-sup">Supprimer la carte</button></div></form>
    <aside id="a-apercu" class="apercu"></aside></div>`;
  const f = $("#f-m"); apercu(f);
  f.addEventListener("input", () => apercu(f));
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const l = lireForm(f), im = await poserImages(f, l);
      const patch = { ...l, ...im };
      await db.modifier("cartes", c.id, patch); Object.assign(c, patch);
      notifier(); message("Carte enregistrée."); history.back();
    } catch (er) { message(traduire(er), "erreur"); }
  });
  $("#m-sup").onclick = async () => {
    if (!confirm(`Supprimer définitivement ${c.reference} et ses ${c.n} exemplaire(s) ?`)) return;
    try { await db.supprimer("cartes", c.id); S.cartes.splice(S.cartes.indexOf(c), 1); notifier(); message("Carte supprimée."); location.hash = "#/collection"; }
    catch (er) { message(traduire(er), "erreur"); }
  };
}

/* Atelier */
const parLots = async (liste, n, f) => { for (let i = 0; i < liste.length; i += n) await Promise.all(liste.slice(i, i + n).map(f)); };

function lireCsv(t) {
  const sep = (t.split("\n")[0].match(/;/g) || []).length >= (t.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const lignes = []; let l = [], v = "", q = false;
  t = t.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { v += '"'; i++; } else if (ch === '"') q = false; else v += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { l.push(v); v = ""; }
    else if (ch === "\n") { l.push(v.replace(/\r$/, "")); lignes.push(l); l = []; v = ""; }
    else v += ch;
  }
  if (v || l.length) { l.push(v); lignes.push(l); }
  return lignes;
}

export function ligneCatalogue(h, l) {
  const g = (...n) => { for (const x of n) { const i = h.indexOf(x); if (i >= 0 && l[i]?.trim()) return l[i].trim(); } return null; };
  const num = (s) => { if (!s) return null; const v = +s.replace(/\s/g, "").replace(",", "."); return Number.isFinite(v) ? v : null; };
  let d = g("date", "emission", "date_emission");
  if (d) { let m; if ((m = /^(\d{1,2})\/(\d{4})$/.exec(d))) d = `${m[2]}-${m[1].padStart(2, "0")}-01`; else if ((m = /^(\d{4})-(\d{2})/.exec(d))) d = `${m[1]}-${m[2]}-01`; else if ((m = /^(\d{4})$/.exec(d))) d = `${m[1]}-01-01`; else d = null; }
  return { reference: g("reference", "ref"), puce: g("puce"), unites: num(g("unites")), nom: g("nom", "designation"), date_emission: d, tirage: num(g("tirage")), cote: num(g("cote")), image_url: g("image", "image_url", "visuel"), source: g("source") || "Import CSV" };
}

export function vueAtelier(cible) {
  const sans = S.cartes.filter((c) => c.n > 0 && !c.image_recto);
  const avec = S.cartes.filter((c) => c.image_recto).length;
  const conflits = S.cartes.filter((c) => c.a_verifier && Object.keys(c.a_verifier).length);
  cible.innerHTML = `<div class="atelier">
    <nav class="atelier-nav" aria-label="Sections">${S.vide || S.demo ? `<a href="#imp">Import</a>` : ""}<a href="#vis">Visuels</a><a href="#ver">À vérifier (${conflits.length})</a><a href="#puc">Puces</a><a href="#cat">Catalogue</a><a href="#sau">Sauvegarde</a></nav>
    <h1>Atelier</h1>
    ${S.vide || S.demo ? `<section id="imp"><h2>Importer la collection</h2>
      <p>Charge les 959 cartes et 2 073 exemplaires repris de votre fichier Excel. À faire une seule fois, sur une base vide.</p>
      <button class="bouton primaire" id="t-import" ${S.demo ? "disabled" : ""}>Importer la collection</button> <span id="t-prog" class="discret" role="status"></span>
      ${S.demo ? `<p class="note">Disponible une fois Supabase branché.</p>` : ""}</section>` : ""}
    <section id="vis"><h2>Visuels</h2>
      <p>${nb(avec)} cartes ont une photo, ${nb(sans.length)} n'en ont pas encore.</p>
      <label class="depot grand-depot">Déposez vos images ici, nommées par référence : F998.jpg, F998_verso.jpg
        <input type="file" id="t-images" accept="image/*" multiple></label>
      <p id="t-img-etat" class="discret" role="status"></p>
      <div class="rangee"><button class="bouton" id="t-reprendre">Reprendre les visuels du catalogue</button></div>
      <div class="file-visuels" id="t-file"></div>
      <div class="rangee"><button class="lien" id="t-plus">Afficher les suivantes</button></div>
    </section>
    <section id="ver"><h2>À vérifier</h2>
      <p>Ces lignes de l'Excel décrivaient la même carte avec des valeurs différentes. La valeur la plus fréquente est appliquée, à vous de confirmer.</p>
      <div id="t-conflits">${conflits.map(blocConflit).join("") || "<p>Rien à vérifier.</p>"}</div>
    </section>
    <section id="puc"><h2>Photos des puces</h2>
      <p>Les pictogrammes sont des repères génériques. Une photo ajoutée ici les remplace sur toutes les fiches de cette puce.</p>
      <div class="puces-grille">${S.puces.map((p) => `<label class="depot-puce">${urlSure(p.image_url) ? `<img src="${e(urlSure(p.image_url))}" alt="">` : ""}<span>${e(p.code)}</span><input type="file" accept="image/*" data-puce="${e(p.code)}"></label>`).join("")}</div>
    </section>
    <section id="cat"><h2>Catalogue</h2>
      <p>${nb(S.tailleCatalogue)} références servent à préremplir le formulaire d'ajout, en plus de vos propres cartes. Colonnes reconnues : reference, nom, unites, puce, date, tirage, cote, image.</p>
      <label class="bouton fichier">Importer un CSV<input type="file" id="t-cat" accept=".csv,text/csv"></label> <span id="t-cat-etat" class="discret" role="status"></span>
    </section>
    <section id="sau"><h2>Sauvegarde</h2>
      <div class="rangee"><button class="bouton" id="t-sauve">Télécharger une sauvegarde complète (JSON)</button>
      ${S.vide ? `<label class="bouton fichier">Restaurer une sauvegarde<input type="file" id="t-restaure" accept=".json"></label>` : ""}</div>
      <p class="discret">La restauration n'est proposée que sur une base vide, pour ne rien écraser.</p>
    </section></div>`;

  let vus = 0;
  const lien = (c) => { const g = encodeURIComponent(`site:colnect.com "Pho:${codeColnect(c.reference)}"`); return `https://www.google.com/search?tbm=isch&q=${g}`; };
  const plus = () => {
    const lot = sans.filter((c) => !c.image_recto).slice(vus, vus + 24); vus += lot.length;
    $("#t-file").insertAdjacentHTML("beforeend", lot.map((c) => `<div class="fv" data-c="${c.id}"><span class="objet">${faceGeneree(c)}</span><b>${e(c.reference)}</b><span class="nom">${e(c.nom)}</span>
      <label class="lien">Photo<input type="file" accept="image/*" capture="environment" data-une="${c.id}" hidden></label> <a class="lien" href="${lien(c)}" target="_blank" rel="noopener">Chercher</a></div>`).join(""));
    $("#t-plus").hidden = vus >= sans.length;
  };
  plus();
  $("#t-plus").onclick = plus;

  const racine = $(".atelier", cible);
  racine.addEventListener("change", async (ev) => {
    const t = ev.target;
    try {
      if (t.dataset.une) {
        const c = carteParId(t.dataset.une), f = t.files[0]; if (!f) return;
        const url = await db.envoyerImage(`cartes/${cheminSur(c.reference)}-${cheminSur(c.puce)}-recto-${Date.now()}.webp`, await reduireImage(f));
        const patch = { image_recto: url, image_source: "Photo personnelle" };
        await db.modifier("cartes", c.id, patch); Object.assign(c, patch);
        t.closest(".fv").remove(); indexOk();
      }
      if (t.dataset.puce) {
        const f = t.files[0]; if (!f) return;
        const url = await db.envoyerImage(`puces/${cheminSur(t.dataset.puce)}-${Date.now()}.webp`, await reduireImage(f, 400));
        await db.modifierPuce(t.dataset.puce, { image_url: url });
        const p = S.puces.find((x) => x.code === t.dataset.puce); p.image_url = url; vueAtelier(cible);
      }
      if (t.id === "t-images") await deposer([...t.files]);
      if (t.id === "t-cat") {
        const r = lireCsv(await t.files[0].text());
        const h = r[0].map((x) => x.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
        const lignes = r.slice(1).map((l) => ligneCatalogue(h, l)).filter((l) => l.reference);
        if (!lignes.length) throw new Error("Aucune ligne reconnue : vérifiez la colonne « reference ».");
        await db.importerCatalogue(lignes, (a, b) => { $("#t-cat-etat").textContent = `${a} sur ${b}`; });
        message(`${nb(lignes.length)} références importées dans le catalogue.`); vueAtelier(cible);
      }
      if (t.id === "t-restaure") {
        const s = JSON.parse(await t.files[0].text());
        await db.importerCollection(seedVersLignes(s), s.puces, (m) => message(m));
        await db.charger(); notifier(); message("Sauvegarde restaurée.");
      }
    } catch (er) { message(traduire(er), "erreur"); }
  });
  const indexOk = () => { notifier(); };

  async function deposer(fics) {
    const etat = $("#t-img-etat"); let ok = 0; const rates = [];
    await parLots(fics, 3, async (f) => {
      const m = /^([A-Za-z-]*\d+(?:bis)?[A-Za-z]*?)(?:[ _-]?(verso|recto))?\.[a-z0-9]+$/i.exec(f.name);
      const ref = m?.[1];
      let cibles = S.cartes.filter((c) => c.reference === ref);
      if (!cibles.length && ref) cibles = S.cartes.filter((c) => c.reference.toLowerCase() === ref.toLowerCase());
      if (!cibles.length) { rates.push(f.name); return; }
      const face = /verso/i.test(m[2] || "") ? "image_verso" : "image_recto";
      try {
        const url = await db.envoyerImage(`cartes/${cheminSur(ref)}-${face}-${Date.now()}.webp`, await reduireImage(f));
        for (const c of cibles) { const p = { [face]: url, image_source: "Photo personnelle" }; await db.modifier("cartes", c.id, p); Object.assign(c, p); }
      } catch { rates.push(f.name); return; }
      ok++; etat.textContent = `${ok} image${ok > 1 ? "s" : ""} rattachée${ok > 1 ? "s" : ""}…`;
    });
    notifier();
    vueAtelier(cible);
    message(`${ok} image${ok > 1 ? "s" : ""} rattachée${ok > 1 ? "s" : ""}.${rates.length ? ` Non rattachées : ${rates.slice(0, 5).join(", ")}${rates.length > 5 ? "…" : ""}` : ""}`, rates.length ? "erreur" : "ok");
  }

  racine.addEventListener("click", async (ev) => {
    const t = ev.target.closest("button"); if (!t) return;
    try {
      if (t.id === "t-import") {
        t.disabled = true;
        const seed = await (await fetch("data/seed.json")).json();
        await db.importerCollection(seedVersLignes(seed), seed.puces, (m) => { $("#t-prog").textContent = m; });
        await db.charger(); notifier(); message("Collection importée."); location.hash = "#/collection";
      }
      if (t.id === "t-reprendre") {
        const manquants = S.cartes.filter((c) => !c.image_recto);
        const cat = (await db.catalogueDes([...new Set(manquants.map((c) => c.reference))])).filter((x) => x.image_url);
        let n = 0;
        await parLots(manquants, 4, async (c) => {
          const m = cat.find((x) => x.reference === c.reference && x.puce === c.puce) || cat.find((x) => x.reference === c.reference && !x.puce) || cat.find((x) => x.reference === c.reference);
          if (!m) return;
          const p = { image_recto: m.image_url, image_source: m.source };
          await db.modifier("cartes", c.id, p); Object.assign(c, p); n++;
        });
        notifier(); message(`${n} visuel${n > 1 ? "s" : ""} repris du catalogue.`); vueAtelier(cible);
      }
      if (t.id === "t-sauve") {
        const sortie = { date: new Date().toISOString(), puces: S.puces.map((p) => p.code), cartes: S.cartes.map((c) => ({ reference: c.reference, puce: c.puce, unites: c.unites, nom: c.nom, date: c.date_emission, tirage: c.tirage, cote: c.cote, serie: c.serie, a_verifier: c.a_verifier, image_recto: c.image_recto, image_verso: c.image_verso, image_source: c.image_source, notes: c.notes, ex: c.exemplaires.map((x) => [x.indice, x.etat, x.date_ajout, x.sorti_le, x.sortie_note]) })), souhaits: S.souhaits };
        telecharger(`telecartes-sauvegarde-${aujourdhui()}.json`, JSON.stringify(sortie), "application/json");
      }
      if (t.dataset.choisir) {
        const c = carteParId(t.dataset.carte), ch = t.dataset.champ;
        let v = JSON.parse(t.dataset.choisir);
        const col = ch === "date" ? "date_emission" : ch;
        const reste = { ...c.a_verifier }; delete reste[ch];
        const patch = { [col]: v, a_verifier: Object.keys(reste).length ? reste : null };
        await db.modifier("cartes", c.id, patch); Object.assign(c, patch);
        notifier(); $(`[data-conflit="${c.id}-${ch}"]`).remove();
        const nbr = S.cartes.filter((x) => x.a_verifier).length;
        $(".atelier-nav a[href='#ver']").textContent = `À vérifier (${nbr})`;
      }
    } catch (er) { message(traduire(er), "erreur"); }
  });
  // Les ancres internes ne doivent pas être prises pour des routes.
  $(".atelier-nav", cible).onclick = (ev) => { const a = ev.target.closest("a"); if (a) { ev.preventDefault(); $(a.getAttribute("href"))?.scrollIntoView(); } };
}

const NOM_CH = { nom: "Nom", tirage: "Tirage", cote: "Cote", date: "Émission" };
function blocConflit(c) {
  const col = (ch) => (ch === "date" ? c.date_emission : c[ch]);
  return Object.entries(c.a_verifier).map(([ch, vals]) => `<div class="conflit" data-conflit="${c.id}-${ch}">
    <b>${e(c.reference)}</b> <span class="discret">${e(c.puce)}, ${NOM_CH[ch]}</span>
    <span class="rangee">${vals.map((v) => `<button class="touche${String(v) === String(col(ch)) ? " on" : ""}" data-carte="${c.id}" data-champ="${ch}" data-choisir='${e(JSON.stringify(v))}'>${typeof v === "number" ? nb(v) : e(v)}</button>`).join("")}</span>
  </div>`).join("");
}

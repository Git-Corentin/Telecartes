import { CFG, norm, cmpRef, position, hash } from "./util.js";

export const S = { cartes: [], souhaits: [], puces: [], user: null, admin: false, demo: !CFG.supabaseUrl, vide: false, tailleCatalogue: 0 };
const ecoute = new Set();
export const surChangement = (f) => ecoute.add(f);
export const notifier = () => { indexer(); ecoute.forEach((f) => f()); };

export const annee = (c) => (c.date_emission ? +c.date_emission.slice(0, 4) : null);

export function famillePuce(p) {
  const m = /^(SC|SO|GEM|OB|OR|LG|BULL|SA|TAAF)/i.exec(p || "");
  const k = m ? m[1].toUpperCase() : "";
  return { SC: "Schlumberger", SO: "Solaic", GEM: "Gemplus", OB: "Oberthur" }[k] || "Autres";
}

export function indexer() {
  for (const c of S.cartes) {
    c.actifs = (c.exemplaires || []).filter((x) => !x.sorti_le).sort((a, b) => a.indice - b.indice);
    c.n = c.actifs.length;
    c.an = annee(c);
    c.fam = famillePuce(c.puce);
    c.texte = norm([c.reference, c.nom, c.serie, c.puce, c.an, c.unites].join(" "));
    c.dernierAjout = c.actifs.reduce((m, x) => (x.date_ajout > m ? x.date_ajout : m), "");
  }
  S.cartes.sort((a, b) => cmpRef(a.reference, b.reference) || (a.puce < b.puce ? -1 : 1));
}

export const possedees = () => S.cartes.filter((c) => c.n > 0);
export const carteParId = (id) => S.cartes.find((c) => c.id === +id);

export function indicesOccupes() {
  const u = new Set();
  for (const c of S.cartes) for (const x of c.actifs) u.add(x.indice);
  return u;
}
export function prochainIndice() {
  const u = indicesOccupes();
  let i = 1;
  while (u.has(i)) i++;
  return i;
}

export function plan() {
  const m = new Map();
  for (const c of S.cartes) for (const x of c.actifs) m.set(x.indice, { carte: c, ex: x });
  return m;
}

export function bilan() {
  const cartes = possedees();
  const ex = cartes.flatMap((c) => c.actifs.map((x) => ({ c, x })));
  const valeur = ex.reduce((t, { c }) => t + (c.cote == null ? CFG.coteParDefaut : +c.cote), 0);
  const pages = ex.length ? Math.max(...ex.map(({ x }) => position(x.indice).page)) : 0;
  return { exemplaires: ex.length, differentes: cartes.length, doublons: ex.length - cartes.length, valeur: Math.round(valeur * 100) / 100, pages };
}

/* Accès aux données : Supabase, ou mémoire locale en démonstration. */
let sb = null;
if (!S.demo) sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

function verifier({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function toutLire(table, colonnes = "*") {
  const pas = 1000; let de = 0; const out = [];
  for (;;) {
    const lot = verifier(await sb.from(table).select(colonnes).order("id", { ascending: true }).range(de, de + pas - 1));
    out.push(...lot);
    if (lot.length < pas) return out;
    de += pas;
  }
}

function assembler(cartes, ex) {
  const par = new Map(cartes.map((c) => [c.id, (c.exemplaires = [], c)]));
  for (const x of ex) par.get(x.carte_id)?.exemplaires.push(x);
  return cartes;
}

let idDemo = 1e6;
const demoCatalogue = [];

export function seedVersLignes(seed) {
  return seed.cartes.map((c) => ({
    ligne: { reference: c.reference, puce: c.puce, unites: c.unites, nom: c.nom, date_emission: c.date, tirage: c.tirage, cote: c.cote, serie: c.serie, a_verifier: c.a_verifier || null, image_recto: c.image_recto ?? null, image_verso: c.image_verso ?? null, image_source: c.image_source ?? null, notes: c.notes ?? null },
    ex: c.ex.map(([indice, etat, date_ajout, sorti_le, sortie_note]) => ({ indice, etat, date_ajout, sorti_le: sorti_le ?? null, sortie_note: sortie_note ?? null })),
  }));
}

export const db = {
  async charger() {
    if (S.demo) {
      const seed = await (await fetch("data/seed.json")).json();
      let id = 1, idx = 1;
      S.cartes = seedVersLignes(seed).map(({ ligne, ex }) => { const cid = id++; return { id: cid, ...ligne, exemplaires: ex.map((x) => ({ id: idx++, carte_id: cid, ...x })) }; });
      S.puces = seed.puces.map((code) => ({ code }));
      S.souhaits = [];
      S.vide = false;
    } else {
      const [cartes, ex, souhaits, puces] = await Promise.all([toutLire("cartes"), toutLire("exemplaires"), toutLire("souhaits"), verifier(await sb.from("puces").select("*"))]);
      S.cartes = assembler(cartes, ex);
      S.souhaits = souhaits; S.puces = puces;
      S.vide = cartes.length === 0;
      const { count } = await sb.from("catalogue").select("id", { count: "exact", head: true });
      S.tailleCatalogue = count || 0;
    }
    indexer();
  },
  async session() {
    if (S.demo) return;
    const { data } = await sb.auth.getSession();
    await this._appliquer(data.session);
    sb.auth.onAuthStateChange((_ev, s) => { setTimeout(async () => { const avant = S.admin; await this._appliquer(s); if (avant !== S.admin) notifier(); }, 0); });
  },
  async _appliquer(s) {
    S.user = s?.user || null;
    S.admin = S.user ? !!(await sb.rpc("is_admin")).data : false;
  },
  async connexion(email, mdp) {
    if (S.demo) { S.user = { email }; S.admin = true; return; }
    const { data, error } = await sb.auth.signInWithPassword({ email, password: mdp });
    if (error) throw new Error("Adresse ou mot de passe incorrect.");
    await this._appliquer(data.session);
    if (!S.admin) throw new Error("Ce compte n'a pas le droit de modifier la collection. Ajoutez-le à la table admins.");
  },
  async deconnexion() {
    if (S.demo) { S.user = null; S.admin = false; return; }
    await sb.auth.signOut(); S.user = null; S.admin = false;
  },
  async ajouter(table, lignes) {
    if (S.demo) return lignes.map((l) => ({ id: idDemo++, ...l }));
    return verifier(await sb.from(table).insert(lignes).select());
  },
  async modifier(table, id, patch) {
    if (S.demo) return { id, ...patch };
    return verifier(await sb.from(table).update(patch).eq("id", id).select().single());
  },
  async supprimer(table, id) {
    if (S.demo) return;
    verifier(await sb.from(table).delete().eq("id", id));
  },
  async modifierPuce(code, patch) {
    if (!S.demo) verifier(await sb.from("puces").upsert({ code, ...patch }));
  },
  async envoyerImage(chemin, blob) {
    if (S.demo) return URL.createObjectURL(blob);
    verifier(await sb.storage.from("visuels").upload(chemin, blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" }));
    return sb.storage.from("visuels").getPublicUrl(chemin).data.publicUrl;
  },
  async chercherCatalogue(q) {
    const t = q.replace(/[,()%*]/g, " ").trim();
    if (!t) return [];
    if (S.demo) { const n = norm(t); return demoCatalogue.filter((c) => norm(c.reference).startsWith(n) || norm(c.nom).includes(n)).slice(0, 12); }
    return verifier(await sb.from("catalogue").select("*").or(`reference.ilike.${t}%,nom.ilike.%${t}%`).order("reference").limit(12));
  },
  async catalogueDes(refs) {
    if (S.demo) return demoCatalogue.filter((c) => refs.includes(c.reference));
    const out = [];
    for (let i = 0; i < refs.length; i += 150) out.push(...verifier(await sb.from("catalogue").select("*").in("reference", refs.slice(i, i + 150))));
    return out;
  },
  async importerCatalogue(lignes, progres) {
    if (S.demo) { demoCatalogue.push(...lignes); S.tailleCatalogue = demoCatalogue.length; return; }
    for (let i = 0; i < lignes.length; i += 500) {
      verifier(await sb.from("catalogue").upsert(lignes.slice(i, i + 500), { onConflict: "reference,puce,unites,source" }));
      progres?.(Math.min(i + 500, lignes.length), lignes.length);
    }
    const { count } = await sb.from("catalogue").select("id", { count: "exact", head: true });
    S.tailleCatalogue = count || 0;
  },
  async importerCollection(items, puces, progres) {
    if (S.demo) throw new Error("L'import s'utilise une fois Supabase branché.");
    verifier(await sb.from("puces").upsert(puces.map((code) => ({ code })), { ignoreDuplicates: true }));
    const cle = (o) => [o.reference, o.puce, o.unites].join("|");
    const par = new Map(items.map((i) => [cle(i.ligne), i]));
    const ex = [];
    for (let i = 0; i < items.length; i += 200) {
      const lot = verifier(await sb.from("cartes").insert(items.slice(i, i + 200).map((x) => x.ligne)).select("id,reference,puce,unites"));
      for (const c of lot) for (const x of par.get(cle(c)).ex) ex.push({ ...x, carte_id: c.id });
      progres?.(`Cartes : ${Math.min(i + 200, items.length)} sur ${items.length}`);
    }
    for (let i = 0; i < ex.length; i += 500) {
      verifier(await sb.from("exemplaires").insert(ex.slice(i, i + 500)));
      progres?.(`Exemplaires : ${Math.min(i + 500, ex.length)} sur ${ex.length}`);
    }
  },
};

export const hueDe = (c) => hash(c.reference);

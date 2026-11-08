// Réglages du site. Ce fichier est public : la clé « anon » de Supabase est faite pour ça.
// Tant que supabaseUrl est vide, le site tourne en démonstration à partir de data/seed.json.
window.TELECARTES = {
  supabaseUrl: "https://tmbqsryloqfmimcgmbkn.supabase.co",
  supabaseAnonKey: "sb_publishable_XzO_gCDghKB1UdUxkudbzQ_yeUvmDHX",
  titre: "Télécartes",
  sousTitre: "Ma collection française",
  casesParPage: 25,
  // Dans l'Excel, une carte sans cote comptait pour 0,10 € dans la valeur totale.
  coteParDefaut: 0.1,
  // Affiché sur le PDF des doublons et la page Doublons. Exemple : "Annonce leboncoin : https://…"
  contact: "",
};

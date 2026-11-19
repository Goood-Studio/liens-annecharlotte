// Le tableau de bord de liens.annecharlotte.be/stats/ : lire les chiffres,
// créer un lien (un ID unique par contenu, UTM ajoutées toutes seules),
// ajouter une page d'arrivée. Protégé par la clé CLE_TABLEAU (secret
// Supabase), que seule Anne-Charlotte a dans son favori.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const CLE = Deno.env.get("CLE_TABLEAU") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

// Même liste que dans /stats/. utm_source = la clé, utm_medium = medium.
const PLATEFORMES: Record<string, { nom: string; medium: string }> = {
  youtube: { nom: "YouTube", medium: "video" },
  instagram: { nom: "Instagram", medium: "social" },
  tiktok: { nom: "TikTok", medium: "video" },
  linkedin: { nom: "LinkedIn", medium: "social" },
  facebook: { nom: "Facebook", medium: "social" },
  newsletter: { nom: "Newsletter", medium: "email" },
  whatsapp: { nom: "WhatsApp", medium: "messaging" },
  circle: { nom: "Circle Nutriciens", medium: "community" },
  papier: { nom: "Papier (QR code)", medium: "print" },
  autre: { nom: "Autre", medium: "referral" },
};

// Chemins déjà pris par le mini-site lui-même.
const RESERVES = new Set(["stats", "tableau", "index", "404", "assets", "cname", "robots", "favicon"]);
// Pas de l, o, 0, 1 : un ID qui se recopie sans se tromper.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function memeCle(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function versSlug(s: string, max: number) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
}

function adresseHttps(brute: string): string | null {
  let a = brute.trim();
  if (!/^https?:\/\//i.test(a)) a = "https://" + a;
  try {
    const u = new URL(a);
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

function idAuHasard(n = 5) {
  const octets = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join("");
}

async function creerPage(nomBrut: unknown, adresseBrute: unknown) {
  const nom = String(nomBrut ?? "").trim().slice(0, 80);
  const adresse = adresseHttps(String(adresseBrute ?? ""));
  if (!nom) return { erreur: "Donne un nom à la nouvelle page (par ex. « Guide ventre gonflé »)." };
  if (!adresse) return { erreur: "L'adresse de la nouvelle page n'est pas valide." };
  const base = versSlug(nom, 30) || "page";
  for (let i = 1; i <= 20; i++) {
    const id = i === 1 ? base : `${base.slice(0, 27)}-${i}`;
    if (RESERVES.has(id)) continue;
    const { data, error } = await supabase.from("destinations").insert({ id, nom, adresse }).select().single();
    if (!error) return { page: data };
    if (error.code !== "23505") return { erreur: error.message };
  }
  return { erreur: "Impossible de trouver un nom libre pour cette page." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reponse({ erreur: "POST attendu" }, 405);

  let corps: Record<string, unknown> = {};
  try { corps = await req.json(); } catch { return reponse({ erreur: "JSON attendu" }, 400); }
  if (!memeCle(String(corps.cle ?? ""), CLE)) return reponse({ erreur: "clé incorrecte" }, 401);

  const action = String(corps.action ?? "stats");

  if (action === "stats") {
    const { data, error } = await supabase.rpc("stats_liens");
    if (error) return reponse({ erreur: error.message }, 500);
    return reponse({ liens: data.liens, destinations: data.destinations, maintenant: new Date().toISOString() });
  }

  if (action === "page") {
    const r = await creerPage(corps.nom, corps.adresse);
    if (r.erreur) return reponse({ erreur: r.erreur }, 400);
    return reponse({ ok: true, page: r.page });
  }

  if (action === "creer" && corps.plateforme !== undefined) {
    // Le lien d'un contenu : page/id, UTM ajoutées à l'adresse de la page.
    const plateforme = String(corps.plateforme);
    if (!PLATEFORMES[plateforme]) return reponse({ erreur: "Choisis une plateforme." }, 400);
    const contenu = String(corps.contenu ?? "").trim().slice(0, 160) || null;

    let page: { id: string; nom: string; adresse: string } | null = null;
    if (corps.nouvelle_page && typeof corps.nouvelle_page === "object") {
      const np = corps.nouvelle_page as Record<string, unknown>;
      const r = await creerPage(np.nom, np.adresse);
      if (r.erreur) return reponse({ erreur: r.erreur }, 400);
      page = r.page;
    } else {
      const { data } = await supabase.from("destinations").select("id, nom, adresse")
        .eq("id", String(corps.destination_id ?? "")).maybeSingle();
      page = data;
    }
    if (!page) return reponse({ erreur: "Choisis où mène le lien." }, 400);

    for (let essai = 0; essai < 6; essai++) {
      const id = idAuHasard();
      const slug = `${page.id}/${id}`;
      const u = new URL(page.adresse);
      u.searchParams.set("utm_source", plateforme);
      u.searchParams.set("utm_medium", PLATEFORMES[plateforme].medium);
      u.searchParams.set("utm_campaign", (contenu && versSlug(contenu, 80)) || page.id);
      u.searchParams.set("utm_content", id);
      const nom = `${PLATEFORMES[plateforme].nom} · ${contenu ?? "lien général"}`.slice(0, 120);
      const { error } = await supabase.from("liens").insert({
        slug, nom, destination: u.toString(), destination_id: page.id, plateforme, contenu,
      });
      if (!error) return reponse({ ok: true, slug, destination: u.toString(), page });
      if (error.code !== "23505") return reponse({ erreur: error.message }, 500);
    }
    return reponse({ erreur: "Réessaie, l'ID tiré au sort était déjà pris." }, 409);
  }

  if (action === "creer") {
    // Lien à adresse choisie (ex. liens.annecharlotte.be/bingo), sans plateforme.
    const slug = String(corps.slug ?? "").trim().toLowerCase();
    const nom = String(corps.nom ?? "").trim();
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug))
      return reponse({ erreur: "La fin du lien : lettres minuscules, chiffres et tirets, sans accent." }, 400);
    if (RESERVES.has(slug)) return reponse({ erreur: `« ${slug} » est déjà pris par l'outil, choisis-en un autre.` }, 400);
    if (!nom) return reponse({ erreur: "Donne un nom au lien." }, 400);
    const destination = adresseHttps(String(corps.destination ?? ""));
    if (!destination) return reponse({ erreur: "L'adresse de destination n'est pas valide." }, 400);
    const { error } = await supabase.from("liens").insert({ slug, nom, destination });
    if (error?.code === "23505") return reponse({ erreur: `Le lien « ${slug} » existe déjà.` }, 409);
    if (error) return reponse({ erreur: error.message }, 500);
    return reponse({ ok: true, slug, destination });
  }

  if (action === "activer") {
    const slug = String(corps.slug ?? "");
    const { error } = await supabase.from("liens").update({ actif: Boolean(corps.actif) }).eq("slug", slug);
    if (error) return reponse({ erreur: error.message }, 500);
    return reponse({ ok: true });
  }

  return reponse({ erreur: "action inconnue" }, 400);
});

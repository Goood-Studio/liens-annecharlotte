// Le tableau de bord de liens.annecharlotte.be/stats/ : lire les chiffres,
// créer un lien, mettre un lien en pause. Protégé par la clé CLE_TABLEAU
// (secret Supabase), que seule Anne-Charlotte a dans son favori.
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

// Chemins déjà pris par le mini-site lui-même.
const RESERVES = new Set(["stats", "tableau", "index", "404", "assets", "cname", "robots", "favicon"]);

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
    return reponse({ liens: data, maintenant: new Date().toISOString() });
  }

  if (action === "creer") {
    const slug = String(corps.slug ?? "").trim().toLowerCase();
    const nom = String(corps.nom ?? "").trim();
    let destination = String(corps.destination ?? "").trim();
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug))
      return reponse({ erreur: "La fin du lien : lettres minuscules, chiffres et tirets, sans accent." }, 400);
    if (RESERVES.has(slug)) return reponse({ erreur: `« ${slug} » est déjà pris par l'outil, choisis-en un autre.` }, 400);
    if (!nom) return reponse({ erreur: "Donne un nom au lien (par ex. « YouTube plans alimentaires »)." }, 400);
    if (!/^https?:\/\//i.test(destination)) destination = "https://" + destination;
    try {
      const u = new URL(destination);
      if (u.protocol !== "https:") u.protocol = "https:";
      destination = u.toString();
    } catch {
      return reponse({ erreur: "L'adresse de destination n'est pas valide." }, 400);
    }
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

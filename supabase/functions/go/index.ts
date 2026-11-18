// Compte un clic (ou un téléchargement) et renvoie la destination du lien.
// Appelée sans clé par les pages de liens.annecharlotte.be et par la page
// /bingo/ du site. Ne garde ni IP ni identifiant : seulement d'où vient le
// clic, le type d'appareil et le pays déduit du fuseau horaire.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

// Robots et aperçus de liens (WhatsApp, Slack…) : jamais comptés.
const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|telegram|discord|curl|wget|python|headless|lighthouse/i;

// L'appli dans laquelle le lien a été ouvert : plus fiable que le référent.
const APPLIS: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/LinkedInApp/i, "LinkedIn"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/Snapchat/i, "Snapchat"],
  [/Pinterest/i, "Pinterest"],
];

const SITES: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/, "Facebook"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X"],
  [/(^|\.)pinterest\./, "Pinterest"],
  [/(^|\.)google\./, "Google"],
  [/(^|\.)(bing\.com|duckduckgo\.com|ecosia\.org|qwant\.com)$/, "Autre moteur de recherche"],
  [/(^|\.)annecharlotte\.be$/, "Ton site"],
  [/(^|\.)(nutriciens\.com|circle\.so)$/, "Nutriciens"],
  [/mail\.|outlook\.|proton\.me$/, "E-mail"],
];

function source(ua: string, referent: string): string {
  for (const [re, nom] of APPLIS) if (re.test(ua)) return nom;
  if (!referent) return "Direct ou appli";
  try {
    const hote = new URL(referent).hostname.replace(/^www\./, "");
    for (const [re, nom] of SITES) if (re.test(hote)) return nom;
    return hote.slice(0, 60);
  } catch {
    return "Direct ou appli";
  }
}

function appareil(ua: string): string {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "Tablette";
  if (/Mobi|iPhone|Android/i.test(ua)) return "Téléphone";
  if (!ua) return "Inconnu";
  return "Ordinateur";
}

// Le fuseau horaire du téléphone dit le pays sans rien demander.
const FUSEAUX: Record<string, string> = {
  "Europe/Brussels": "Belgique", "Europe/Paris": "France", "Europe/Luxembourg": "Luxembourg",
  "Europe/Zurich": "Suisse", "Europe/Monaco": "Monaco", "Europe/Amsterdam": "Pays-Bas",
  "Europe/Berlin": "Allemagne", "Europe/London": "Royaume-Uni", "Europe/Madrid": "Espagne",
  "Atlantic/Canary": "Espagne", "Europe/Lisbon": "Portugal", "Europe/Rome": "Italie",
  "America/Montreal": "Canada", "America/Toronto": "Canada", "America/Moncton": "Canada",
  "Africa/Casablanca": "Maroc", "Africa/Algiers": "Algérie", "Africa/Tunis": "Tunisie",
  "Africa/Dakar": "Sénégal", "Africa/Abidjan": "Côte d'Ivoire", "Africa/Kinshasa": "RD Congo",
  "Africa/Lubumbashi": "RD Congo", "Indian/Reunion": "La Réunion", "America/Martinique": "Martinique",
  "America/Guadeloupe": "Guadeloupe", "Pacific/Tahiti": "Polynésie",
};

function pays(fuseau: string): string {
  if (!fuseau) return "Inconnu";
  return FUSEAUX[fuseau] ?? `Autre (${fuseau.split("/").pop()?.replace(/_/g, " ").slice(0, 30)})`;
}

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const params: Record<string, string> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === "POST") {
    // sendBeacon envoie du texte brut : on accepte un JSON dans le corps.
    try {
      const corps = await req.text();
      if (corps) Object.assign(params, JSON.parse(corps));
    } catch { /* corps ignoré */ }
  }

  const slug = String(params.l ?? "").toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) return reponse({ erreur: "lien inconnu" }, 404);

  const { data: lien, error } = await supabase
    .from("liens").select("destination, actif").eq("slug", slug).maybeSingle();
  if (error) return reponse({ erreur: "base indisponible" }, 503);
  if (!lien || !lien.actif) return reponse({ erreur: "lien inconnu" }, 404);

  const ua = req.headers.get("user-agent") ?? "";
  if (!ROBOTS.test(ua)) {
    await supabase.from("clics").insert({
      slug,
      evenement: params.e === "telechargement" ? "telechargement" : "clic",
      source: source(ua, String(params.r ?? "").slice(0, 500)),
      appareil: appareil(ua),
      pays: pays(String(params.tz ?? "").slice(0, 60)),
    });
  }

  return reponse({ destination: lien.destination });
});

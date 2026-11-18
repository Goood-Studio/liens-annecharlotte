// Construit _site/ pour GitHub Pages (liens.annecharlotte.be) :
// - une page par lien actif : redirection immédiate + clic compté ;
// - 404.html : redirige les liens créés depuis le tableau avant la
//   publication de la nuit (et dit poliment qu'un lien n'existe pas) ;
// - /stats/ : le tableau de bord.
// La liste des liens vient de Supabase (fonction tableau, clé CLE_TABLEAU).
// Si Supabase ne répond pas, le build échoue : la version en ligne reste.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const F = 'https://bgenoxwpwhqvsqdupnub.supabase.co/functions/v1/tableau';
const SORTIE = '_site';
const CLE = process.env.CLE_TABLEAU;
if (!CLE) throw new Error('CLE_TABLEAU manquante (secret GitHub ou variable locale).');

const r = await fetch(F, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ cle: CLE, action: 'stats' }),
});
if (!r.ok) throw new Error(`Supabase a répondu ${r.status} : build arrêté.`);
const { liens } = await r.json();

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Dans un <script>, on évite qu'une adresse ferme la balise.
const js = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

// L'aperçu (WhatsApp, Messenger…) reprend celui de la page de destination.
async function apercu(destination) {
  try {
    const page = await fetch(destination, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'liens-annecharlotte-build' } });
    const html = await page.text();
    const meta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1] : '';
    };
    const titre = meta('og:title') || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '');
    const desc = meta('og:description') || meta('description');
    let image = meta('og:image');
    if (image) image = new URL(image, destination).toString();
    return { titre, desc, image };
  } catch {
    return { titre: '', desc: '', image: '' };
  }
}

rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE);
cpSync('site/static', SORTIE, { recursive: true });

const gabarit = readFileSync('site/redirection.html', 'utf-8');
let n = 0;
for (const lien of liens.filter((l) => l.actif)) {
  const a = await apercu(lien.destination);
  const balises = [
    a.titre && `<meta property="og:title" content="${a.titre}">`,
    a.desc && `<meta property="og:description" content="${a.desc}">`,
    a.image && `<meta property="og:image" content="${esc(a.image)}">`,
    `<meta property="og:url" content="https://liens.annecharlotte.be/${esc(lien.slug)}/">`,
    a.image && '<meta name="twitter:card" content="summary_large_image">',
  ].filter(Boolean).join('\n');
  const html = gabarit
    .replaceAll('{{TITRE}}', a.titre || 'Anne-Charlotte')
    .replaceAll('{{APERCU}}', balises)
    .replaceAll('{{DESTINATION}}', esc(lien.destination))
    .replaceAll('{{SLUG_JSON}}', js(lien.slug))
    .replaceAll('{{DEST_JSON}}', js(lien.destination));
  mkdirSync(`${SORTIE}/${lien.slug}`, { recursive: true });
  writeFileSync(`${SORTIE}/${lien.slug}/index.html`, html);
  n++;
}
console.log(`${n} lien(s) publié(s) dans ${SORTIE}/`);

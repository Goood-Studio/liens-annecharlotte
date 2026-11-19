// Commun aux pages de liens et à la 404 (injecté au build).
// Paramètres pour la fonction go : le lien, d'où on vient, le fuseau, et
// l'utm_campaign reçue dans l'adresse s'il y en a une.
function parametresGo(slug) {
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var p = { l: slug, r: document.referrer || '', tz: tz };
  var uc = new URLSearchParams(location.search).get('utm_campaign');
  if (uc) p.uc = uc;
  return new URLSearchParams(p);
}
// Emmène la personne à destination. Les paramètres reçus (?utm_…) passent à
// la page d'arrivée ; sur annecharlotte.be, ?via= dit à la page quel lien a
// amené la personne (PDF, RDV et WhatsApp comptés par liens-suivi.js).
function aller(slug, dest) {
  try {
    var u = new URL(dest);
    new URLSearchParams(location.search).forEach(function (v, k) { if (k !== 'via') u.searchParams.set(k, v); });
    if (/(^|\.)annecharlotte\.be$/.test(u.hostname)) u.searchParams.set('via', slug);
    dest = u.toString();
  } catch (e) {}
  location.replace(dest);
}
var GO = 'https://bgenoxwpwhqvsqdupnub.supabase.co/functions/v1/go';

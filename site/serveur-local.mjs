// Aperçu local de _site/ qui imite GitHub Pages (dossier → index.html, sinon 404.html).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const RACINE = new URL('../_site/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'text/javascript' };
const PORT = Number(process.env.PORT || 4407);
createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let fichier = join(RACINE, chemin);
  try {
    if ((await stat(fichier)).isDirectory()) {
      if (!chemin.endsWith('/')) { res.writeHead(301, { location: chemin + '/' }); return res.end(); }
      fichier = join(fichier, 'index.html');
    }
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(join(RACINE, '404.html')));
  }
}).listen(PORT, () => console.log(`Aperçu sur http://localhost:${PORT}`));

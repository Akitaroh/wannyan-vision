import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.WANNYAN_PORT || 4174);
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.resolve(root, rel || 'index.html');
    if (!file.startsWith(root)) {res.writeHead(403); res.end('Forbidden'); return;}
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('ページが見つかりません');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`わんにゃん視覚: http://127.0.0.1:${port}`));

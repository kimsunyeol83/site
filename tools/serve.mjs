// 내 컴퓨터에서 사이트를 미리 보는 작은 서버.
// 사용: node tools/serve.mjs                         ->  http://localhost:4173
//       node tools/serve.mjs --port 4174 --base /site  ->  http://localhost:4174/site/  (GitHub Pages의 하위 주소 흉내)
// GitHub Pages처럼, 폴더 주소가 "/"로 끝나지 않으면 "/"를 붙인 주소로 넘긴다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const port = Number(arg('--port', process.env.PORT || 4173));
const base = arg('--base', '').replace(/\/+$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const notFound = (res) => res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('없는 주소입니다');

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (base) {
      if (p === base) return res.writeHead(301, { location: base + '/' + url.search }).end();
      if (!p.startsWith(base + '/')) return notFound(res);
      p = p.slice(base.length);
    }
    let file = path.join(root, p);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith('/')) return res.writeHead(301, { location: base + p + '/' + url.search }).end();
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) return notFound(res);
    res.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`미리보기: http://localhost:${port}${base}/`));

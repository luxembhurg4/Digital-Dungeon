/* Dev/CI static server for tests — run: node test/server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webp': 'image/webp', '.ico': 'image/x-icon'
};
http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(root, u);
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); return s.end('404'); }
    s.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(8765, () => console.log('server on 8765'));

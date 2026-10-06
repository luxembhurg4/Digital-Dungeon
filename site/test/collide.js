const fs = require('fs');
const code = fs.readFileSync('../js/data.js', 'utf8');
eval(code + '\nglobalThis.buildGrid = buildGrid; globalThis.HALLWAYS = HALLWAYS; globalThis.WORLD = WORLD;');

const h = HALLWAYS[1];
const grid = buildGrid(h);
console.log('row13:', grid[13].map(v => v ? '.' : '#').join(''));
console.log('row14:', grid[14].map(v => v ? '.' : '#').join(''));
console.log('(3,13):', grid[13][3], ' (4,13):', grid[13][4], ' (5,13):', grid[13][5]);

// simulate feet movement left from (80,208)
function cellsOpen(grid, x, y) {
  const l = x + 4, t = y + 11, r = x + 12, b = y + 15;
  const c1 = Math.floor(l / 16), c2 = Math.floor(r / 16);
  const r1 = Math.floor(t / 16), r2 = Math.floor(b / 16);
  if (c1 < 0 || r1 < 0 || c2 >= WORLD.COLS || r2 >= WORLD.ROWS) return false;
  for (let rr = r1; rr <= r2; rr++) for (let cc = c1; cc <= c2; cc++) if (!grid[rr][cc]) return false;
  return true;
}
let x = 80;
for (let i = 0; i < 60; i++) {
  const nx = x - 1;
  if (cellsOpen(grid, nx, 208)) x = nx; else { console.log('blocked at x=' + x + ' trying ' + nx); break; }
}
console.log('final x:', x);
